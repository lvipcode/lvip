'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download,
  Search,
  Filter,
  Users,
  Building2,
  MapPin,
  ExternalLink,
  Mail,
  Phone,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react'
import { taskApi } from '@/lib/api'
// import type { ExtractedData } from '@/types'

interface ResultsListProps {
  taskId: string
  initialResults?: any[]
  showPagination?: boolean
  itemsPerPage?: number
}

interface ResultsData {
  taskId: string
  status: string
  totalCount: number
  currentPage: number
  pageSize: number
  totalPages: number
  results: any[]
  dataQuality: number
}

interface FilterOptions {
  searchTerm: string
  company: string
  location: string
  sortBy: 'name' | 'company' | 'position' | 'extracted_at'
  sortOrder: 'asc' | 'desc'
}

export default function ResultsList({ 
  taskId, 
  initialResults = [],
  showPagination = true,
  itemsPerPage = 20
}: ResultsListProps) {
  const [resultsData, setResultsData] = useState<ResultsData | null>(null)
  const [filteredResults, setFilteredResults] = useState<any[]>(initialResults || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    company: '',
    location: '',
    sortBy: 'extracted_at',
    sortOrder: 'desc'
  })
  const [showFilters, setShowFilters] = useState(false)

  // 直接使用taskApi

  // Fetch results from API
  const fetchResults = async (page: number = 1) => {
    setLoading(true)
    setError(null)
    
    try {
      const searchResult = await taskApi.getResults(taskId)
      setResultsData(searchResult as any)
      setFilteredResults(searchResult.results || [])
      setCurrentPage(page)
    } catch (err) {
      console.error('Error fetching results:', err)
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  // Apply filters and sorting
  const applyFilters = (results: any[]) => {
    let filtered = [...results]

    // Search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.position.toLowerCase().includes(term) ||
        item.company.toLowerCase().includes(term)
      )
    }

    // Company filter
    if (filters.company) {
      filtered = filtered.filter(item =>
        item.company.toLowerCase().includes(filters.company.toLowerCase())
      )
    }

    // Location filter
    if (filters.location) {
      filtered = filtered.filter(item =>
        item.location.toLowerCase().includes(filters.location.toLowerCase())
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      const aValue = a[filters.sortBy] || ''
      const bValue = b[filters.sortBy] || ''
      
      let comparison = 0
      if (aValue < bValue) comparison = -1
      if (aValue > bValue) comparison = 1
      
      return filters.sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    
    if (resultsData) {
      const filtered = applyFilters(resultsData.results)
      setFilteredResults(filtered)
    }
  }

  // Handle download
  const handleDownload = async (format: 'csv' | 'json' | 'excel') => {
    try {
      const url = `/api/export/${taskId}?format=${format}&filename=linkedin_results_${taskId}`
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

  // Get unique values for filter dropdowns
  const getUniqueValues = (field: 'company' | 'location'): string[] => {
    const values = filteredResults.map(item => item[field]).filter(Boolean)
    return Array.from(new Set(values)).sort()
  }

  // Format contact info display
  const formatContactInfo = (contactInfo: string): { type: 'email' | 'phone' | 'other', value: string } => {
    if (contactInfo.includes('@')) {
      return { type: 'email', value: contactInfo }
    } else if (/^[\+]?[\d\s\-\(\)]+$/.test(contactInfo)) {
      return { type: 'phone', value: contactInfo }
    }
    return { type: 'other', value: contactInfo }
  }

  // Load initial data
  useEffect(() => {
    if (initialResults.length === 0) {
      fetchResults(1)
    }
  }, [taskId])

  // Apply filters when results change
  useEffect(() => {
    if (resultsData) {
      const filtered = applyFilters(resultsData.results)
      setFilteredResults(filtered)
    }
  }, [resultsData, filters])

  const handlePageChange = (page: number) => {
    if (showPagination) {
      fetchResults(page)
    } else {
      setCurrentPage(page)
    }
  }

  // Calculate pagination for client-side filtering
  const totalFilteredResults = filteredResults.length
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedResults = showPagination 
    ? filteredResults 
    : filteredResults.slice(startIndex, endIndex)
  const totalPages = showPagination 
    ? (resultsData?.totalPages || 1) 
    : Math.ceil(totalFilteredResults / itemsPerPage)

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>搜索结果</span>
              </CardTitle>
              <CardDescription>
                {resultsData ? (
                  <span>
                    共找到 {resultsData.totalCount} 条结果
                    {resultsData.dataQuality > 0 && (
                      <span className="ml-2">
                        • 数据质量: {(resultsData.dataQuality * 100).toFixed(1)}%
                      </span>
                    )}
                  </span>
                ) : (
                  <span>加载中...</span>
                )}
              </CardDescription>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选
              </Button>
              
              <div className="flex space-x-1">
                <Button
                  onClick={() => handleDownload('csv')}
                  variant="outline"
                  size="sm"
                  className="text-green-600"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  onClick={() => handleDownload('excel')}
                  variant="outline" 
                  size="sm"
                  className="text-green-600"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Excel
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Filters */}
        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Input
                  placeholder="搜索姓名、职位、公司..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                />
              </div>
              
              <div>
                <Select value={filters.company} onValueChange={(value) => handleFilterChange('company', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="筛选公司" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">所有公司</SelectItem>
                    {getUniqueValues('company').slice(0, 20).map(company => (
                      <SelectItem key={company} value={company}>{company}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={filters.location} onValueChange={(value) => handleFilterChange('location', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="筛选位置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">所有位置</SelectItem>
                    {getUniqueValues('location').slice(0, 20).map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select 
                  value={`${filters.sortBy}-${filters.sortOrder}`} 
                  onValueChange={(value) => {
                    const [sortBy, sortOrder] = value.split('-')
                    handleFilterChange('sortBy', sortBy)
                    handleFilterChange('sortOrder', sortOrder)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">姓名 A-Z</SelectItem>
                    <SelectItem value="name-desc">姓名 Z-A</SelectItem>
                    <SelectItem value="company-asc">公司 A-Z</SelectItem>
                    <SelectItem value="company-desc">公司 Z-A</SelectItem>
                    <SelectItem value="extracted_at-desc">最新提取</SelectItem>
                    <SelectItem value="extracted_at-asc">最早提取</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">加载结果中...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Grid */}
      {!loading && paginatedResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedResults.map((result, index) => {
            const contactInfo = formatContactInfo(result.contact_info || '')
            const ContactIcon = contactInfo.type === 'email' ? Mail : 
                                contactInfo.type === 'phone' ? Phone : ExternalLink

            return (
              <Card key={result.id || index} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 mb-1">
                          {result.name}
                        </h3>
                        <p className="text-sm text-blue-600 mb-2">
                          {result.position}
                        </p>
                      </div>
                      {result.profile_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(result.profile_url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Company & Location */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{result.company}</span>
                      </div>
                      
                      {result.location && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{result.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Contact Info */}
                    {result.contact_info && (
                      <div className="flex items-center space-x-2 text-sm">
                        <ContactIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-blue-600">{contactInfo.value}</span>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-gray-500">
                        提取时间: {new Date(result.extracted_at).toLocaleString('zh-CN')}
                      </div>
                      {result.data_quality && (
                        <Badge variant="secondary" className="text-xs">
                          质量: {(result.data_quality * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && paginatedResults.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              暂无结果
            </h3>
            <p className="text-gray-600">
              {filteredResults.length === 0 
                ? '任务尚未提取到数据，或者数据正在处理中'
                : '当前筛选条件下没有匹配的结果'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && paginatedResults.length > 0 && totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                显示第 {startIndex + 1}-{Math.min(endIndex, totalFilteredResults)} 项，
                共 {totalFilteredResults} 项结果
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                    if (page > totalPages) return null
                    
                    return (
                      <Button
                        key={page}
                        variant={page === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}