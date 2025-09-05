import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, isValidUUID } from '@/lib/utils'

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
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const format = url.searchParams.get('format') || 'json'
    
    // Validate parameters
    if (!taskId || !isValidUUID(taskId)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '无效的任务ID'),
        { status: 400 }
      )
    }

    if (page < 1 || limit < 1 || limit > 1000) {
      return NextResponse.json(
        createApiResponse(false, null, null, '分页参数无效'),
        { status: 400 }
      )
    }

    if (!['json', 'csv', 'excel'].includes(format)) {
      return NextResponse.json(
        createApiResponse(false, null, null, '不支持的导出格式'),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // First check if task exists
    const { data: task, error: taskError } = await supabase
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        createApiResponse(false, null, null, '任务不存在'),
        { status: 404 }
      )
    }

    // Check if task has results
    if (!['completed', 'partial', 'failed'].includes(task.status)) {
      return NextResponse.json(
        createApiResponse(false, null, null, `任务还未完成，当前状态：${task.status}`),
        { status: 400 }
      )
    }

    // Get task results
    const { data, error } = await supabase
      .from('task_results')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Database error during results query:', error)
      
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
      
      // Log error to system logs
      await supabase.from('system_logs').insert({
        log_level: 'error',
        log_type: 'api_request',
        task_id: taskId,
        user_ip: clientIP,
        message: '任务结果查询数据库错误',
        details: { error: error.message, page, limit, format }
      }).catch(console.error)

      return NextResponse.json(
        createApiResponse(false, null, null, '结果查询失败，请稍后重试'),
        { status: 500 }
      )
    }

    let allResults = []
    let averageQuality = 0
    let totalResults = 0

    if (data && data.length > 0) {
      const resultData = data[0]
      allResults = Array.isArray(resultData.result_data) ? resultData.result_data : []
      totalResults = allResults.length
      averageQuality = resultData.data_quality_score || 0

      // Apply pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      allResults = allResults.slice(startIndex, endIndex)
    }

    // Handle CSV export
    if (format === 'csv') {
      const csv = generateCSV(allResults)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="linkedin_results_${taskId}.csv"`
        }
      })
    }

    // Handle Excel export (redirect to export API)
    if (format === 'excel') {
      return NextResponse.json(
        createApiResponse(true, {
          exportUrl: `/api/export/${taskId}`,
          message: '请访问exportUrl获取Excel文件'
        })
      )
    }

    // Default JSON format
    const response = {
      taskId,
      taskStatus: task.status,
      searchParams: task.search_params || {},
      results: allResults,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        hasNext: page * limit < totalResults,
        hasPrevious: page > 1
      },
      quality: {
        averageScore: Math.round(averageQuality * 100) / 100,
        completenessRate: totalResults > 0 ? 
          allResults.filter((r: any) => r.name && r.company && r.position).length / totalResults : 0
      },
      metadata: {
        processedCount: task.processed_count || 0,
        maxResults: task.max_results || 0,
        completedAt: task.completed_at,
        pluginUsed: task.assigned_plugin_id,
        extractedAt: data && data.length > 0 ? data[0].created_at : null
      }
    }

    return NextResponse.json(
      createApiResponse(true, response)
    )

  } catch (error) {
    console.error('Unexpected error in results query:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    // Log unexpected error
    await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'api_request',
      task_id: params.taskId,
      user_ip: clientIP,
      message: '任务结果查询API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    }).catch(console.error)

    return NextResponse.json(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}

// Helper function to generate CSV
function generateCSV(results: any[]): string {
  if (!results || results.length === 0) {
    return 'name,company,position,experience,about,location,linkedinUrl,dataQuality,extractedAt\n'
  }

  const headers = ['name', 'company', 'position', 'experience', 'about', 'location', 'linkedinUrl', 'dataQuality', 'extractedAt']
  const rows = results.map(item => [
    item.name || '',
    item.company || '',
    item.position || '',
    item.experience || '',
    item.about || '',
    item.location || '',
    item.linkedinUrl || '',
    item.dataQuality || 0,
    item.extractedAt || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => {
      // Escape quotes and wrap in quotes if contains comma or quote
      const str = String(field).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(','))
  ].join('\n')

  return '\uFEFF' + csvContent // Add BOM for proper UTF-8 display in Excel
}