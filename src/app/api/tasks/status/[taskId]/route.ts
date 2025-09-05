import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'

interface RouteParams {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(
  request: NextRequest, 
  { params }: RouteParams
) {
  const { taskId } = await params
  
  try {
    
    // Validate task ID format
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '无效的任务ID'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call database function to get task status
    const { data, error } = await (supabase as any).rpc('get_task_status', {
      p_task_id: taskId
    })

    if (error) {
      console.error('Database error during status query:', error)
      
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
      
      // Log error to system logs
      await (supabase as any).from('system_logs').insert({
        log_level: 'error',
        log_type: 'api_request',
        task_id: taskId,
        user_ip: clientIP,
        message: '任务状态查询数据库错误',
        details: { error: error.message }
      }).catch(console.error)

      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '状态查询失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务不存在'),
        { status: 404 }
      )
    }

    const taskStatus = data[0]
    
    // Format the response
    const response = {
      taskId: taskStatus.task_id,
      status: taskStatus.status,
      progress: taskStatus.progress || 0,
      processedCount: taskStatus.processed_count || 0,
      totalCount: taskStatus.max_results || 0,
      assignedPlugin: taskStatus.assigned_plugin,
      startedAt: taskStatus.started_at,
      estimatedCompletion: taskStatus.estimated_completion,
      message: taskStatus.message || ''
    }

    return NextResponse.json(
      createApiResponse(true, response)
    )

  } catch (error) {
    console.error('Unexpected error in status query:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    await (supabase as any).from('system_logs').insert({
      log_level: 'error',
      log_type: 'api_request',
      task_id: taskId,
      user_ip: clientIP,
      message: '任务状态查询API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}