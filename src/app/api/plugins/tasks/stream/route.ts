import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get plugin ID from URL params or headers
    const pluginId = request.nextUrl.searchParams.get('pluginId') || 
                    request.headers.get('x-plugin-id')

    if (!pluginId) {
      return new Response('Missing plugin ID', { status: 400 })
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const data = JSON.stringify({
          type: 'connection',
          message: 'Connected to task stream',
          pluginId,
          timestamp: new Date().toISOString()
        })

        controller.enqueue(`data: ${data}\n\n`)

        // TODO: Implement real task assignment after database setup
        // For now, send a keep-alive message every 30 seconds
        const keepAlive = setInterval(() => {
          try {
            const keepAliveData = JSON.stringify({
              type: 'keepalive',
              timestamp: new Date().toISOString()
            })
            controller.enqueue(`data: ${keepAliveData}\n\n`)
          } catch (error) {
            console.error('Keep-alive error:', error)
            clearInterval(keepAlive)
            controller.close()
          }
        }, 30000)

        // Clean up on stream close
        request.signal?.addEventListener('abort', () => {
          clearInterval(keepAlive)
          controller.close()
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