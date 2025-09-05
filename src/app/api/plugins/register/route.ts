import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, createCorsResponse, handleCorsOptions } from '@/lib/utils'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
}

// Plugin type validation
const VALID_PLUGIN_TYPES = ['person-search', 'company-search', 'company-employees'] as const
const MAX_CAPACITY = 100
const MIN_CAPACITY = 1

interface PluginRegistration {
  pluginId: string
  pluginType: typeof VALID_PLUGIN_TYPES[number]
  capacity: number
  version: string
  metadata?: any
}

function validatePluginData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '插件注册数据不能为空' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  if (data.pluginId.length < 3 || data.pluginId.length > 50) {
    return { valid: false, error: '插件ID长度必须在3-50字符之间' }
  }

  // Plugin type validation
  if (!data.pluginType || !VALID_PLUGIN_TYPES.includes(data.pluginType)) {
    return { valid: false, error: '无效的插件类型' }
  }

  // Capacity validation
  if (!Number.isInteger(data.capacity) || data.capacity < MIN_CAPACITY || data.capacity > MAX_CAPACITY) {
    return { valid: false, error: `插件容量必须在${MIN_CAPACITY}-${MAX_CAPACITY}之间` }
  }

  // Version validation
  if (!data.version || typeof data.version !== 'string') {
    return { valid: false, error: '插件版本不能为空' }
  }

  const versionRegex = /^\d+\.\d+\.\d+$/
  if (!versionRegex.test(data.version)) {
    return { valid: false, error: '插件版本格式无效（应为 x.y.z）' }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip ||
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
        createApiResponse(false, null, null, validation.error),
        400
      )
    }

    // Sanitize inputs
    const sanitizedData = {
      pluginId: pluginId.trim(),
      pluginType: pluginType.trim(),
      capacity: capacity,
      version: version.trim(),
      metadata: metadata || {}
    }

    const supabase = createServerSupabase()
    
    // Insert or update plugin registration
    const { data: existingPlugin } = await supabase
      .from('plugin_registry')
      .select('*')
      .eq('plugin_id', sanitizedData.pluginId)
      .single()

    let data, error

    if (existingPlugin) {
      // Update existing plugin
      const { data: updateData, error: updateError } = await supabase
        .from('plugin_registry')
        .update({
          version: sanitizedData.version,
          capabilities: [sanitizedData.pluginType],
          status: 'online',
          last_heartbeat: new Date().toISOString()
        })
        .eq('plugin_id', sanitizedData.pluginId)
        .select()

      data = updateData ? [{ 
        success: true, 
        plugin_id: sanitizedData.pluginId,
        message: '插件更新成功' 
      }] : []
      error = updateError
    } else {
      // Insert new plugin
      const { data: insertData, error: insertError } = await supabase
        .from('plugin_registry')
        .insert({
          plugin_id: sanitizedData.pluginId,
          version: sanitizedData.version,
          capabilities: [sanitizedData.pluginType],
          status: 'online',
          last_heartbeat: new Date().toISOString(),
          total_tasks: 0,
          successful_tasks: 0,
          performance_score: 100
        })
        .select()

      data = insertData ? [{ 
        success: true, 
        plugin_id: sanitizedData.pluginId,
        message: '插件注册成功' 
      }] : []
      error = insertError
    }

    if (error) {
      console.error('Database error during plugin registration:', error)
      
      // Log error to system logs
      const { error: logError } = await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'plugin_event',
        user_ip: clientIP,
        message: '插件注册数据库错误',
        details: { 
          error: error.message,
          pluginId: sanitizedData.pluginId,
          pluginType: sanitizedData.pluginType
        }
      })
      if (logError) console.error('Failed to log database error:', logError)

      return NextResponse.json(
        createApiResponse(false, null, null, '插件注册失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return createCorsResponse(
        createApiResponse(false, null, null, '插件注册失败'),
        400
      )
    }

    const result = data[0]
    
    if (!result.success) {
      // Log failed plugin registration
      const { error: logError } = await supabase.from('system_logs').insert({
        log_level: 'warn',
        log_type: 'plugin_event',
        user_ip: clientIP,
        message: '插件注册被拒绝',
        details: { 
          pluginId: sanitizedData.pluginId,
          reason: result.message,
          pluginType: sanitizedData.pluginType
        }
      })
      if (logError) console.error('Failed to log rejection:', logError)

      return createCorsResponse(
        createApiResponse(false, null, null, result.message),
        400
      )
    }

    // Log successful plugin registration
    const { error: logError } = await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'plugin_event',
      user_ip: clientIP,
      message: '插件注册成功',
      details: { 
        pluginId: sanitizedData.pluginId,
        pluginType: sanitizedData.pluginType,
        capacity: sanitizedData.capacity,
        version: sanitizedData.version
      }
    })
    if (logError) console.error('Failed to log success:', logError)

    return createCorsResponse(
      createApiResponse(true, {
        success: true,
        pluginId: result.plugin_id,
        message: result.message
      })
    )

  } catch (error) {
    console.error('Unexpected error in plugin registration:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    const { error: logError } = await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'plugin_event',
      user_ip: clientIP,
      message: '插件注册API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    if (logError) console.error('Failed to log error:', logError)

    return createCorsResponse(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      500
    )
  }
}