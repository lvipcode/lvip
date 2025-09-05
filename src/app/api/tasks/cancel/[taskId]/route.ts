import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'

interface RouteParams {
  params: Promise<{
    taskId: string
  }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { taskId } = await params
    
    // Validate task ID format
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务ID'),
        { status: 400 }
      )
    }

    // Parse request body for cancellation reason
    const body = await request.json().catch(() => ({}))
    const { reason = '用户主动取消' } = body

    // Validate reason
    if (typeof reason !== 'string' || reason.length > 200) {
      return NextResponse.json(
        createApiResponse(false, null, null, '取消原因格式无效'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'

    // Check if task exists and can be cancelled
    const { data: task, error: taskError } = await supabase
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务不存在'),
        { status: 404 }
      )
    }

    // Check if task can be cancelled
    const cancellableStatuses = ['pending', 'assigned', 'processing']
    if (!cancellableStatuses.includes(task.status)) {
      return NextResponse.json(
        createApiResponse(false, null, null, `任务状态为${task.status}，无法取消`),
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Update task status to failed/cancelled
    const { error } = await supabase
      .from('task_queue')
      .update({
        status: 'failed',
        completed_at: now
      })
      .eq('id', taskId)
      .in('status', cancellableStatuses) // Ensure status hasn't changed

    if (error) {
      console.error('Error cancelling task:', error)
      
      await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'task_event',
        task_id: taskId,
        user_ip: clientIP,
        message: '任务取消失败',
        details: { error: error.message }
      }).catch(console.error)

      return NextResponse.json(
        createApiResponse(false, null, null, '任务取消失败'),
        { status: 500 }
      )
    }

    // If task was assigned to a plugin, update plugin status back to online
    if (task.assigned_plugin_id) {
      await supabase
        .from('plugin_registry')
        .update({
          status: 'online',
          last_heartbeat: now
        })
        .eq('plugin_id', task.assigned_plugin_id)
        .catch(console.error)
    }

    // Log successful cancellation
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'task_event',
      task_id: taskId,
      user_ip: clientIP,
      message: '任务已取消',
      details: {
        original_status: task.status,
        reason: reason.trim(),
        cancelled_at: now
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        taskId,
        status: 'cancelled',
        cancelledAt: now,
        message: '任务已成功取消',
        reason: reason.trim()
      })
    )

  } catch (error) {
    console.error('Unexpected error in task cancellation:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'api_request',
      task_id: params.taskId,
      user_ip: clientIP,
      message: '任务取消API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}