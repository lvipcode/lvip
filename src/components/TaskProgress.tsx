'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Pause, 
  Play, 
  Download,
  RefreshCw,
  Users,
  Building2,
  MapPin
} from 'lucide-react'
import { taskApi } from '@/lib/api'
import type { TaskStatus } from '@/types'

interface TaskProgressProps {
  taskId: string
  onTaskComplete?: (taskId: string, results: any) => void
  onTaskError?: (taskId: string, error: string) => void
  refreshInterval?: number
}

interface TaskData {
  taskId: string
  status: TaskStatus
  progress: number
  processedCount: number
  totalCount: number
  assignedPlugin: string | null
  startedAt: string | null
  estimatedCompletion: string | null
  message: string
}

const STATUS_CONFIG = {
  pending: {
    label: '等待处理',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    icon: Clock,
    description: '任务已创建，等待插件接收'
  },
  assigned: {
    label: '已分配',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    icon: Play,
    description: '任务已分配给插件，准备开始'
  },
  running: {
    label: '执行中',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    icon: RefreshCw,
    description: '插件正在提取数据'
  },
  paused: {
    label: '已暂停',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    icon: Pause,
    description: '任务暂停执行'
  },
  completed: {
    label: '已完成',
    color: 'bg-green-600',
    textColor: 'text-green-800',
    icon: CheckCircle,
    description: '数据提取完成'
  },
  failed: {
    label: '失败',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    icon: XCircle,
    description: '任务执行失败'
  },
  cancelled: {
    label: '已取消',
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    icon: XCircle,
    description: '任务被用户取消'
  }
}

