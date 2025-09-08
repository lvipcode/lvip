import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // Get client IP for logging
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Parse request body
    const { code } = await request.json().catch(() => ({}))

    // Validate input
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '兑换码不能为空'),
        { status: 400 }
      )
    }

    const sanitizedCode = code.trim().toUpperCase()

    // Basic validation
    if (sanitizedCode.length < 4 || sanitizedCode.length > 20) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '兑换码格式无效'),
        { status: 400 }
      )
    }

    // Database validation
    const { createServerSupabase } = await import('@/lib/supabase')
    const supabase = createServerSupabase()

    try {
      // Call the database validation function
      const { data: validationResult, error: validationError } = await (supabase as any)
        .rpc('validate_redemption_code', { p_code: sanitizedCode })

      if (validationError) {
        console.error('Database validation error:', validationError)
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '数据库验证错误'),
          { status: 500 }
        )
      }

      const result = validationResult?.[0]
      if (!result) {
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '兑换码验证失败'),
          { status: 400 }
        )
      }

      if (!result.is_valid) {
        return NextResponse.json(
          createApiResponse(false, {
            isValid: false,
            code: sanitizedCode,
            message: result.message
          }, result.message),
          { status: 400 }
        )
      }

      // Log successful validation (用类型断言绕过 Supabase 类型推断问题)
      try {
        await (supabase as any)
          .from('system_logs')
          .insert({
            log_level: 'info',
            log_type: 'redemption_validation',
            user_ip: clientIP || null,
            message: '兑换码验证成功',
            details: { code: sanitizedCode },
            plugin_id: null,
            task_id: null
          })
      } catch (logError) {
        console.warn('系统日志记录失败:', logError)
      }

      return NextResponse.json(
        createApiResponse(true, {
          isValid: true,
          code: sanitizedCode,
          codeId: result.code_id,
          message: '兑换码验证成功',
          remainingUses: result.remaining_uses,
          dailyRemaining: result.daily_remaining,
          singleLimit: result.single_limit
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
    console.error('Unexpected error in code validation:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}