import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

// CORS headers for SSE
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  'Access-Control-Max-Age': '86400'
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

// SSE连接管理
const connections = new Map<string, {
  controller: ReadableStreamDefaultController
  pluginId: string
  lastPing: number
}>()

// 定期清理过期连接
setInterval(() => {
  const now = Date.now()
  for (const [id, conn] of connections.entries()) {
    if (now - conn.lastPing > 300000) { // 5分钟无活动则断开
      try {
        conn.controller.close()
      } catch (error) {
        console.error('Error closing expired connection:', error)
      }
      connections.delete(id)
    }
  }
}, 60000) // 每分钟检查一次

// 任务分配器 - 定期检查待分配任务
async function processTaskQueue() {
  try {
    const supabase = createServerSupabase()
    
    // 获取待分配的任务
    const { data: pendingTasks, error } = await supabase
      .from('task_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)
    
    if (error || !pendingTasks || pendingTasks.length === 0) {
      return
    }

    // 获取在线插件
    const { data: onlinePlugins } = await supabase
      .from('plugin_registry')
      .select('*')
      .in('status', ['online', 'busy'])
      .gte('last_heartbeat', new Date(Date.now() - 120000).toISOString()) // 2分钟内活跃
      .order('performance_score', { ascending: false })

    if (!onlinePlugins || onlinePlugins.length === 0) {
      return
    }

    // 为每个任务分配插件
    for (const task of pendingTasks) {
      // 选择最佳插件（性能评分最高且支持该任务类型）
      const bestPlugin = onlinePlugins.find(plugin => 
        plugin.capabilities.includes(task.task_type)
      )

      if (!bestPlugin) {
        continue
      }

      // 分配任务给插件
      const { error: updateError } = await supabase
        .from('task_queue')
        .update({
          status: 'assigned',
          assigned_plugin_id: bestPlugin.plugin_id,
          assigned_at: new Date().toISOString(),
          timeout_at: new Date(Date.now() + 600000).toISOString() // 10分钟超时
        })
        .eq('id', task.id)
        .eq('status', 'pending') // 确保任务仍然是pending状态

      if (updateError) {
        console.error('Error assigning task:', updateError)
        continue
      }

      // 更新插件状态为忙碌
      await supabase
        .from('plugin_registry')
        .update({ status: 'busy' })
        .eq('plugin_id', bestPlugin.plugin_id)

      // 通过SSE推送任务给插件
      const taskMessage = {
        type: 'task_assignment',
        taskId: task.id,
        taskType: task.task_type,
        searchParams: task.search_params,
        maxResults: task.max_results,
        timeout: 600000 // 10分钟
      }

      // 发送给对应的插件连接
      for (const [connectionId, connection] of connections.entries()) {
        if (connection.pluginId === bestPlugin.plugin_id) {
          try {
            const encoder = new TextEncoder()
            const data = `data: ${JSON.stringify(taskMessage)}\n\n`
            connection.controller.enqueue(encoder.encode(data))
            connection.lastPing = Date.now()
          } catch (error) {
            console.error('Error sending task to plugin:', error)
            connections.delete(connectionId)
          }
          break
        }
      }

      // 记录任务分配日志
      await supabase.from('system_logs').insert({
        log_level: 'info',
        log_type: 'task_event',
        task_id: task.id,
        plugin_id: bestPlugin.plugin_id,
        message: '任务已分配给插件',
        details: {
          task_type: task.task_type,
          max_results: task.max_results,
          plugin_performance: bestPlugin.performance_score
        }
      }).catch(console.error)
    }
  } catch (error) {
    console.error('Error in task queue processing:', error)
  }
}

// 每10秒检查一次任务队列
setInterval(processTaskQueue, 10000)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pluginId = searchParams.get('pluginId')

  if (!pluginId) {
    return new Response('Plugin ID is required', { status: 400, headers: CORS_HEADERS })
  }

  // 验证插件ID格式
  if (typeof pluginId !== 'string' || pluginId.length < 3 || pluginId.length > 100) {
    return new Response('Invalid plugin ID', { status: 400, headers: CORS_HEADERS })
  }

  try {
    const supabase = createServerSupabase()
    
    // 验证插件是否注册
    const { data: plugin, error: pluginError } = await supabase
      .from('plugin_registry')
      .select('*')
      .eq('plugin_id', pluginId)
      .single()

    if (pluginError || !plugin) {
      return new Response('Plugin not registered', { status: 401, headers: CORS_HEADERS })
    }

    // 创建SSE流
    const stream = new ReadableStream({
      start(controller) {
        const connectionId = `${pluginId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        // 注册连接
        connections.set(connectionId, {
          controller,
          pluginId,
          lastPing: Date.now()
        })

        // 发送连接确认
        const encoder = new TextEncoder()
        const welcomeMessage = {
          type: 'connection_established',
          pluginId,
          connectionId,
          timestamp: new Date().toISOString()
        }
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcomeMessage)}\n\n`))

        // 定期发送心跳
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = {
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`))
            
            // 更新连接最后ping时间
            const conn = connections.get(connectionId)
            if (conn) {
              conn.lastPing = Date.now()
            }
          } catch (error) {
            clearInterval(heartbeatInterval)
            connections.delete(connectionId)
          }
        }, 30000) // 每30秒发送心跳

        // 清理函数
        const cleanup = () => {
          clearInterval(heartbeatInterval)
          connections.delete(connectionId)
        }

        // 监听连接关闭
        request.signal.addEventListener('abort', cleanup)
        
        // 当控制器关闭时清理
        controller.cancel = cleanup
      }
    })

    // 记录SSE连接日志
    await supabase.from('system_logs').insert({
      log_level: 'info',
      log_type: 'plugin_event',
      plugin_id: pluginId,
      message: '插件SSE连接已建立',
      details: { connection_time: new Date().toISOString() }
    }).catch(console.error)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    console.error('Error establishing SSE connection:', error)
    return new Response('Internal server error', { status: 500, headers: CORS_HEADERS })
  }
}

// 健康检查端点
export async function HEAD(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'X-SSE-Connections': connections.size.toString(),
      'X-Service-Status': 'healthy'
    }
  })
}