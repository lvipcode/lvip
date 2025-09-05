import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface RouteParams {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { taskId } = await params
    
    if (!taskId) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务ID不能为空'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Get task and check if it's completed
    const { data: task, error: taskError } = await supabase
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务不存在'),
        { status: 404 }
      )
    }

    // Check if task has results
    if (!['completed', 'partial'].includes((task as any).status)) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, `任务还未完成，当前状态：${(task as any).status}`),
        { status: 400 }
      )
    }

    // Get task results
    const { data: results, error: resultsError } = await supabase
      .from('task_results')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (resultsError) {
      console.error('Error fetching results:', resultsError)
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '获取结果失败'),
        { status: 500 }
      )
    }

    if (!results || results.length === 0) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务暂无结果数据'),
        { status: 404 }
      )
    }

    const resultData = results[0]
    const allResults = Array.isArray((resultData as any).result_data) ? (resultData as any).result_data : []

    if (allResults.length === 0) {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务结果为空'),
        { status: 404 }
      )
    }

    // Prepare data for Excel
    const excelData = allResults.map((result: any, index: number) => ({
      '序号': index + 1,
      '姓名': result.name || '',
      '公司': result.company || '',
      '职位': result.position || '',
      '工作经验': result.experience || '',
      '关于': result.about || '',
      '位置': result.location || '',
      'LinkedIn链接': result.linkedinUrl || '',
      '数据质量': result.dataQuality ? `${Math.round(result.dataQuality * 100)}%` : '',
      '提取时间': result.extractedAt ? new Date(result.extractedAt).toLocaleString('zh-CN') : ''
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Add main data sheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    const colWidths = [
      { wch: 8 },  // 序号
      { wch: 20 }, // 姓名
      { wch: 30 }, // 公司
      { wch: 25 }, // 职位
      { wch: 15 }, // 工作经验
      { wch: 50 }, // 关于
      { wch: 20 }, // 位置
      { wch: 40 }, // LinkedIn链接
      { wch: 12 }, // 数据质量
      { wch: 20 }  // 提取时间
    ]
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'LinkedIn数据')

    // Add summary sheet
    const summaryData = [
      { '项目': '任务ID', '值': taskId },
      { '项目': '搜索参数', '值': JSON.stringify((task as any).search_params || {}, null, 2) },
      { '项目': '任务状态', '值': (task as any).status },
      { '项目': '处理数量', '值': (task as any).processed_count || 0 },
      { '项目': '目标数量', '值': (task as any).max_results || 0 },
      { '项目': '实际结果', '值': allResults.length },
      { '项目': '平均质量评分', '值': (resultData as any).data_quality_score ? `${Math.round((resultData as any).data_quality_score * 100)}%` : '未知' },
      { '项目': '开始时间', '值': (task as any).started_at ? new Date((task as any).started_at).toLocaleString('zh-CN') : '未知' },
      { '项目': '完成时间', '值': (task as any).completed_at ? new Date((task as any).completed_at).toLocaleString('zh-CN') : '未完成' },
      { '项目': '处理插件', '值': (task as any).assigned_plugin_id || '未知' },
      { '项目': '导出时间', '值': new Date().toLocaleString('zh-CN') }
    ]
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData)
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 50 }]
    
    XLSX.utils.book_append_sheet(wb, summaryWs, '任务信息')

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `linkedin_data_${taskId.slice(0, 8)}_${timestamp}.xlsx`

    // Log export activity (temporarily disabled for build)
    console.log('Excel文件导出成功', { taskId, result_count: allResults.length })

    // Return Excel file
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': excelBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Unexpected error in Excel export:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log error (temporarily disabled for build)
    console.error('Excel导出API意外错误', error)

    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '导出失败，请稍后重试'),
      { status: 500 }
    )
  }
}