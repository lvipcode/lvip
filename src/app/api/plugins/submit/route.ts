import { NextRequest } from 'next/server'
import { createApiResponse, createCorsResponse, handleCorsOptions } from '@/lib/utils'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
}

function validateSubmissionData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '提交数据不能为空' }
  }

  // Task ID validation
  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: '任务ID不能为空' }
  }

  // Results validation
  if (!data.results || !Array.isArray(data.results)) {
    return { valid: false, error: '结果数据格式无效' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
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
    const { taskId, results, pluginId, metadata } = body

    // Validate input data
    const validation = validateSubmissionData({
      taskId,
      results,
      pluginId,
      metadata
    })

    if (!validation.valid) {
      return createCorsResponse(
        createApiResponse(false, undefined, undefined, validation.error),
        400
      )
    }

    // TODO: Implement database submission after database setup
    console.log('Task submission received', {
      taskId, 
      pluginId, 
      resultCount: results?.length || 0 
    })

    // Return success response
    return createCorsResponse(
      createApiResponse(true, {
        success: true,
        message: '任务结果提交成功',
        taskId,
        processedCount: results?.length || 0,
        timestamp: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in task submission:', error)
    return createCorsResponse(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      500
    )
  }
}