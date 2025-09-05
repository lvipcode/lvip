'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Search, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SearchParams, TaskType } from '@/types'

interface SearchFormProps {
  onSubmit: (params: {
    taskType: TaskType
    searchParams: SearchParams
    maxResults: number
  }) => void
  isLoading?: boolean
  disabled?: boolean
}

const TASK_TYPE_OPTIONS = [
  { value: 'person-search', label: '人员搜索', description: '搜索LinkedIn用户资料' },
  { value: 'company-search', label: '公司搜索', description: '搜索公司信息和员工' },
  { value: 'company-employees', label: '公司员工', description: '搜索特定公司的员工' }
] as const

const MAX_RESULTS_OPTIONS = [
  { value: 50, label: '50条结果' },
  { value: 100, label: '100条结果' },
  { value: 250, label: '250条结果' },
  { value: 500, label: '500条结果' },
  { value: 1000, label: '1000条结果' }
]

export default function SearchForm({ onSubmit, isLoading = false, disabled = false }: SearchFormProps) {
  const [taskType, setTaskType] = useState<TaskType>('person-search')
  const [searchParams, setSearchParams] = useState<SearchParams>({
    keywords: '',
    location: '',
    company: '',
    industry: '',
    experience: ''
  })
  const [maxResults, setMaxResults] = useState<number>(500)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Keywords validation
    if (!searchParams.keywords.trim()) {
      newErrors.keywords = '搜索关键词不能为空'
    } else if (searchParams.keywords.length > 200) {
      newErrors.keywords = '搜索关键词不能超过200个字符'
    }

    // Optional fields validation
    const optionalFields = ['location', 'company', 'industry', 'experience'] as const
    optionalFields.forEach(field => {
      if (searchParams[field] && searchParams[field].length > 100) {
        newErrors[field] = `${getFieldLabel(field)}不能超过100个字符`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getFieldLabel = (field: keyof SearchParams): string => {
    const labels = {
      keywords: '搜索关键词',
      location: '地理位置',
      company: '公司名称',
      industry: '行业领域',
      experience: '工作经验'
    }
    return labels[field]
  }

  const handleInputChange = (field: keyof SearchParams, value: string) => {
    setSearchParams(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Sanitize search parameters
    const sanitizedParams: SearchParams = {
      keywords: searchParams.keywords.trim(),
      location: searchParams.location.trim(),
      company: searchParams.company.trim(),
      industry: searchParams.industry.trim(),
      experience: searchParams.experience.trim()
    }

    onSubmit({
      taskType,
      searchParams: sanitizedParams,
      maxResults
    })
  }

  const selectedTaskType = TASK_TYPE_OPTIONS.find(option => option.value === taskType)

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-blue-600" />
          <CardTitle>创建搜索任务</CardTitle>
        </div>
        <CardDescription>
          配置LinkedIn数据提取参数，获取高质量的潜在客户信息
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="taskType" className="text-sm font-medium">
              任务类型 *
            </Label>
            <Select 
              value={taskType} 
              onValueChange={(value) => setTaskType(value as TaskType)}
              disabled={isLoading || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择搜索类型" />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTaskType && (
              <p className="text-xs text-gray-600">
                {selectedTaskType.description}
              </p>
            )}
          </div>

          {/* Search Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords" className="text-sm font-medium">
              搜索关键词 *
            </Label>
            <Input
              id="keywords"
              type="text"
              placeholder="例如：产品经理、软件工程师、销售总监"
              value={searchParams.keywords}
              onChange={(e) => handleInputChange('keywords', e.target.value)}
              disabled={isLoading || disabled}
              className={errors.keywords ? 'border-red-500' : ''}
            />
            {errors.keywords && (
              <p className="text-xs text-red-600">{errors.keywords}</p>
            )}
            <p className="text-xs text-gray-500">
              输入职位、技能或行业关键词，支持多个关键词用空格分隔
            </p>
          </div>

          {/* Optional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                地理位置
              </Label>
              <Input
                id="location"
                type="text"
                placeholder="例如：北京、上海、深圳"
                value={searchParams.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                disabled={isLoading || disabled}
                className={errors.location ? 'border-red-500' : ''}
              />
              {errors.location && (
                <p className="text-xs text-red-600">{errors.location}</p>
              )}
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="company" className="text-sm font-medium">
                公司名称
              </Label>
              <Input
                id="company"
                type="text"
                placeholder="例如：阿里巴巴、腾讯、字节跳动"
                value={searchParams.company}
                onChange={(e) => handleInputChange('company', e.target.value)}
                disabled={isLoading || disabled}
                className={errors.company ? 'border-red-500' : ''}
              />
              {errors.company && (
                <p className="text-xs text-red-600">{errors.company}</p>
              )}
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-sm font-medium">
                行业领域
              </Label>
              <Input
                id="industry"
                type="text"
                placeholder="例如：互联网、金融、教育、医疗"
                value={searchParams.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                disabled={isLoading || disabled}
                className={errors.industry ? 'border-red-500' : ''}
              />
              {errors.industry && (
                <p className="text-xs text-red-600">{errors.industry}</p>
              )}
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <Label htmlFor="experience" className="text-sm font-medium">
                工作经验
              </Label>
              <Input
                id="experience"
                type="text"
                placeholder="例如：3-5年、高级、总监级别"
                value={searchParams.experience}
                onChange={(e) => handleInputChange('experience', e.target.value)}
                disabled={isLoading || disabled}
                className={errors.experience ? 'border-red-500' : ''}
              />
              {errors.experience && (
                <p className="text-xs text-red-600">{errors.experience}</p>
              )}
            </div>
          </div>

          {/* Max Results */}
          <div className="space-y-2">
            <Label htmlFor="maxResults" className="text-sm font-medium">
              结果数量限制
            </Label>
            <Select 
              value={maxResults.toString()} 
              onValueChange={(value) => setMaxResults(parseInt(value))}
              disabled={isLoading || disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择结果数量" />
              </SelectTrigger>
              <SelectContent>
                {MAX_RESULTS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              更多结果需要更长的处理时间，建议从较小数量开始测试
            </p>
          </div>

          {/* Advanced Settings Info */}
          <div className="border-t pt-4">
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                <strong>高级设置：</strong>
                任务将自动分配给可用的插件处理，预计处理时间根据结果数量而定。
                你可以在任务进度页面实时查看提取状态。
              </AlertDescription>
            </Alert>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || disabled}
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                创建任务中...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                创建搜索任务
              </>
            )}
          </Button>
        </form>

        {/* Form Validation Error Summary */}
        {Object.keys(errors).length > 0 && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              请修正以下错误后重新提交：
              <ul className="mt-2 space-y-1">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field} className="text-sm">
                    • {error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}