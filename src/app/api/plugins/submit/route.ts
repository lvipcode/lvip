import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createApiResponse, calculateDataQuality, createCorsResponse, handleCorsOptions } from '@/lib/utils'
import type { LinkedInProfile } from '@/types'

// Handle preflight requests
export async function OPTIONS() {
  return handleCorsOptions()
}

interface SubmitRequest {
  taskId: string
  pluginId: string
  results: LinkedInProfile[]
  status: 'completed' | 'partial' | 'failed'
  processedCount: number
  totalCount: number
  errorMessage?: string
}

function validateSubmitData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '提交数据不能为空' }
  }

  // Task ID validation
  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: '任务ID不能为空' }
  }

  // Plugin ID validation
  if (!data.pluginId || typeof data.pluginId !== 'string') {
    return { valid: false, error: '插件ID不能为空' }
  }

  // Results validation
  if (!Array.isArray(data.results)) {
    return { valid: false, error: '结果数据必须是数组' }
  }

  if (data.results.length > 1000) {
    return { valid: false, error: '单次提交结果不能超过1000条' }
  }

  // Status validation
  const validStatuses = ['completed', 'partial', 'failed']
  if (!data.status || !validStatuses.includes(data.status)) {
    return { valid: false, error: '无效的任务状态' }
  }

  // Count validations
  if (!Number.isInteger(data.processedCount) || data.processedCount < 0) {
    return { valid: false, error: '处理数量必须为非负整数' }
  }

  if (!Number.isInteger(data.totalCount) || data.totalCount < 0) {
    return { valid: false, error: '总数量必须为非负整数' }
  }

  if (data.processedCount > data.totalCount) {
    return { valid: false, error: '处理数量不能超过总数量' }
  }

  // Validate individual results
  for (let i = 0; i < data.results.length; i++) {
    const result = data.results[i]
    if (!result || typeof result !== 'object') {
      return { valid: false, error: `第${i+1}条结果数据格式无效` }
    }

    // Required fields
    if (!result.name || typeof result.name !== 'string') {
      return { valid: false, error: `第${i+1}条结果缺少姓名` }
    }

    if (!result.company || typeof result.company !== 'string') {
      return { valid: false, error: `第${i+1}条结果缺少公司` }
    }

    if (!result.position || typeof result.position !== 'string') {
      return { valid: false, error: `第${i+1}条结果缺少职位` }
    }

    if (!result.linkedinUrl || typeof result.linkedinUrl !== 'string') {
      return { valid: false, error: `第${i+1}条结果缺少LinkedIn链接` }
    }

    // Validate LinkedIn URL format
    if (!result.linkedinUrl.includes('linkedin.com')) {
      return { valid: false, error: `第${i+1}条结果LinkedIn链接格式无效` }
    }
  }

  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip ||
                    'unknown'

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      taskId, 
      pluginId, 
      results, 
      status, 
      processedCount, 
      totalCount,
      errorMessage 
    } = body

    // Validate input data
    const validation = validateSubmitData({
      taskId,
      pluginId,
      results,
      status,
      processedCount,
      totalCount,
      errorMessage
    })

    if (!validation.valid) {
      return createCorsResponse(
        createApiResponse(false, null, null, validation.error),
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    
    // Verify task exists and is assigned to this plugin
    const { data: task, error: taskError } = await supabase
      .from('task_queue')
      .select('*')
      .eq('id', taskId)
      .eq('assigned_plugin_id', pluginId)
      .in('status', ['assigned', 'processing'])
      .single()

    if (taskError) {
      console.error('Error fetching task:', taskError)
      return createCorsResponse(
        createApiResponse(false, null, null, '任务不存在或无权限提交'),
        { status: 404 }
      )
    }

    if (!task) {
      return createCorsResponse(
        createApiResponse(false, null, null, '任务不存在或已完成'),
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    
    // Process and calculate quality scores for results
    const processedResults = results.map((result: any) => ({
      ...result,
      extractedAt: result.extractedAt || now,
      dataQuality: calculateDataQuality(result)
    }))

    // Calculate overall quality score
    const averageQuality = processedResults.length > 0 ? 
      processedResults.reduce((sum, r) => sum + r.dataQuality, 0) / processedResults.length : 0

    // Start database transaction
    const { error: transactionError } = await supabase.rpc('begin')
    if (transactionError) {
      console.error('Failed to start transaction:', transactionError)
    }

    try {
      // Update task status
      const { error: updateTaskError } = await supabase
        .from('task_queue')
        .update({
          status: status,
          processed_count: processedCount,
          completed_at: status === 'completed' || status === 'failed' ? now : null
        })
        .eq('id', taskId)
        .eq('assigned_plugin_id', pluginId)

      if (updateTaskError) {
        await supabase.rpc('rollback')
        throw new Error(`Failed to update task: ${updateTaskError.message}`)
      }

      // Insert results if any
      if (processedResults.length > 0) {
        const { error: insertResultsError } = await supabase
          .from('task_results')
          .insert({
            task_id: taskId,
            plugin_id: pluginId,
            result_data: processedResults,
            result_count: processedResults.length,
            data_quality_score: averageQuality
          })

        if (insertResultsError) {
          await supabase.rpc('rollback')
          throw new Error(`Failed to insert results: ${insertResultsError.message}`)
        }
      }

      // Update plugin statistics
      const isSuccess = status === 'completed' || (status === 'partial' && processedResults.length > 0)
      
      const { error: updatePluginError } = await supabase
        .from('plugin_registry')
        .update({
          status: 'online',
          total_tasks: task.total_tasks + 1,
          successful_tasks: task.successful_tasks + (isSuccess ? 1 : 0),
          last_heartbeat: now
        })
        .eq('plugin_id', pluginId)

      if (updatePluginError) {
        console.error('Failed to update plugin stats:', updatePluginError)
        // Don't rollback for plugin stats error, it's not critical
      }

      // Update redemption code usage count if task completed
      if (status === 'completed') {
        const { error: updateCodeError } = await supabase
          .from('redemption_codes')
          .update({
            used_count: supabase.sql`used_count + 1`
          })
          .eq('id', task.redemption_code_id)

        if (updateCodeError) {
          console.error('Failed to update redemption code usage:', updateCodeError)
          // Don't rollback for code usage error
        }
      }

      // Commit transaction
      const { error: commitError } = await supabase.rpc('commit')
      if (commitError) {
        console.error('Failed to commit transaction:', commitError)
      }

    } catch (error) {
      await supabase.rpc('rollback')
      throw error
    }

    // Log successful submission
    const { error: logError1 } = await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'task_event',
      task_id: taskId,
      plugin_id: pluginId,
      user_ip: clientIP,
      message: `任务结果提交成功 - ${status}`,
      details: {
        processed_count: processedCount,
        total_count: totalCount,
        result_count: processedResults.length,
        average_quality: averageQuality,
        error_message: errorMessage || null
      }
    })
    if (logError1) console.error('Failed to log submission success:', logError1)

    const responseData = {
      success: true,
      taskId,
      status,
      processedCount,
      resultCount: processedResults.length,
      averageQuality: Math.round(averageQuality * 100) / 100,
      message: `任务${status === 'completed' ? '完成' : status === 'partial' ? '部分完成' : '失败'}`
    }

    return createCorsResponse(createApiResponse(true, responseData))

  } catch (error) {
    console.error('Unexpected error in task result submission:', error)
    
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const supabase = createServerSupabase()
    
    const { error: logError2 } = await supabase.from('system_logs').insert({
      log_level: 'error',
      log_type: 'plugin_event',
      user_ip: clientIP,
      message: '任务结果提交API意外错误',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    })
    if (logError2) console.error('Failed to log submission error:', logError2)

    return createCorsResponse(
      createApiResponse(false, null, null, '服务器内部错误，请稍后重试'),
      { status: 500 }
    )
  }
}