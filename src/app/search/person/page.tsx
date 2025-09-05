'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SearchForm from '@/components/SearchForm'
import TaskProgress from '@/components/TaskProgress'
import { userApi } from '@/lib/api'
import type { SearchParams } from '@/types'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function PersonSearchPage() {
  const router = useRouter()
  const [currentTask, setCurrentTask] = useState<string | null>(null)
  const [validationData, setValidationData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if user has validated code
    const storedValidation = localStorage.getItem('linkedin_code_validation')
    if (storedValidation) {
      try {
        const validation = JSON.parse(storedValidation)
        // Check if validation is not too old (24 hours)
        const validatedAt = new Date(validation.validatedAt)
        const now = new Date()
        const hoursAgo = (now.getTime() - validatedAt.getTime()) / (1000 * 60 * 60)
        
        if (hoursAgo < 24) {
          setValidationData(validation)
        } else {
          localStorage.removeItem('linkedin_code_validation')
          router.push('/')
        }
      } catch (error) {
        console.error('Error parsing validation data:', error)
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }, [router])

  const handleSearchSubmit = async (params: {
    taskType: string
    searchParams: SearchParams
    maxResults: number
  }) => {
    if (!validationData) {
      setError('验证信息已过期，请重新验证兑换码')
      router.push('/')
      return
    }

    setError('')

    try {
      const result = await userApi.createSearchTask(
        validationData.code,
        params.taskType,
        params.searchParams,
        params.maxResults
      )

      if (result.success) {
        setCurrentTask(result.taskId || null)
      } else {
        setError(result.message || '任务创建失败')
      }
    } catch (error) {
      console.error('Task creation error:', error)
      setError(error instanceof Error ? error.message : '创建任务时发生错误')
    }
  }

  const handleTaskComplete = (taskId: string) => {
    router.push(`/search/person/results?taskId=${taskId}`)
  }

  if (!validationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证权限...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首页
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">LinkedIn人员搜索</h1>
            </div>
            <div className="text-sm text-gray-600">
              剩余次数: {validationData.result.remainingUses} / 
              今日剩余: {validationData.result.dailyRemaining}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {!currentTask ? (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                配置搜索参数
              </h2>
              <p className="text-gray-600 mb-6">
                请填写搜索条件，系统将自动分配给可用的插件进行数据提取。
              </p>
              <SearchForm
                onSubmit={handleSearchSubmit}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">使用说明</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 搜索关键词为必填项，支持职位、技能或行业关键词</li>
                <li>• 其他筛选条件可选填，有助于提高搜索精度</li>
                <li>• 建议从较小的结果数量开始测试，避免浪费配额</li>
                <li>• 任务处理时间根据结果数量而定，通常需要几分钟</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <TaskProgress
              taskId={currentTask}
              onTaskComplete={handleTaskComplete}
            />
          </div>
        )}
      </div>
    </div>
  )
}