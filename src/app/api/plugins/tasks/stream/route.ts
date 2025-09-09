import { NextRequest } from 'next/server'

// 全局插件连接管理
const pluginConnections = new Map<string, ReadableStreamDefaultController>()

// SSE消息发送辅助函数
function sendSSEMessage(controller: ReadableStreamDefaultController, type: string, data: any) {
  try {
    const message = JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      ...data
    })
    controller.enqueue(`data: ${message}\n\n`)
  } catch (error) {
    console.error('发送SSE消息失败:', error)
  }
}

// 广播消息到所有连接的插件
function broadcastMessage(type: string, data: any, excludePluginId?: string) {
  console.log(`广播消息到 ${pluginConnections.size} 个插件:`, type, data)
  
  for (const [pluginId, controller] of pluginConnections.entries()) {
    if (excludePluginId && pluginId === excludePluginId) continue
    
    try {
      sendSSEMessage(controller, type, { ...data, targetPlugin: pluginId })
    } catch (error) {
      console.error(`向插件 ${pluginId} 发送广播消息失败:`, error)
      pluginConnections.delete(pluginId)
    }
  }
}

// 向特定插件发送消息
function sendToPlugin(pluginId: string, type: string, data: any) {
  const controller = pluginConnections.get(pluginId)
  if (controller) {
    sendSSEMessage(controller, type, data)
    return true
  }
  return false
}

// 这些函数供此文件内部使用，不导出以符合Next.js API路由约束

export async function GET(request: NextRequest) {
  try {
    // Get plugin ID from URL params or headers
    const pluginId = request.nextUrl.searchParams.get('pluginId') || 
                    request.headers.get('x-plugin-id')

    if (!pluginId) {
      return new Response('Missing plugin ID', { status: 400 })
    }

    console.log(`插件 ${pluginId} 建立SSE连接`)

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // 将控制器保存到全局连接管理器
        pluginConnections.set(pluginId, controller)
        
        // Send initial connection message
        sendSSEMessage(controller, 'connection', {
          message: 'Connected to task stream',
          pluginId,
          serverVersion: '1.0.0'
        })

        // TODO: 实际项目中这里会查询数据库中的待分配任务
        // 现在发送系统状态信息
        setTimeout(() => {
          sendSSEMessage(controller, 'status', {
            message: '系统准备就绪，等待任务分配',
            queuedTasks: 0,
            serverLoad: 'low'
          })
        }, 1000)

        // Keep-alive heartbeat (每30秒)
        const keepAlive = setInterval(() => {
          try {
            sendSSEMessage(controller, 'keepalive', {
              message: 'heartbeat',
              connectedPlugins: pluginConnections.size
            })
          } catch (error) {
            console.error('Keep-alive error:', error)
            clearInterval(keepAlive)
            pluginConnections.delete(pluginId)
            controller.close()
          }
        }, 30000)

        // Clean up on stream close
        request.signal?.addEventListener('abort', () => {
          clearInterval(keepAlive)
          pluginConnections.delete(pluginId)
          controller.close()
          console.log(`插件 ${pluginId} 断开SSE连接`)
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'x-plugin-id, authorization',
      }
    })

  } catch (error) {
    console.error('Unexpected error in task stream:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}