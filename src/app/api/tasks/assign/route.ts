import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'

interface TaskAssignment {
  taskId: string
  pluginId: string
  priority?: number
  estimatedDuration?: number
}

function validateAssignmentData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '任务分配数据不能为空' }
  }

  // Task ID validation
  if (!data.taskId || !isValidUUID(data.taskId)) {
    return { valid: false, error: '无效的任务ID' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  if (data.pluginId.length < 3 || data.pluginId.length > 50) {
    return { valid: false, error: '插件ID长度无效' }
  }

  // Optional priority validation
  if (data.priority && (!Number.isInteger(data.priority) || data.priority < 1 || data.priority > 10)) {
    return { valid: false, error: '优先级必须在1-10之间' }
  }

  // Optional estimated duration validation (in minutes)
  if (data.estimatedDuration && (!Number.isInteger(data.estimatedDuration) || data.estimatedDuration < 1 || data.estimatedDuration > 1440)) {
    return { valid: false, error: '预计时长必须在1-1440分钟之间' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip ||
                    'unknown'

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { taskId, pluginId, priority = 5, estimatedDuration = 30 } = body

    // Validate input data
    const validation = validateAssignmentData({
      taskId,
      pluginId,
      priority,
      estimatedDuration
    })

    if (!validation.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, validation.error),
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedData = {
      taskId: taskId.trim(),
      pluginId: pluginId.trim(),
      priority: priority,
      estimatedDuration: estimatedDuration
    }

    const supabase = createServerSupabase()
    
    // Call database function to assign task
    const { data, error } = await supabase.rpc('assign_task_to_plugin', {
      p_task_id: sanitizedData.taskId,
      p_plugin_id: sanitizedData.pluginId,
      p_priority: sanitizedData.priority,
      p_estimated_duration: sanitizedData.estimatedDuration,
      p_client_ip: clientIP
    })

    if (error) {
      console.error('Database error during task assignment:', error)
      
      // Log error to system logs
      await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'task_event',
        task_id: sanitizedData.taskId,
        user_ip: clientIP,
        message: '任务分配数据库错误',
        details: { 
          error: error.message,
          taskId: sanitizedData.taskId,
          pluginId: sanitizedData.pluginId
        }
      }).catch(console.error)

      return NextResponse.json(
        createApiResponse(false, null, null, '任务分配失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务或插件不存在'),
        { status: 404 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      // Log failed task assignment
      await supabase.from('system_logs').insert({
        log_level: 'warn',
        log_type: 'task_event',
        task_id: sanitizedData.taskId,
        user_ip: clientIP,
        message: '任务分配被拒绝',
        details: { 
          taskId: sanitizedData.taskId,
          pluginId: sanitizedData.pluginId,
          reason: result.message
        }
      }).catch(console.error)

      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log successful task assignment
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'task_event',
      task_id: sanitizedData.taskId,
      user_ip: clientIP,
      message: '任务分配成功',
      details: { 
        taskId: sanitizedData.taskId,
        pluginId: sanitizedData.pluginId,
        priority: sanitizedData.priority,
        estimatedDuration: sanitizedData.estimatedDuration,
        assignedAt: result.assigned_at
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        taskId: sanitizedData.taskId,
        pluginId: sanitizedData.pluginId,
        assignedAt: result.assigned_at,
        priority: sanitizedData.priority,
        estimatedCompletion: result.estimated_completion,
        message: result.message
      })
    )

  } catch (error) {
    console.error('Unexpected error in task assignment:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'task_event',
      user_ip: clientIP,
      message: '任务分配API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}

// GET method to retrieve assignment information
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const taskId = url.searchParams.get('taskId')
    const pluginId = url.searchParams.get('pluginId')
    
    if (!taskId && !pluginId) {
      return NextResponse.json(
        createApiResponse(false, null, null, '请提供任务ID或插件ID'),
        { status: 400 }
      )
    }

    if (taskId && !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务ID'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call database function to get assignment info
    const { data, error } = await supabase.rpc('get_task_assignments', {
      p_task_id: taskId,
      p_plugin_id: pluginId
    })

    if (error) {
      console.error('Database error during assignment query:', error)
      return NextResponse.json(
        createApiResponse(false, null, null, '查询失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '未找到相关分配信息'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse(true, {
        assignments: data,
        count: data.length
      })
    )

  } catch (error) {
    console.error('Unexpected error in assignment query:', error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}