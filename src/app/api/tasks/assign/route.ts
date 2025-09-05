import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'

function validateAssignmentData(data: any): { valid: boolean; error?: string; sanitized?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '分配数据不能为空' }
  }

  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: '任务ID不能为空' }
  }

  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  return {
    valid: true,
    sanitized: {
      taskId: data.taskId.trim(),
      pluginId: data.pluginId.trim(),
      priority: data.priority || 'normal',
      estimatedDuration: data.estimatedDuration || 300
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    const body = await request.json().catch(() => ({}))
    const { taskId, pluginId, priority, estimatedDuration } = body

    const validation = validateAssignmentData({
      taskId, pluginId, priority, estimatedDuration
    })

    if (!validation.valid) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, validation.error),
        { status: 400 }
      )
    }

    // TODO: Implement database assignment after database setup
    console.log('Task assignment requested:', validation.sanitized)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        message: '任务分配成功',
        taskId: validation.sanitized?.taskId,
        pluginId: validation.sanitized?.pluginId,
        timestamp: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in task assignment:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}