export default function TaskProgress({ 
  taskId, 
  onTaskComplete, 
  onTaskError,
  refreshInterval = 3000 
}: TaskProgressProps) {
  const [taskData, setTaskData] = useState<TaskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // 直接使用taskApi

  // Fetch task status
  const fetchTaskStatus = async () => {
    try {
      const taskStatus = await taskApi.getStatus(taskId)
      setTaskData(taskStatus as any)
      setError(null)
      setLastUpdated(new Date())

      // Call completion callback
      if (taskStatus.status === 'completed' && onTaskComplete) {
        onTaskComplete(taskId, taskStatus)
      }
      
      // Call error callback
      if (taskStatus.status === 'failed' && onTaskError) {
        onTaskError(taskId, taskStatus.message || '任务执行失败')
      }
    } catch (err) {
      console.error('Error fetching task status:', err)
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  // Cancel task
  const handleCancelTask = async () => {
    try {
      await taskApi.cancel(taskId)
      await fetchTaskStatus() // Refresh status
    } catch (err) {
      console.error('Error cancelling task:', err)
      setError('取消任务失败，请稍后重试')
    }
  }

  // Download results
  const handleDownloadResults = async (format: 'csv' | 'json' | 'excel' = 'csv') => {
    try {
      const url = `/api/export/${taskId}?format=${format}&filename=linkedin_data_${taskId}`
      const link = document.createElement('a')
      link.href = url
      link.download = `linkedin_data_${taskId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error downloading results:', err)
      setError('下载失败，请稍后重试')
    }
  }

  // Setup polling
  useEffect(() => {
    fetchTaskStatus()

    const interval = setInterval(() => {
      // Only poll if task is not in final state
      if (taskData && !['completed', 'failed', 'cancelled'].includes(taskData.status)) {
        fetchTaskStatus()
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [taskId, taskData?.status, refreshInterval])

  // Format time
  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '未知'
    
    const date = new Date(timeString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Calculate estimated remaining time
  const getEstimatedTimeRemaining = (): string => {
    if (!taskData || !taskData.startedAt) return '计算中...'
    
    const now = new Date()
    const startTime = new Date(taskData.startedAt)
    const elapsedMs = now.getTime() - startTime.getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60000)
    
    // 10分钟超时逻辑
    const timeoutMinutes = 10
    const remainingMinutes = Math.max(0, timeoutMinutes - elapsedMinutes)
    
    if (remainingMinutes === 0 && ['assigned', 'running'].includes(taskData.status)) {
      return '处理时间较长，请稍后查看历史记录'
    }
    
    if (remainingMinutes <= 0) return '即将完成'
    
    if (remainingMinutes < 60) {
      return `约${remainingMinutes}分钟`
    }
    
    const hours = Math.ceil(remainingMinutes / 60)
    return `约${hours}小时`
  }

  // Check if task is taking too long
  const isTaskTakingTooLong = (): boolean => {
    if (!taskData || !taskData.startedAt) return false
    
    const now = new Date()
    const startTime = new Date(taskData.startedAt)
    const elapsedMs = now.getTime() - startTime.getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60000)
    
    return elapsedMinutes >= 10 && ['assigned', 'running'].includes(taskData.status)
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">加载任务状态...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !taskData) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={fetchTaskStatus} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!taskData) return null

  const statusConfig = STATUS_CONFIG[taskData.status]
  const StatusIcon = statusConfig.icon
  const canCancel = ['pending', 'assigned', 'running', 'paused'].includes(taskData.status)
  const canDownload = taskData.status === 'completed'
  const isActive = ['assigned', 'running'].includes(taskData.status)

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${statusConfig.color}`}>
              <StatusIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">任务进度</CardTitle>
              <CardDescription className="text-sm">
                任务ID: {taskId.substring(0, 8)}...
              </CardDescription>
            </div>
          </div>
          
          <Badge variant="outline" className={statusConfig.textColor}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Description */}
        <div className="text-sm text-gray-600">
          {statusConfig.description}
          {taskData.message && (
            <span className="block mt-1 font-medium">{taskData.message}</span>
          )}
        </div>

        {/* Timeout Warning */}
        {isTaskTakingTooLong() && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <div className="font-semibold mb-1">任务处理时间较长</div>
              <div className="text-sm">
                数据正在解锁中，请稍后查看历史搜索结果。任务会在后台继续执行，完成后您可以在历史记录中查看结果。
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        {taskData.totalCount > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>处理进度</span>
              <span className="font-mono">
                {taskData.processedCount} / {taskData.totalCount}
              </span>
            </div>
            <Progress 
              value={taskData.progress} 
              className="h-2"
            />
            <div className="text-xs text-gray-500 text-right">
              {taskData.progress.toFixed(1)}% 完成
            </div>
          </div>
        )}

        {/* Task Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {taskData.assignedPlugin && (
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">执行插件:</span>
              <Badge variant="secondary" className="text-xs">
                {taskData.assignedPlugin}
              </Badge>
            </div>
          )}

          {taskData.startedAt && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">开始时间:</span>
              <span className="font-mono text-xs">
                {formatTime(taskData.startedAt)}
              </span>
            </div>
          )}

          {taskData.estimatedCompletion && isActive && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-gray-600">预计剩余:</span>
              <span className="font-medium text-blue-600">
                {getEstimatedTimeRemaining()}
              </span>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">最后更新:</span>
            <span className="text-xs">
              {lastUpdated.toLocaleTimeString('zh-CN')}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            onClick={fetchTaskStatus}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </Button>

          {canCancel && (
            <Button
              onClick={handleCancelTask}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isTaskTakingTooLong() ? '放弃任务' : '取消任务'}
            </Button>
          )}

          {isTaskTakingTooLong() && (
            <Button
              onClick={() => window.location.href = '/search/history'}
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              <Clock className="h-4 w-4 mr-2" />
              查看历史记录
            </Button>
          )}

          {canDownload && (
            <div className="flex space-x-1">
              <Button
                onClick={() => handleDownloadResults('csv')}
                variant="outline"
                size="sm"
                className="text-green-600 hover:text-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                onClick={() => handleDownloadResults('json')}
                variant="outline"
                size="sm"
                className="text-green-600 hover:text-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
              <Button
                onClick={() => handleDownloadResults('excel')}
                variant="outline"
                size="sm"
                className="text-green-600 hover:text-green-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          )}
        </div>

        {/* Real-time Status Indicator */}
        {isActive && (
          <div className="flex items-center space-x-2 text-xs text-green-600 pt-2">
            <div className="animate-pulse h-2 w-2 bg-green-500 rounded-full"></div>
            <span>实时更新中...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}