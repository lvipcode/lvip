import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'

// Admin authentication middleware
async function validateAdminAuth(request: NextRequest): Promise<{ valid: boolean; error?: string; adminId?: string }> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: '缺少管理员认证令牌' }
  }

  const token = authHeader.substring(7)
  
  // In production, validate JWT token here
  // For now, simple token check
  if (token !== process.env.ADMIN_TOKEN) {
    return { valid: false, error: '无效的管理员令牌' }
  }

  return { valid: true, adminId: 'admin' }
}

// GET - List redemption codes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') || 'all'
    const search = url.searchParams.get('search') || ''
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        createApiResponse(false, null, null, '分页参数无效'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call database function to get redemption codes
    const { data, error } = await supabase.rpc('admin_get_redemption_codes', {
      p_page: page,
      p_limit: limit,
      p_status: status,
      p_search: search.trim()
    })

    if (error) {
      console.error('Database error during admin codes query:', error)
      return NextResponse.json(
        createApiResponse(false, null, null, '查询失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(true, {
          codes: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        })
      )
    }

    const result = data[0]
    const totalPages = Math.ceil((result.total_count || 0) / limit)
    
    return NextResponse.json(
      createApiResponse(true, {
        codes: result.codes || [],
        pagination: {
          page,
          limit,
          total: result.total_count || 0,
          totalPages
        }
      })
    )

  } catch (error) {
    console.error('Unexpected error in admin codes query:', error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}

// POST - Create new redemption code
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      code,
      maxUses = 1,
      dailyLimit = 5,
      singleLimit = 500,
      expiresAt,
      description = ''
    } = body

    // Input validation
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码不能为空'),
        { status: 400 }
      )
    }

    if (code.length < 6 || code.length > 50) {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码长度必须在6-50字符之间'),
        { status: 400 }
      )
    }

    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      return NextResponse.json(
        createApiResponse(false, null, null, '最大使用次数必须在1-10000之间'),
        { status: 400 }
      )
    }

    if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) {
      return NextResponse.json(
        createApiResponse(false, null, null, '每日限制必须在1-100之间'),
        { status: 400 }
      )
    }

    if (!Number.isInteger(singleLimit) || singleLimit < 1 || singleLimit > 10000) {
      return NextResponse.json(
        createApiResponse(false, null, null, '单次限制必须在1-10000之间'),
        { status: 400 }
      )
    }

    // Validate expiration date
    let expirationDate = null
    if (expiresAt) {
      expirationDate = new Date(expiresAt)
      if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
        return NextResponse.json(
          createApiResponse(false, null, null, '过期时间无效或已过期'),
          { status: 400 }
        )
      }
    }

    const supabase = createServerSupabase()
    
    // Call database function to create redemption code
    const { data, error } = await supabase.rpc('admin_create_redemption_code', {
      p_code: code.trim().toUpperCase(),
      p_max_uses: maxUses,
      p_daily_limit: dailyLimit,
      p_single_limit: singleLimit,
      p_expires_at: expirationDate?.toISOString() || null,
      p_description: description.trim(),
      p_admin_id: authResult.adminId
    })

    if (error) {
      console.error('Database error during code creation:', error)
      
      if (error.message.includes('duplicate') || error.message.includes('already exists')) {
        return NextResponse.json(
          createApiResponse(false, null, null, '兑换码已存在'),
          { status: 400 }
        )
      }

      return NextResponse.json(
        createApiResponse(false, null, null, '创建失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '创建失败'),
        { status: 400 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log successful creation
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'admin_action',
      user_ip: clientIP,
      message: '管理员创建兑换码',
      details: {
        adminId: authResult.adminId,
        code: code.trim().toUpperCase(),
        maxUses,
        dailyLimit,
        singleLimit
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        codeId: result.code_id,
        code: result.code,
        message: result.message
      })
    )

  } catch (error) {
    console.error('Unexpected error in code creation:', error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}

// PUT - Update redemption code
export async function PUT(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await validateAdminAuth(request)
    if (!authResult.valid) {
      return NextResponse.json(
        createApiResponse(false, null, null, authResult.error),
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      codeId,
      status,
      maxUses,
      dailyLimit,
      singleLimit,
      expiresAt,
      description
    } = body

    // Input validation
    if (!codeId || typeof codeId !== 'string') {
      return NextResponse.json(
        createApiResponse(false, null, null, '代码ID不能为空'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Call database function to update redemption code
    const { data, error } = await supabase.rpc('admin_update_redemption_code', {
      p_code_id: codeId,
      p_status: status,
      p_max_uses: maxUses,
      p_daily_limit: dailyLimit,
      p_single_limit: singleLimit,
      p_expires_at: expiresAt,
      p_description: description,
      p_admin_id: authResult.adminId
    })

    if (error) {
      console.error('Database error during code update:', error)
      return NextResponse.json(
        createApiResponse(false, null, null, '更新失败，请稍后重试'),
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        createApiResponse(false, null, null, '兑换码不存在'),
        { status: 404 }
      )
    }

    const result = data[0]
    
    if (!result.success) {
      return NextResponse.json(
        createApiResponse(false, null, null, result.message),
        { status: 400 }
      )
    }

    // Log successful update
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'admin_action',
      user_ip: clientIP,
      message: '管理员更新兑换码',
      details: {
        adminId: authResult.adminId,
        codeId,
        changes: { status, maxUses, dailyLimit, singleLimit }
      }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(true, {
        success: true,
        codeId: result.code_id,
        message: result.message
      })
    )

  } catch (error) {
    console.error('Unexpected error in code update:', error)
    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误'),
      { status: 500 }
    )
  }
}