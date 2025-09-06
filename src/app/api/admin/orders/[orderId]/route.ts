import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'
import { getAdminUserFromHeaders } from '@/middleware/admin-auth'

interface RouteParams {
  params: Promise<{
    orderId: string
  }>
}

// 获取订单详情
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '订单ID不能为空'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        redemption_code_batches (
          id,
          batch_name,
          generated_count,
          used_count
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '订单不存在'),
        { status: 404 }
      )
    }

    // 如果订单已关联批次，获取兑换码列表
    let codes = null
    if ((order as any).batch_id) {
      const { data: codesData } = await supabase
        .from('redemption_codes')
        .select('code, total_uses, used_count, status, created_at')
        .eq('batch_id', (order as any).batch_id)
        .order('created_at', { ascending: true })
      
      codes = codesData
    }

    return NextResponse.json(
      createApiResponse(true, {
        order,
        codes
      })
    )

  } catch (error) {
    console.error('获取订单详情失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '获取订单详情失败'),
      { status: 500 }
    )
  }
}

// 更新订单状态
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params
    const adminUser = getAdminUserFromHeaders(request)
    const { status, notes } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '订单ID不能为空'),
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '状态不能为空'),
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'paid', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '无效的状态值'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    // 获取当前订单信息
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !currentOrder) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '订单不存在'),
        { status: 404 }
      )
    }

    // 准备更新数据
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (notes) {
      updateData.notes = notes
    }

    // 如果状态改为已支付，记录支付时间
    if (status === 'paid' && (currentOrder as any).status !== 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    // 如果状态改为已交付，需要生成兑换码
    if (status === 'delivered' && (currentOrder as any).status !== 'delivered') {
      updateData.delivered_at = new Date().toISOString()

      // 如果还没有关联批次，创建兑换码
      if (!(currentOrder as any).batch_id) {
        const batchName = `订单_${(currentOrder as any).order_number}`
        
        const { data: batchId, error: generateError } = await (supabase as any)
          .rpc('generate_redemption_codes', {
            p_batch_name: batchName,
            p_quantity: (currentOrder as any).quantity,
            p_usage_limit: (currentOrder as any).usage_limit,
            p_notes: `订单 ${(currentOrder as any).order_number} 的兑换码`,
            p_created_by: adminUser?.username || 'admin'
          })

        if (generateError) {
          throw generateError
        }

        updateData.batch_id = batchId
      }
    }

    // 更新订单
    const { data: updatedOrder, error: updateError } = await (supabase as any)
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json(
      createApiResponse(true, {
        order: updatedOrder,
        message: `订单状态已更新为: ${status}`
      }, '订单更新成功')
    )

  } catch (error) {
    console.error('更新订单失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '更新订单失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}