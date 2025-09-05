import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminLogin } from '@/lib/auth'
import { createApiResponse } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '用户名和密码不能为空'),
        { status: 400 }
      )
    }

    // 获取客户端信息
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // 验证登录
    const result = await verifyAdminLogin(username, password, clientIP, userAgent)

    if (result.success) {
      return NextResponse.json(
        createApiResponse(true, {
          token: result.token,
          user: result.user
        }, '登录成功')
      )
    } else {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, result.error || '登录失败'),
        { status: 401 }
      )
    }

  } catch (error) {
    console.error('管理员登录API错误:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}

// 支持OPTIONS请求（CORS预检）
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}