import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, createCorsResponse, handleCorsOptions } from '@/lib/utils'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
}

interface HeartbeatRequest {
  pluginId: string
  status: 'online' | 'busy' | 'idle'
  currentTask?: string | null
  performance?: {
    cpuUsage?: number
    memoryUsage?: number
    tasksCompleted?: number
    errors?: number
  }
}

function validateHeartbeatData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '心跳数据不能为空' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  if (data.pluginId.length < 3 || data.pluginId.length > 100) {
    return { valid: false, error: '插件ID长度无效' }
  }

  // Status validation
  const validStatuses = ['online', 'busy', 'idle']
  if (!data.status || !validStatuses.includes(data.status)) {
    return { valid: false, error: '无效的插件状态' }
  }

  // Current task validation (optional)
  if (data.currentTask && typeof data.currentTask !== 'string') {
    return { valid: false, error: '当前任务ID格式无效' }
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
    const { pluginId, status, currentTask, performance } = body

    // Validate input data
    const validation = validateHeartbeatData({
      pluginId,
      status,
      currentTask,
      performance
    })

    if (!validation.valid) {
      return createCorsResponse(
        createApiResponse(false, null, null, validation.error),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call database function to update plugin heartbeat
    const { data, error } = await supabase.rpc('update_plugin_heartbeat', {
      p_plugin_id: pluginId,
      p_status: status === 'idle' ? 'online' : status,
      p_current_task: currentTask || null
    })

    if (error) {
      console.error('Database error during heartbeat update:', error)
      
      const { error: logError1 } = await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'plugin_event',
        plugin_id: pluginId,
        user_ip: clientIP,
        message: '插件心跳更新失败',
        details: { error: error.message }
      })
      if (logError1) console.error('Failed to log heartbeat error:', logError1)

      return createCorsResponse(
        createApiResponse(false, null, null, '心跳更新失败'),
        { status: 500 }
      )
    }

    // 记录成功的心跳日志（仅debug级别，避免日志过多）
    const { error: logError2 } = await supabase.from('system_logs').insert({
      log_level: 'debug',
      log_type: 'plugin_event',
      plugin_id: pluginId,
      user_ip: clientIP,
      message: '插件心跳更新成功',
      details: { 
        status, 
        current_task: currentTask,
        performance: performance || null
      }
    })
    if (logError2) console.error('Failed to log heartbeat success:', logError2)

    // 如果插件状态变为online，检查是否有任务可以分配
    if (status === 'online' || status === 'idle') {
      const { data: pendingTasks } = await supabase
        .from('task_queue')
        .select('id, task_type')
        .eq('status', 'pending')
        .limit(1)

      if (pendingTasks && pendingTasks.length > 0) {
        const { error: logError3 } = await supabase.from('system_logs').insert({
          log_level: 'info',
          log_type: 'plugin_event',
          plugin_id: pluginId,
          message: '插件上线，有待分配任务',
          details: { 
            status, 
            pending_tasks: pendingTasks.length,
            current_task: currentTask 
          }
        })
        if (logError3) console.error('Failed to log task availability:', logError3)
      }
    }

    const responseData = {
      success: true,
      pluginId,
      status: status === 'idle' ? 'online' : status,
      lastHeartbeat: new Date().toISOString(),
      message: '心跳更新成功'
    }

    return createCorsResponse(createApiResponse(true, responseData))

  } catch (error) {
    console.error('Unexpected error in heartbeat update:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    const { error: logError4 } = await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'plugin_event',
      user_ip: clientIP,
      message: '插件心跳API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    if (logError4) console.error('Failed to log unexpected error:', logError4)

    return createCorsResponse(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}

// GET方法用于插件状态查询
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pluginId = searchParams.get('pluginId')

    if (!pluginId) {
      return createCorsResponse(
        createApiResponse(false, null, null, '插件ID参数缺失'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    const { data: plugin, error } = await supabase
      .from('plugin_registry')
      .select('*')
      .eq('plugin_id', pluginId)
      .single()

    if (error) {
      return createCorsResponse(
        createApiResponse(false, null, null, '插件未注册或查询失败'),
        { status: 404 }
      )
    }

    // 判断插件是否在线（2分钟内有心跳）
    const isOnline = plugin.last_heartbeat && 
      (new Date().getTime() - new Date(plugin.last_heartbeat).getTime()) < 120000

    return createCorsResponse(
      createApiResponse(true, {
        pluginId: plugin.plugin_id,
        status: isOnline ? plugin.status : 'offline',
        lastHeartbeat: plugin.last_heartbeat,
        totalTasks: plugin.total_tasks,
        successfulTasks: plugin.successful_tasks,
        performanceScore: plugin.performance_score,
        capabilities: plugin.capabilities,
        version: plugin.version
      })
    )

  } catch (error) {
    console.error('Error in plugin status query:', error)
    return createCorsResponse(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}