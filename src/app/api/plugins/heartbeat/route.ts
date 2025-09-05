import { NextRequest } from 'next/server'
import { createApiResponse, createCorsResponse, handleCorsOptions } from '@/lib/utils'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
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
        createApiResponse(false, undefined, undefined, validation.error),
        400
      )
    }

    // TODO: Implement database update after database setup
    console.log('Plugin heartbeat received', { pluginId, status, currentTask })

    // Return success response
    return createCorsResponse(
      createApiResponse(true, {
        success: true,
        message: '心跳更新成功',
        pluginId,
        status,
        timestamp: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in plugin heartbeat:', error)
    return createCorsResponse(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      500
    )
  }
}