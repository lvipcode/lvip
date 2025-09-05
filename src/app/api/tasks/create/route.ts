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

  const validTypes = ['person_search', 'company_search', 'skill_analysis']
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

    // TODO: Implement database task creation after database setup
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('Task creation requested:', { taskId, ...validation.sanitized })

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        message: '任务创建成功',
        taskId,
        taskType: validation.sanitized?.taskType,
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in task creation:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}