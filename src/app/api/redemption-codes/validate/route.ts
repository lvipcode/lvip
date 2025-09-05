import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'

// Rate limiting store (simple in-memory for development)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 10 // 10 requests per minute

  const current = rateLimitStore.get(ip)
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  current.count++
  return { allowed: true, remaining: maxRequests - current.count }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip ||
                    'unknown'

    // Apply rate limiting
    const rateLimit = getRateLimit(clientIP)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        createApiResponse(false, null, null, '请求过于频繁，请稍后再试'),
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + 60000)
          }
        }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { code } = body

    // Input validation
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码不能为空'),
        { status: 400 }
      )
    }

    if (code.length > 50) {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码格式无效'),
        { status: 400 }
      )
    }

    // Sanitize input
    const sanitizedCode = code.trim().toUpperCase()

    const supabase = createServerSupabase()
    
    // Call database function to validate redemption code
    const { data, error } = await supabase.rpc('validate_redemption_code', {
      p_code: sanitizedCode
    })

    if (error) {
      console.error('Database error during code validation:', error)
      
      // Log error to system logs
      try {
        await supabase.from('system_logs').insert({
          log_level: 'error',
          log_type: 'api_request',
          user_ip: clientIP,
          message: '兑换码验证数据库错误',
          details: { error: error.message, code: sanitizedCode }
        })
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }

      return NextResponse.json(
        createApiResponse(false, null, null, '验证服务暂不可用，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '验证失败，请检查兑换码'),
        { status: 400 }
      )
    }

    const result = data[0]
    
    // Log successful validation
    try {
      await supabase.from('system_logs').insert({
        log_level: 'info',
        log_type: 'api_request',
        user_ip: clientIP,
        message: result.is_valid ? '兑换码验证成功' : '兑换码验证失败',
        details: { 
          code: sanitizedCode, 
          valid: result.is_valid,
          remaining_uses: result.remaining_uses
        }
      })
    } catch (logError) {
      console.error('Failed to log validation:', logError)
    }

    return NextResponse.json(
      createApiResponse(true, {
        isValid: result.is_valid,
        codeId: result.code_id,
        remainingUses: result.remaining_uses,
        dailyRemaining: result.daily_remaining,
        singleLimit: result.single_limit,
        message: result.message
      }),
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining)
        }
      }
    )

  } catch (error) {
    console.error('Unexpected error in code validation:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    try {
      await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'api_request',
        user_ip: clientIP,
        message: '兑换码验证API意外错误',
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