'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  KeyRound, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Ticket,
  Clock,
  Users
} from 'lucide-react'
import { userApi } from '@/lib/api'

interface RedemptionCodeFormProps {
  onValidationSuccess: (codeData: {
    codeId: string
    remainingUses: number
    dailyRemaining: number
    singleLimit: number
  }) => void
  onValidationError?: (error: string) => void
  disabled?: boolean
}

interface ValidationResult {
  isValid: boolean
  codeId: string
  remainingUses: number
  dailyRemaining: number
  singleLimit: number
  message: string
}

export default function RedemptionCodeForm({ 
  onValidationSuccess, 
  onValidationError,
  disabled = false
}: RedemptionCodeFormProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  // 直接使用userApi

  const validateInput = (inputCode: string): boolean => {
    if (!inputCode.trim()) {
      setInputError('请输入兑换码')
      return false
    }

    if (inputCode.length < 6) {
      setInputError('兑换码至少需要6个字符')
      return false
    }

    if (inputCode.length > 50) {
      setInputError('兑换码不能超过50个字符')
      return false
    }

    // Check for valid characters (alphanumeric, dash, underscore)
    const validFormat = /^[A-Za-z0-9\-_]+$/.test(inputCode)
    if (!validFormat) {
      setInputError('兑换码只能包含字母、数字、短横线和下划线')
      return false
    }

    setInputError(null)
    return true
  }

  const handleCodeChange = (value: string) => {
    // Convert to uppercase and remove spaces
    const cleanedCode = value.toUpperCase().replace(/\s/g, '')
    setCode(cleanedCode)
    
    // Clear previous errors and results
    if (inputError) setInputError(null)
    if (error) setError(null)
    if (validationResult) setValidationResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateInput(code)) {
      return
    }

    setLoading(true)
    setError(null)
    setValidationResult(null)

    try {
      const result = await userApi.validateCode(code.trim())
      setValidationResult(result as any)
      
      // Call success callback
      onValidationSuccess({
        codeId: result.codeId,
        remainingUses: result.remainingUses,
        dailyRemaining: result.dailyRemaining,
        singleLimit: result.singleLimit
      })
    } catch (err) {
      console.error('Error validating redemption code:', err)
      const errorMessage = '网络错误，请检查连接后重试'
      setError(errorMessage)
      if (onValidationError) {
        onValidationError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCode('')
    setValidationResult(null)
    setError(null)
    setInputError(null)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="p-3 rounded-full bg-blue-100">
            <KeyRound className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-xl">验证兑换码</CardTitle>
        <CardDescription>
          请输入您的兑换码以访问LinkedIn数据提取功能
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!validationResult ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium">
                兑换码 *
              </Label>
              <Input
                id="code"
                type="text"
                placeholder="请输入兑换码"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={loading || disabled}
                className={inputError ? 'border-red-500' : ''}
                autoComplete="off"
                autoCapitalize="characters"
              />
              {inputError && (
                <p className="text-xs text-red-600 flex items-center space-x-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{inputError}</span>
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || disabled || !code.trim()}
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  验证中...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4 mr-2" />
                  验证兑换码
                </>
              )}
            </Button>

            {/* Help Text */}
            <div className="text-xs text-gray-600 text-center space-y-1">
              <p>兑换码不区分大小写，系统会自动转换为大写</p>
              <p>如果您没有兑换码，请联系管理员获取</p>
            </div>
          </form>
        ) : (
          /* Validation Success Display */
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 text-green-600 mb-4">
              <CheckCircle className="h-6 w-6" />
              <span className="font-medium">验证成功</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600 flex items-center space-x-2">
                  <Ticket className="h-4 w-4" />
                  <span>兑换码</span>
                </span>
                <Badge variant="secondary" className="font-mono">
                  {code}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600 flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>剩余使用次数</span>
                </span>
                <Badge variant={validationResult.remainingUses > 5 ? "default" : "destructive"}>
                  {validationResult.remainingUses} 次
                </Badge>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600 flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>今日剩余次数</span>
                </span>
                <Badge variant={validationResult.dailyRemaining > 0 ? "default" : "secondary"}>
                  {validationResult.dailyRemaining} 次
                </Badge>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span>单次查询限制</span>
                </span>
                <Badge variant="outline">
                  {validationResult.singleLimit} 条
                </Badge>
              </div>
            </div>

            {validationResult.message && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {validationResult.message}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleReset}
              variant="outline" 
              size="sm"
              className="w-full"
              disabled={disabled}
            >
              重新验证
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Tips */}
        {!validationResult && !error && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center space-x-2">
              <Info className="h-4 w-4" />
              <span>使用提示</span>
            </h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 每个兑换码都有使用次数限制</li>
              <li>• 每日使用次数也有限制</li>
              <li>• 验证成功后即可开始使用LinkedIn数据提取功能</li>
              <li>• 请妥善保管您的兑换码，避免泄露</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}