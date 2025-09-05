import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'
import type { SearchParams } from '@/types'

// Input validation schemas
const VALID_TASK_TYPES = ['person-search', 'company-search', 'company-employees'] as const
const MAX_RESULTS_LIMIT = 1000
const MIN_RESULTS_LIMIT = 1

function validateSearchParams(params: any): { valid: boolean; error?: string } {
  if (!params || typeof params !== 'object') {
    return { valid: false, error: '搜索参数不能为空' }
  }

  // Keywords are required for all search types
  if (!params.keywords || typeof params.keywords !== 'string') {
    return { valid: false, error: '搜索关键词不能为空' }
  }

  if (params.keywords.length > 200) {
    return { valid: false, error: '搜索关键词不能超过200个字符' }
  }

  // Optional fields validation
  const optionalStringFields = ['location', 'company', 'industry', 'experience']
  for (const field of optionalStringFields) {
    if (params[field] && (typeof params[field] !== 'string' || params[field].length > 100)) {
      return { valid: false, error: `${field}参数格式无效` }
    }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip ||
                    'unknown'

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      code, 
      taskType, 
      searchParams, 
      maxResults = 500 
    } = body

    // Input validation
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码不能为空'),
        { status: 400 }
      )
    }

    if (!taskType || !VALID_TASK_TYPES.includes(taskType)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务类型'),
        { status: 400 }
      )
    }

    if (!Number.isInteger(maxResults) || maxResults < MIN_RESULTS_LIMIT || maxResults > MAX_RESULTS_LIMIT) {
      return NextResponse.json(
        createApiResponse(false, null, null, `结果数量必须在${MIN_RESULTS_LIMIT}-${MAX_RESULTS_LIMIT}之间`),
        { status: 400 }
      )
    }

    // Validate search parameters
    const paramValidation = validateSearchParams(searchParams)
    if (!paramValidation.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, paramValidation.error),
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedCode = code.trim().toUpperCase()
    const sanitizedSearchParams = {
      keywords: searchParams.keywords.trim(),
      location: searchParams.location?.trim() || '',
      company: searchParams.company?.trim() || '',
      industry: searchParams.industry?.trim() || '',
      experience: searchParams.experience?.trim() || ''
    }

    const supabase = createServerSupabase()
    
    // Call database function to create search task
    const { data, error } = await supabase.rpc('create_search_task', {
      p_code: sanitizedCode,
      p_task_type: taskType,
      p_search_params: sanitizedSearchParams,
      p_max_results: maxResults
    })

    if (error) {
      console.error('Database error during task creation:', error)
      
      // Log error to system logs
      try {
        await supabase.from('system_logs').insert({
          log_level: 'error',
          log_type: 'api_request',
          user_ip: clientIP,
          message: '任务创建数据库错误',
          details: { 
            error: error.message, 
            code: sanitizedCode,
            taskType,
            maxResults
          }
        })
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }

      return NextResponse.json(
        createApiResponse(false, null, null, '任务创建失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务创建失败'),
        { status: 400 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      // Log failed task creation
      try {
        await supabase.from('system_logs').insert({
          log_level: 'warn',
          log_type: 'api_request',
          user_ip: clientIP,
          message: '任务创建被拒绝',
          details: { 
            code: sanitizedCode,
            reason: result.message,
            taskType,
            maxResults
          }
        })
      } catch (logError) {
        console.error('Failed to log rejection:', logError)
      }

      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log successful task creation
    try {
      await supabase.from('system_logs').insert({
        log_level: 'info',
        log_type: 'task_event',
        task_id: result.task_id,
        user_ip: clientIP,
        message: '创建搜索任务成功',
        details: { 
          taskType,
          maxResults,
          searchParams: sanitizedSearchParams
        }
      })
    } catch (logError) {
      console.error('Failed to log task creation:', logError)
    }

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        taskId: result.task_id,
        message: result.message
      })
    )

  } catch (error) {
    console.error('Unexpected error in task creation:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    try {
      await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'api_request',
        user_ip: clientIP,
        message: '任务创建API意外错误',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    } catch (logError) {
      console.error('Failed to log unexpected error:', logError)
    }

    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}