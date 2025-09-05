import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

// 需要管理员权限的路径
const ADMIN_PROTECTED_PATHS = [
  '/admin/dashboard',
  '/admin/codes',
  '/admin/orders',
  '/api/admin/codes',
  '/api/admin/orders',
  '/api/admin/logout'
]

// 检查路径是否需要管理员权限
export function isAdminProtectedPath(pathname: string): boolean {
  return ADMIN_PROTECTED_PATHS.some(path => pathname.startsWith(path))
}

// 管理员认证中间件
export async function adminAuthMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 跳过不需要保护的路径
  if (!isAdminProtectedPath(pathname)) {
    return NextResponse.next()
  }

  // 跳过登录页面
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  try {
    // 从 Cookie 中获取令牌
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
      // 如果是API请求，返回401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: '未认证的请求' },
          { status: 401 }
        )
      }
      
      // 如果是页面请求，重定向到登录页
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // 验证令牌
    const verification = await verifySessionToken(token)
    
    if (!verification.valid) {
      // 清除无效的令牌
      const response = pathname.startsWith('/api/') 
        ? NextResponse.json(
            { success: false, error: '令牌无效或已过期' },
            { status: 401 }
          )
        : NextResponse.redirect(new URL('/admin/login', request.url))
      
      response.cookies.delete('admin_token')
      return response
    }

    // 在请求头中添加用户信息
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-admin-user', JSON.stringify(verification.user))

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })

  } catch (error) {
    console.error('管理员认证中间件错误:', error)
    
    const response = pathname.startsWith('/api/') 
      ? NextResponse.json(
          { success: false, error: '认证失败' },
          { status: 500 }
        )
      : NextResponse.redirect(new URL('/admin/login', request.url))
    
    response.cookies.delete('admin_token')
    return response
  }
}

// 获取当前管理员用户（从请求头中）
export function getAdminUserFromHeaders(request: NextRequest) {
  try {
    const userHeader = request.headers.get('x-admin-user')
    return userHeader ? JSON.parse(userHeader) : null
  } catch {
    return null
  }
}