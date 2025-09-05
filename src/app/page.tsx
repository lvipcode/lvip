'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Users, Building2, AlertCircle } from 'lucide-react'
import { userApi } from '@/lib/api'

export default function Home() {
  const [redemptionCode, setRedemptionCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState('')
  const [isValidated, setIsValidated] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsValidating(true)
    setError('')

    try {
      const result = await userApi.validateCode(redemptionCode.trim().toUpperCase())
      
      if (result.isValid) {
        setValidationResult(result)
        setIsValidated(true)
        // Store validation result in localStorage for other pages
        localStorage.setItem('linkedin_code_validation', JSON.stringify({
          code: redemptionCode.trim().toUpperCase(),
          result: result,
          validatedAt: new Date().toISOString()
        }))
      } else {
        setError(result.message || '兑换码验证失败')
      }
    } catch (error) {
      console.error('Code validation error:', error)
      setError(error instanceof Error ? error.message : '验证过程中发生错误，请稍后重试')
    } finally {
      setIsValidating(false)
    }
  }

  if (isValidated && validationResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-lg mb-4">
                <Search className="w-4 h-4 mr-2" />
                兑换码验证成功
              </div>
              <div className="text-sm text-gray-600 mb-4">
                剩余使用次数: {validationResult.remainingUses} / 
                今日剩余: {validationResult.dailyRemaining} / 
                单次限制: {validationResult.singleLimit}条
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              选择搜索功能
            </h1>
            <p className="text-lg text-gray-600 mb-12">
              请选择您需要的数据提取服务
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* 人员搜索 */}
              <Link
                href="/search/person"
                className="group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6 group-hover:bg-blue-200 transition-colors">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    搜索人员
                  </h3>
                  <p className="text-gray-600 mb-4">
                    通过关键词、地点、公司等条件搜索 LinkedIn 用户
                  </p>
                  <div className="inline-flex items-center text-blue-600 font-medium group-hover:text-blue-700">
                    开始搜索
                    <Search className="ml-2 w-4 h-4" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-5 transition-opacity"></div>
              </Link>

              {/* 公司搜索 */}
              <Link
                href="/search/company"
                className="group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6 group-hover:bg-green-200 transition-colors">
                    <Building2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    搜索公司
                  </h3>
                  <p className="text-gray-600 mb-4">
                    搜索特定行业、规模、地区的公司信息
                  </p>
                  <div className="inline-flex items-center text-green-600 font-medium group-hover:text-green-700">
                    即将上线
                    <Search className="ml-2 w-4 h-4" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-green-600 opacity-0 group-hover:opacity-5 transition-opacity"></div>
              </Link>

              {/* 通过公司找人 */}
              <Link
                href="/search/company-employees"
                className="group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-6 group-hover:bg-purple-200 transition-colors">
                    <Building2 className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    通过公司找人
                  </h3>
                  <p className="text-gray-600 mb-4">
                    搜索特定公司的员工信息和联系方式
                  </p>
                  <div className="inline-flex items-center text-purple-600 font-medium group-hover:text-purple-700">
                    即将上线
                    <Search className="ml-2 w-4 h-4" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-purple-600 opacity-0 group-hover:opacity-5 transition-opacity"></div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-6">
              <Search className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              LinkedIn 数据提取系统
            </h1>
            <p className="text-gray-600 mb-8">
              请输入您的兑换码以访问服务
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                兑换码
              </label>
              <input
                id="code"
                type="text"
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入兑换码"
                required
              />
            </div>

            {error && (
              <div className="flex items-center justify-center text-red-600 text-sm mb-4">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isValidating || !redemptionCode.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? '验证中...' : '验证并进入'}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-gray-500">
            <p>请联系管理员获取兑换码</p>
          </div>
        </div>
      </div>
    </div>
  )
}
