import { NextRequest, NextResponse } from 'next/server'
import { adminLogout } from '@/lib/auth'
import { createApiResponse } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    // 从请求头或body中获取token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || 
                  (await request.json().catch(() => ({})))?.token

    if (!token) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '未提供认证令牌'),
        { status: 400 }
      )
    }

    // 执行登出
    const result = await adminLogout(token)

    if (result.success) {
      return NextResponse.json(
        createApiResponse(true, {}, '登出成功')
      )
    } else {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '登出失败'),
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('管理员登出API错误:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}