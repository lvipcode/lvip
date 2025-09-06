import { NextResponse } from 'next/server'
import { createDefaultAdmin } from '@/lib/auth'
import { createApiResponse } from '@/lib/utils'

// 初始化默认管理员账号
export async function POST() {
  try {
    await createDefaultAdmin()
    
    return NextResponse.json(
      createApiResponse(true, {
        message: '默认管理员账号已创建',
        credentials: {
          username: 'admin',
          password: 'admin123'
        }
      }, '管理员初始化成功')
    )

  } catch (error) {
    console.error('初始化管理员失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '初始化管理员失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}