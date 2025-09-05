import { NextRequest, NextResponse } from 'next/server'
import { createApiResponse } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const { searchParams } = request.nextUrl
    
    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const format = searchParams.get('format') || 'json'
    const quality = searchParams.get('quality') || 'all'
    const search = searchParams.get('search') || ''

    // Basic validation
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        createApiResponse(false, undefined, undefined, '任务ID无效'),
        { status: 400 }
      )
    }

    // TODO: Implement database results query after database setup
    console.log('Task results query:', {
      taskId, page, limit, format, quality, search
    })

    // Mock results for build success
    const mockResults = {
      results: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      task: {
        id: taskId,
        status: 'completed',
        totalResults: 0,
        qualityScore: 0
      }
    }

    return NextResponse.json(
      createApiResponse(true, mockResults, '查询成功')
    )

  } catch (error) {
    console.error('Unexpected error in results query:', error)
    return NextResponse.json(
      createApiResponse(false, undefined, undefined, '服务器内部错误'),
      { status: 500 }
    )
  }
}