import { NextRequest } from 'next/server'
import { createApiResponse, createCorsResponse, handleCorsOptions } from '@/lib/utils'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
}

function validatePluginData(data: any): { valid: boolean; error?: string; sanitized?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '注册数据不能为空' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  if (data.pluginId.length < 3 || data.pluginId.length > 100) {
    return { valid: false, error: '插件ID长度无效' }
  }

  // Plugin type validation
  const validTypes = ['data_extractor', 'content_analyzer', 'search_engine']
  if (!data.pluginType || !validTypes.includes(data.pluginType)) {
    return { valid: false, error: '无效的插件类型' }
  }

  // Capacity validation
  if (typeof data.capacity !== 'number' || data.capacity < 1 || data.capacity > 100) {
    return { valid: false, error: '插件容量必须是1-100之间的数字' }
  }

  // Version validation
  if (!data.version || typeof data.version !== 'string') {
    return { valid: false, error: '插件版本不能为空' }
  }

  return {
    valid: true,
    sanitized: {
      pluginId: data.pluginId.trim(),
      pluginType: data.pluginType,
      capacity: Math.floor(data.capacity),
      version: data.version.trim(),
      metadata: data.metadata || {}
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { pluginId, pluginType, capacity, version, metadata } = body

    // Validate input data
    const validation = validatePluginData({
      pluginId,
      pluginType,
      capacity,
      version,
      metadata
    })

    if (!validation.valid) {
      return createCorsResponse(
        createApiResponse(false, undefined, undefined, validation.error),
        400
      )
    }

    // TODO: Implement database registration after database setup
    console.log('Plugin registration requested', validation.sanitized)

    // Return success response
    return createCorsResponse(
      createApiResponse(true, {
        success: true,
        message: '插件注册成功',
        pluginId: validation.sanitized?.pluginId,
        timestamp: new Date().toISOString()
      })
    )

  } catch (error) {
    console.error('Unexpected error in plugin registration:', error)
    return createCorsResponse(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      500
    )
  }
}