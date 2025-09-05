import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    // Basic validation
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务ID无效'),
        { status: 400 }
      )
    }

    // TODO: Implement database task cancellation after database setup
    console.log('Task cancellation requested:', { taskId })

    // Mock cancellation success for build
    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        message: '任务取消成功',
        taskId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in task cancellation:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}