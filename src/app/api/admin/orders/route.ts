import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'
import { getAdminUserFromHeaders } from '@/middleware/admin-auth'

// 获取订单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search')

    const supabase = createServerSupabase()

    // 构建查询 - 先简单查询订单
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    // 应用过滤条件
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`)
    }

    // 获取总数
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    // 分页查询
    const offset = (page - 1) * limit
    const { data: orders, error } = await query
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json(
      createApiResponse(true, {
        orders: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      })
    )

  } catch (error) {
    console.error('获取订单列表失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '获取订单列表失败'),
      { status: 500 }
    )
  }
}

// 创建新订单
export async function POST(request: NextRequest) {
  try {
    // const adminUser = getAdminUserFromHeaders(request) // TODO: 实现权限检查
    const {
      customerName,
      customerEmail,
      customerPhone,
      quantity,
      usageLimit,
      unitPrice,
      notes
    } = await request.json()

    if (!customerName || !customerEmail || !quantity || !usageLimit) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '客户信息、数量和使用次数不能为空'),
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

    // 生成订单号
    const orderNumber = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    
    // 计算总金额
    const price = parseFloat(unitPrice) || 0
    const totalAmount = price * quantity

    // 创建订单记录
    const { data: order, error: orderError } = await (supabase as any)
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        product_type: 'redemption_codes',
        quantity,
        usage_limit: usageLimit,
        unit_price: price,
        total_amount: totalAmount,
        status: 'pending',
        notes
      })
      .select()
      .single()

    if (orderError) {
      throw orderError
    }

    return NextResponse.json(
      createApiResponse(true, {
        order,
        message: `订单 ${orderNumber} 创建成功`
      }, '订单创建成功')
    )

  } catch (error) {
    console.error('创建订单失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '创建订单失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}