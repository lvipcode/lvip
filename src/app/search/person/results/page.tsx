'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import ResultDisplay from '@/components/ResultDisplay'
import { useRouter } from 'next/navigation'

function ResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">无效的任务ID</h1>
          <p className="text-gray-600 mb-6">请确保从有效的搜索任务跳转到此页面</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    router.push('/search/person')
  }

  return (
    <ResultDisplay
      taskId={taskId}
      onBack={handleBack}
      showExportOptions={true}
      autoRefresh={false}
    />
  )
}

export default function PersonResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载结果页面...</p>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}