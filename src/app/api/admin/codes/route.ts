import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'
import { getAdminUserFromHeaders } from '@/middleware/admin-auth'

// GET - List redemption codes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'all'
    const batchId = searchParams.get('batch_id')
    const search = searchParams.get('search')

    const supabase = createServerSupabase()
    
    // 构建查询
    let query = supabase
      .from('redemption_codes')
      .select(`
        *,
        redemption_code_batches (
          batch_name,
          usage_limit,
          created_by
        )
      `)
      .order('created_at', { ascending: false })

    // 应用过滤条件
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (batchId) {
      query = query.eq('batch_id', batchId)
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,batch_name.ilike.%${search}%`)
    }

    // 获取总数
    const { count } = await supabase
      .from('redemption_codes')
      .select('*', { count: 'exact', head: true })

    // 分页查询
    const offset = (page - 1) * limit
    const { data: codes, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json(
      createApiResponse(true, {
        codes: codes || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    )

  } catch (error) {
    console.error('获取兑换码列表失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '获取兑换码列表失败'),
      { status: 500 }
    )
  }
}

// POST - Generate redemption codes in batch
export async function POST(request: NextRequest) {
  try {
    const adminUser = getAdminUserFromHeaders(request)
    const { batchName, quantity, usageLimit, notes } = await request.json()

    if (!batchName || !quantity || !usageLimit) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '批次名称、数量和使用次数不能为空'),
        { status: 400 }
      )
    }

    if (quantity <= 0 || quantity > 1000) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '数量必须在1-1000之间'),
        { status: 400 }
      )
    }

    if (usageLimit <= 0 || usageLimit > 100) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '使用次数必须在1-100之间'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    // 调用数据库函数生成兑换码
    const { data: batchId, error } = await (supabase as any)
      .rpc('generate_redemption_codes', {
        p_batch_name: batchName,
        p_quantity: quantity,
        p_usage_limit: usageLimit,
        p_notes: notes,
        p_created_by: adminUser?.username || 'admin'
      })

    if (error) {
      throw error
    }

    // 获取生成的兑换码信息
    const { data: batch } = await supabase
      .from('redemption_code_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    const { data: codes } = await supabase
      .from('redemption_codes')
      .select('code, total_uses, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    return NextResponse.json(
      createApiResponse(true, {
        batch,
        codes,
        message: `成功生成 ${quantity} 个兑换码`
      }, '兑换码生成成功')
    )

  } catch (error) {
    console.error('生成兑换码失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '生成兑换码失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}