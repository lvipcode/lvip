import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'

// 导出未使用的兑换码
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const batchId = searchParams.get('batch_id')

    const supabase = createServerSupabase()

    // 构建查询 - 获取未使用的兑换码
    let query = supabase
      .from('redemption_codes')
      .select(`
        id,
        code,
        total_uses,
        used_count,
        batch_name,
        created_at,
        status
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (batchId) {
      query = query.eq('batch_id', batchId)
    }

    const { data: codes, error } = await query

    if (error) {
      throw error
    }

    if (!codes || codes.length === 0) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '没有可导出的兑换码'),
        { status: 404 }
      )
    }

    if (format === 'csv') {
      // 生成CSV格式
      const csvHeader = 'Code,Usage_Limit,Used_Count,Batch_Name,Created_At\n'
      const csvRows = codes.map((code: any) => [
        code.code,
        code.total_uses,
        code.used_count,
        code.batch_name || '',
        new Date(code.created_at).toLocaleString('zh-CN')
      ].join(',')).join('\n')
      
      const csvContent = csvHeader + csvRows

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="redemption_codes_${Date.now()}.csv"`,
          'Content-Length': Buffer.byteLength(csvContent, 'utf8').toString()
        }
      })

    } else if (format === 'json') {
      // 生成JSON格式
      const jsonContent = JSON.stringify({
        export_time: new Date().toISOString(),
        total_codes: codes.length,
        codes: codes.map((code: any) => ({
          code: code.code,
          usage_limit: code.total_uses,
          used_count: code.used_count,
          batch_name: code.batch_name,
          created_at: code.created_at
        }))
      }, null, 2)

      return new NextResponse(jsonContent, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="redemption_codes_${Date.now()}.json"`
        }
      })

    } else if (format === 'txt') {
      // 生成纯文本格式（只包含兑换码）
      const txtContent = codes.map((code: any) => code.code).join('\n')

      return new NextResponse(txtContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="redemption_codes_${Date.now()}.txt"`
        }
      })

    } else {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '不支持的导出格式，支持: csv, json, txt'),
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('导出兑换码失败:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '导出兑换码失败'),
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}