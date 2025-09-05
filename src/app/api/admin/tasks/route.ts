import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'

// Admin authentication middleware
async function validateAdminAuth(request: NextRequest): Promise<{ valid: boolean; error?: string; adminId?: string }> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: '缺少管理员认证令牌' }
  }

  const token = authHeader.substring(7)
  
  // In production, validate JWT token here
  if (token !== process.env.ADMIN_TOKEN) {
    return { valid: false, error: '无效的管理员令牌' }
  }

  return { valid: true, adminId: 'admin' }
}

// GET - List tasks with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') || 'all'
    const taskType = url.searchParams.get('taskType') || 'all'
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        createApiResponse(false, null, null, '分页参数无效'),
        { status: 400 }
      )
    }

    // Validate date parameters
    let dateFromParsed = null
    let dateToParsed = null
    
    if (dateFrom) {
      dateFromParsed = new Date(dateFrom)
      if (isNaN(dateFromParsed.getTime())) {
        return NextResponse.json(
          createApiResponse(false, null, null, '开始日期格式无效'),
          { status: 400 }
        )
      }
    }
    
    if (dateTo) {
      dateToParsed = new Date(dateTo)
      if (isNaN(dateToParsed.getTime())) {
        return NextResponse.json(
          createApiResponse(false, null, null, '结束日期格式无效'),
          { status: 400 }
        )
      }
    }

    const supabase = createServerSupabase()
    
    // Call database function to get tasks
    const { data, error } = await supabase.rpc('admin_get_tasks', {
      p_page: page,
      p_limit: limit,
      p_status: status,
      p_task_type: taskType,
      p_date_from: dateFromParsed?.toISOString() || null,
      p_date_to: dateToParsed?.toISOString() || null
    })

    if (error) {
      console.error('Database error during admin tasks query:', error)
      return NextResponse.json(
        createApiResponse(false, null, null, '查询失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(true, {
          tasks: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          },
          statistics: {
            totalTasks: 0,
            pendingTasks: 0,
            runningTasks: 0,
            completedTasks: 0,
            failedTasks: 0
          }
        })
      )
    }

    const result = data[0]
    const totalPages = Math.ceil((result.total_count || 0) / limit)
    
    return NextResponse.json(
      createApiResponse(true, {
        tasks: result.tasks || [],
        pagination: {
          page,
          limit,
          total: result.total_count || 0,
          totalPages
        },
        statistics: result.statistics || {}
      })
    )

  } catch (error) {
    console.error('Unexpected error in admin tasks query:', error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}

// DELETE - Cancel or delete task
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const taskId = url.searchParams.get('taskId')
    const action = url.searchParams.get('action') || 'cancel' // 'cancel' or 'delete'
    const reason = url.searchParams.get('reason') || '管理员操作'
    
    // Validate task ID
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务ID'),
        { status: 400 }
      )
    }

    // Validate action
    if (!['cancel', 'delete'].includes(action)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的操作类型'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call appropriate database function
    const functionName = action === 'cancel' ? 'admin_cancel_task' : 'admin_delete_task'
    const { data, error } = await supabase.rpc(functionName, {
      p_task_id: taskId,
      p_reason: reason,
      p_admin_id: authResult.adminId
    })

    if (error) {
      console.error(`Database error during admin task ${action}:`, error)
      return NextResponse.json(
        createApiResponse(false, null, null, `${action === 'cancel' ? '取消' : '删除'}失败，请稍后重试`),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务不存在'),
        { status: 404 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log admin action
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'admin_action',
      task_id: taskId,
      user_ip: clientIP,
      message: `管理员${action === 'cancel' ? '取消' : '删除'}任务`,
      details: {
        adminId: authResult.adminId,
        taskId,
        action,
        reason
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        taskId,
        action,
        message: result.message
      })
    )

  } catch (error) {
    console.error(`Unexpected error in admin task operation:`, error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}

// PUT - Update task priority or reassign
export async function PUT(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { taskId, action, priority, pluginId, reason } = body

    // Validate task ID
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务ID'),
        { status: 400 }
      )
    }

    // Validate action
    if (!['priority', 'reassign'].includes(action)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的操作类型'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call appropriate database function
    let data, error
    
    if (action === 'priority') {
      if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
        return NextResponse.json(
          createApiResponse(false, null, null, '优先级必须在1-10之间'),
          { status: 400 }
        )
      }

      ({ data, error } = await supabase.rpc('admin_update_task_priority', {
        p_task_id: taskId,
        p_priority: priority,
        p_admin_id: authResult.adminId
      }))
    } else if (action === 'reassign') {
      if (!pluginId || typeof pluginId !== 'string') {
        return NextResponse.json(
          createApiResponse(false, null, null, '插件ID不能为空'),
          { status: 400 }
        )
      }

      ({ data, error } = await supabase.rpc('admin_reassign_task', {
        p_task_id: taskId,
        p_plugin_id: pluginId,
        p_reason: reason || '管理员重新分配',
        p_admin_id: authResult.adminId
      }))
    }

    if (error) {
      console.error(`Database error during admin task ${action}:`, error)
      return NextResponse.json(
        createApiResponse(false, null, null, `${action === 'priority' ? '优先级更新' : '任务重分配'}失败，请稍后重试`),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务不存在'),
        { status: 404 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log admin action
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'admin_action',
      task_id: taskId,
      user_ip: clientIP,
      message: `管理员${action === 'priority' ? '更新任务优先级' : '重新分配任务'}`,
      details: {
        adminId: authResult.adminId,
        taskId,
        action,
        priority: action === 'priority' ? priority : undefined,
        pluginId: action === 'reassign' ? pluginId : undefined,
        reason: action === 'reassign' ? reason : undefined
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        taskId,
        action,
        message: result.message
      })
    )

  } catch (error) {
    console.error(`Unexpected error in admin task update:`, error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}