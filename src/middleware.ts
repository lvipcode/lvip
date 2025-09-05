import { NextRequest, NextResponse } from 'next/server'
import { adminAuthMiddleware } from '@/middleware/admin-auth'

export async function middleware(request: NextRequest) {
  // 管理员认证中间件
  const adminAuthResponse = await adminAuthMiddleware(request)
  if (adminAuthResponse.status !== 200) {
    return adminAuthResponse
  }

  // 其他中间件可以在这里添加
  // ...

  return NextResponse.next()
}

// 配置中间件匹配的路径
export const config = {
  matcher: [
    // 管理员路径
    '/admin/:path*',
    '/api/admin/:path*',
    // 排除静态文件
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}