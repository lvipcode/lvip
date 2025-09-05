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

    // TODO: Implement database validation after database setup
    console.log('Code validation requested:', { code: sanitizedCode, clientIP })

    // For build purposes, return a mock success response
    // In production, this would validate against the database
    return NextResponse.json(
      createApiResponse(true, {
        valid: true,
        code: sanitizedCode,
        message: '兑换码验证成功',
        // Mock data for build
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        maxUses: 100,
        currentUses: 0,
        dailyLimit: 10,
        singleLimit: 50
      })
    )

  } catch (error) {
    console.error('Unexpected error in code validation:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}