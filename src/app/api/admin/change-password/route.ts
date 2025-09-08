import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'
import { verifySessionToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    // 验证管理员身份
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '未授权访问'),
        { status: 401 }
      )
    }

    // 验证会话令牌
    const verification = await verifySessionToken(token)
    if (!verification.valid || !verification.user) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '会话无效或已过期'),
        { status: 401 }
      )
    }

    // 解析请求体
    const { currentPassword, newPassword } = await request.json().catch(() => ({}))

    // 验证输入
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '请填写当前密码和新密码'),
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '新密码至少需要6位字符'),
        { status: 400 }
      )
    }

    // 连接数据库
    const { createServerSupabase } = await import('@/lib/supabase')
    const supabase = createServerSupabase()

    try {
      // 查询管理员信息
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('id, username, password_hash')
        .eq('id', verification.user.id)
        .single()

      if (adminError || !adminData) {
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '管理员账户不存在'),
          { status: 404 }
        )
      }

      // 验证当前密码
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminData.password_hash)
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '当前密码不正确'),
          { status: 400 }
        )
      }

      // 加密新密码
      const saltRounds = 12
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds)

      // 更新密码
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ 
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminData.id)

      if (updateError) {
        console.error('更新密码失败:', updateError)
        return NextResponse.json(
          createApiResponse(false, undefined, undefined, '密码更新失败'),
          { status: 500 }
        )
      }

      // 记录日志
      try {
        await supabase
          .from('system_logs')
          .insert({
            log_level: 'info',
            log_type: 'password_change',
            user_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            message: '管理员密码修改成功',
            details: { admin_id: adminData.id, username: adminData.username },
            plugin_id: null,
            task_id: null
          })
      } catch (logError) {
        console.warn('日志记录失败:', logError)
      }

      return NextResponse.json(
        createApiResponse(true, { message: '密码修改成功' })
      )

    } catch (dbError) {
      console.error('数据库操作错误:', dbError)
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '数据库操作失败'),
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('修改密码时发生错误:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}