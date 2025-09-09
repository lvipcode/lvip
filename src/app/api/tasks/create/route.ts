import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'

function validateTaskData(data: any): { valid: boolean; error?: string; sanitized?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '任务数据不能为空' }
  }

  if (!data.taskType || typeof data.taskType !== 'string') {
    return { valid: false, error: '任务类型不能为空' }
  }

  if (!data.searchParams || typeof data.searchParams !== 'object') {
    return { valid: false, error: '搜索参数不能为空' }
  }

  const validTypes = ['person-search', 'company-search', 'company-employees']
  if (!validTypes.includes(data.taskType)) {
    return { valid: false, error: '无效的任务类型' }
  }

  return {
    valid: true,
    sanitized: {
      taskType: data.taskType,
      searchParams: data.searchParams,
      priority: data.priority || 'normal',
      maxResults: Math.min(data.maxResults || 50, 1000)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    const body = await request.json().catch(() => ({}))
    const { taskType, searchParams, priority, maxResults } = body

    const validation = validateTaskData({
      taskType, searchParams, priority, maxResults
    })

    if (!validation.valid) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, validation.error),
        { status: 400 }
      )
    }

    // Database task creation
    const { createServerSupabase } = await import('@/lib/supabase')
    const supabase = createServerSupabase()

    try {
      const { code } = body

      // First validate redemption code
      if (!code) {
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '兑换码不能为空'),
          { status: 400 }
        )
      }

      // Validate redemption code
      const { data: validationResult, error: validationError } = await (supabase as any)
        .rpc('validate_redemption_code', { p_code: code.trim().toUpperCase() })

      if (validationError || !validationResult?.[0]?.is_valid) {
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '兑换码无效或已过期'),
          { status: 400 }
        )
      }

      const codeInfo = validationResult[0]

      // Create task in database
      const { data: task, error: taskError } = await (supabase as any)
        .from('task_queue')
        .insert({
          redemption_code_id: codeInfo.code_id,
          task_type: validation.sanitized?.taskType,
          search_params: validation.sanitized?.searchParams,
          max_results: validation.sanitized?.maxResults,
          status: 'pending',
          timeout_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分钟超时
        })
        .select()
        .single()

      if (taskError) {
        console.error('Database task creation error:', taskError)
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '任务创建失败'),
          { status: 500 }
        )
      }

      // Log task creation (用类型断言绕过 Supabase 类型推断问题)
      try {
        await (supabase as any)
          .from('system_logs')
          .insert({
            log_level: 'info',
            log_type: 'task_event',
            task_id: task.id,
            user_ip: clientIP || null,
            message: '任务创建成功',
            details: validation.sanitized || null,
            plugin_id: null
          })
      } catch (logError) {
        console.warn('系统日志记录失败:', logError)
      }

      return NextResponse.json(
        createApiResponse(true, {
          success: true,
          message: '任务创建成功',
          taskId: task.id,
          taskType: task.task_type,
          status: task.status,
          createdAt: task.created_at
        })
      )

    } catch (dbError) {
      console.error('Database connection error:', dbError)
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '数据库连接失败'),
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Unexpected error in task creation:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}