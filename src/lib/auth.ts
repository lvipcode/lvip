import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { createServerSupabase } from '@/lib/supabase'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secure_jwt_secret'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24小时

export interface AdminUser {
  id: string
  username: string
  role: string
  lastLogin?: string
}

export interface AdminSession {
  id: string
  adminUserId: string
  sessionToken: string
  expiresAt: string
  ipAddress?: string
  userAgent?: string
}

// 验证管理员登录
export async function verifyAdminLogin(username: string, password: string, ipAddress?: string, userAgent?: string): Promise<{ success: boolean; token?: string; user?: AdminUser; error?: string }> {
  try {
    const supabase = createServerSupabase()
    
    // 查找管理员用户
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !adminUser) {
      return { success: false, error: '用户名或密码错误' }
    }

    // 验证密码
    const passwordMatch = await bcrypt.compare(password, (adminUser as any).password_hash)
    if (!passwordMatch) {
      return { success: false, error: '用户名或密码错误' }
    }

    // 生成会话令牌
    console.log('生成JWT令牌，用户信息:', {
      id: (adminUser as any).id,
      username: (adminUser as any).username,
      role: (adminUser as any).role
    })
    console.log('JWT_SECRET存在:', !!JWT_SECRET)
    
    const sessionToken = jwt.sign(
      { 
        adminId: (adminUser as any).id, 
        username: (adminUser as any).username,
        role: (adminUser as any).role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    console.log('生成的sessionToken:', sessionToken ? 'TOKEN_EXISTS' : 'TOKEN_IS_UNDEFINED')

    // 计算过期时间
    const expiresAt = new Date(Date.now() + SESSION_DURATION)

    // 保存会话到数据库
    const { error: sessionError } = await (supabase as any)
      .from('admin_sessions')
      .insert({
        admin_user_id: (adminUser as any).id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      })

    if (sessionError) {
      console.error('保存会话失败:', sessionError)
    }

    // 更新最后登录时间
    await (supabase as any)
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', (adminUser as any).id)

    const result = {
      success: true,
      token: sessionToken,
      user: {
        id: (adminUser as any).id,
        username: (adminUser as any).username,
        role: (adminUser as any).role,
        lastLogin: (adminUser as any).last_login
      }
    }
    
    console.log('verifyAdminLogin返回结果:', {
      success: result.success,
      hasToken: !!result.token,
      tokenLength: result.token ? result.token.length : 0
    })
    
    return result

  } catch (error) {
    console.error('登录验证失败:', error)
    return { success: false, error: '登录失败，请稍后重试' }
  }
}

// 验证会话令牌
export async function verifySessionToken(token: string): Promise<{ valid: boolean; user?: AdminUser; error?: string }> {
  try {
    // 验证JWT令牌
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    const supabase = createServerSupabase()
    
    // 检查会话是否存在且有效
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select(`
        *,
        admin_users (
          id,
          username,
          role,
          last_login
        )
      `)
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !session) {
      return { valid: false, error: '会话无效或已过期' }
    }

    return {
      valid: true,
      user: {
        id: (session as any).admin_users.id,
        username: (session as any).admin_users.username,
        role: (session as any).admin_users.role,
        lastLogin: (session as any).admin_users.last_login
      }
    }

  } catch (error) {
    console.error('验证会话令牌失败:', error)
    return { valid: false, error: '无效的会话令牌' }
  }
}

// 获取当前管理员用户
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value

    if (!token) {
      return null
    }

    const verification = await verifySessionToken(token)
    return verification.valid ? verification.user || null : null

  } catch (error) {
    console.error('获取当前管理员失败:', error)
    return null
  }
}

// 管理员登出
export async function adminLogout(token: string): Promise<{ success: boolean }> {
  try {
    const supabase = createServerSupabase()
    
    // 删除会话记录
    await supabase
      .from('admin_sessions')
      .delete()
      .eq('session_token', token)

    return { success: true }

  } catch (error) {
    console.error('登出失败:', error)
    return { success: false }
  }
}

// 清理过期会话
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const supabase = createServerSupabase()
    
    await supabase
      .from('admin_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())

  } catch (error) {
    console.error('清理过期会话失败:', error)
  }
}

// 创建默认管理员用户
export async function createDefaultAdmin(): Promise<void> {

  try {
    const supabase = createServerSupabase()
    const passwordHash = await bcrypt.hash('admin123', 12)
    
    // 先删除现有的admin用户（如果存在）
    await (supabase as any)
      .from('admin_users')
      .delete()
      .eq('username', 'admin')

    // 创建新的admin用户
    const { error } = await (supabase as any)
      .from('admin_users')
      .insert({
        username: 'admin',
        password_hash: passwordHash,
        role: 'admin'
      })

    if (error) {
      console.error('创建默认管理员失败:', error)
    } else {
      console.log('默认管理员创建成功 - 用户名: admin, 密码: admin123')
    }

  } catch (error) {
    console.error('创建默认管理员失败:', error)
  }
}