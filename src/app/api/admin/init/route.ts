import { NextResponse } from 'next/server'
import { createDefaultAdmin } from '@/lib/auth'
import { createApiResponse } from '@/lib/utils'

// 初始化数据库表结构和默认管理员账号
export async function POST() {
  try {
    // 直接创建默认管理员账号
    // 数据库表结构需要在Supabase控制台手动创建
    await createDefaultAdmin()
    
    return NextResponse.json(
      createApiResponse(true, {
        message: '默认管理员账号已创建',
        credentials: {
          username: 'admin',
          password: 'admin123'
        },
        note: '数据库表结构需要在Supabase控制台手动执行05-admin-system-tables.sql'
      }, '管理员初始化成功')
    )

  } catch (error) {
    console.error('初始化系统失败:', error)
    return NextResponse.json(
      createApiResponse(false, { error: error instanceof Error ? error.message : '未知错误' }, undefined, '初始化系统失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}