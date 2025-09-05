'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Download,
  Search,
  Filter,
  Eye,
  Star,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { userApi } from '@/lib/api'
import type { LinkedInProfile } from '@/types'

interface ResultDisplayProps {
  taskId: string
  onBack?: () => void
  showExportOptions?: boolean
  autoRefresh?: boolean
}

interface ResultData {
  taskId: string
  taskStatus: string
  searchParams: any
  results: LinkedInProfile[]
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalResults: number
    hasNext: boolean
    hasPrevious: boolean
  }
  quality: {
    averageScore: number
    completenessRate: number
  }
  metadata: {
    processedCount: number
    maxResults: number
    completedAt: string | null
    pluginUsed: string | null
    extractedAt: string | null
  }
}

const QUALITY_CONFIG = {
  high: { label: '优秀', color: 'bg-green-500', textColor: 'text-green-700', min: 0.8 },
  medium: { label: '良好', color: 'bg-yellow-500', textColor: 'text-yellow-700', min: 0.6 },
  low: { label: '一般', color: 'bg-red-500', textColor: 'text-red-700', min: 0 }
}

const getQualityLevel = (score: number) => {
  if (score >= QUALITY_CONFIG.high.min) return QUALITY_CONFIG.high
  if (score >= QUALITY_CONFIG.medium.min) return QUALITY_CONFIG.medium
  return QUALITY_CONFIG.low
}

export default function ResultDisplay({ 
  taskId, 
  onBack, 
  showExportOptions = true,
  autoRefresh = false 
}: ResultDisplayProps) {
  const [resultData, setResultData] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<LinkedInProfile | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterQuality, setFilterQuality] = useState<string>('all')

  // Fetch results
  const fetchResults = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await userApi.getTaskResults(taskId, {
        page,
        limit: 20,
        format: 'json'
      })
      
      if (response.success) {
        setResultData(response.data)
        setError(null)
      } else {
        setError(response.message || '获取结果失败')
      }
    } catch (err) {
      console.error('Error fetching results:', err)
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  // Filter results based on search and quality
  const getFilteredResults = (): LinkedInProfile[] => {
    if (!resultData?.results) return []

    let filtered = resultData.results

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(profile => 
        profile.name?.toLowerCase().includes(term) ||
        profile.company?.toLowerCase().includes(term) ||
        profile.position?.toLowerCase().includes(term) ||
        profile.location?.toLowerCase().includes(term)
      )
    }

    // Quality filter
    if (filterQuality !== 'all') {
      const minScore = QUALITY_CONFIG[filterQuality as keyof typeof QUALITY_CONFIG].min
      const maxScore = filterQuality === 'high' ? 1 : 
                      filterQuality === 'medium' ? QUALITY_CONFIG.high.min : 
                      QUALITY_CONFIG.medium.min
      filtered = filtered.filter(profile => 
        (profile.dataQuality || 0) >= minScore && 
        (filterQuality === 'low' || (profile.dataQuality || 0) < maxScore)
      )
    }

    return filtered
  }

  // Download results
  const handleDownload = async (format: 'csv' | 'json' | 'excel' = 'excel') => {
    try {
      const url = `/api/export/${taskId}?format=${format}`
      const link = document.createElement('a')
      link.href = url
      link.download = `linkedin_results_${taskId}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error downloading results:', err)
      setError('下载失败，请稍后重试')
    }
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchResults(page)
  }

  // Format time
  const formatTime = (timeString: string | null): string => {
    if (!timeString) return '未知'
    return new Date(timeString).toLocaleString('zh-CN')
  }

  // Setup initial load and auto-refresh
  useEffect(() => {
    fetchResults()

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchResults(currentPage)
      }, 10000) // Refresh every 10 seconds

      return () => clearInterval(interval)
    }
  }, [taskId, autoRefresh])

  if (loading && !resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载结果...</p>
        </div>
      </div>
    )
  }

  if (error && !resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-4 flex space-x-2">
              <Button onClick={() => fetchResults()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                重新加载
              </Button>
              {onBack && (
                <Button onClick={onBack} variant="outline" size="sm">
                  返回
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!resultData) return null

  const filteredResults = getFilteredResults()
  const qualityLevel = getQualityLevel(resultData.quality.averageScore)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {onBack && (
                <Button 
                  onClick={onBack}
                  variant="ghost"
                  size="sm"
                  className="mr-4"
                >
                  ← 返回
                </Button>
              )}
              <h1 className="text-xl font-semibold text-gray-900">搜索结果</h1>
              <Badge variant="outline" className="ml-3">
                {filteredResults.length} 条结果
              </Badge>
            </div>

            {showExportOptions && (
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleDownload('csv')}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  onClick={() => handleDownload('excel')}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <User className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">总结果数</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {resultData.pagination.totalResults}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className={`h-8 w-8 rounded-full ${qualityLevel.color} flex items-center justify-center`}>
                  <Star className="h-4 w-4 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">平均质量</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(resultData.quality.averageScore * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">完整度</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(resultData.quality.completenessRate * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">完成时间</p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatTime(resultData.metadata.completedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="搜索姓名、公司、职位或地点..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filterQuality}
                  onChange={(e) => setFilterQuality(e.target.value)}
                >
                  <option value="all">所有质量</option>
                  <option value="high">优秀 (80%+)</option>
                  <option value="medium">良好 (60-80%)</option>
                  <option value="low">一般 (60%-)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results List */}
        {filteredResults.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-gray-500">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>没有找到匹配的结果</p>
                <p className="text-sm mt-2">尝试调整搜索条件或筛选器</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((profile, index) => {
              const profileQuality = getQualityLevel(profile.dataQuality || 0)
              
              return (
                <Card 
                  key={index} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedProfile(profile)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {profile.name || '未知姓名'}
                        </CardTitle>
                        <CardDescription className="line-clamp-1">
                          {profile.position || '职位未知'}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${profileQuality.textColor} text-xs`}
                      >
                        {Math.round((profile.dataQuality || 0) * 100)}%
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      {profile.company && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="line-clamp-1">{profile.company}</span>
                        </div>
                      )}
                      
                      {profile.location && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="line-clamp-1">{profile.location}</span>
                        </div>
                      )}

                      {profile.about && (
                        <div className="text-sm text-gray-700 line-clamp-3 mt-3">
                          {profile.about}
                        </div>
                      )}

                      {profile.linkedinUrl && (
                        <div className="pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(profile.linkedinUrl, '_blank')
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            查看 LinkedIn
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {resultData.pagination.totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex space-x-1">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!resultData.pagination.hasPrevious || loading}
                variant="outline"
                size="sm"
              >
                上一页
              </Button>
              
              <div className="flex items-center px-4 text-sm text-gray-600">
                第 {resultData.pagination.currentPage} 页 / 共 {resultData.pagination.totalPages} 页
              </div>
              
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!resultData.pagination.hasNext || loading}
                variant="outline"
                size="sm"
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {/* Task Metadata */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">任务详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">任务ID:</span>
                <span className="ml-2 font-mono">{taskId}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">任务状态:</span>
                <Badge variant="outline" className="ml-2">
                  {resultData.taskStatus}
                </Badge>
              </div>
              <div>
                <span className="font-medium text-gray-700">处理数量:</span>
                <span className="ml-2">{resultData.metadata.processedCount}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">目标数量:</span>
                <span className="ml-2">{resultData.metadata.maxResults}</span>
              </div>
              {resultData.metadata.pluginUsed && (
                <div>
                  <span className="font-medium text-gray-700">执行插件:</span>
                  <span className="ml-2">{resultData.metadata.pluginUsed}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700">提取时间:</span>
                <span className="ml-2">{formatTime(resultData.metadata.extractedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Detail Modal */}
        {selectedProfile && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedProfile(null)}
          >
            <Card 
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {selectedProfile.name || '未知姓名'}
                    </CardTitle>
                    <CardDescription>
                      {selectedProfile.position || '职位未知'}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setSelectedProfile(null)}
                    variant="ghost"
                    size="sm"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {selectedProfile.company && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">公司</h4>
                    <p className="text-gray-900">{selectedProfile.company}</p>
                  </div>
                )}

                {selectedProfile.location && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">地点</h4>
                    <p className="text-gray-900">{selectedProfile.location}</p>
                  </div>
                )}

                {selectedProfile.experience && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">工作经验</h4>
                    <p className="text-gray-900">{selectedProfile.experience}</p>
                  </div>
                )}

                {selectedProfile.about && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">关于</h4>
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedProfile.about}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <span className="text-sm text-gray-600">数据质量: </span>
                    <Badge variant="outline">
                      {Math.round((selectedProfile.dataQuality || 0) * 100)}%
                    </Badge>
                  </div>
                  
                  {selectedProfile.linkedinUrl && (
                    <Button
                      onClick={() => window.open(selectedProfile.linkedinUrl, '_blank')}
                      variant="default"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      查看 LinkedIn
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}