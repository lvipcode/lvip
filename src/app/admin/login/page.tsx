'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, User, Eye, EyeOff, Shield } from 'lucide-react'

export default function AdminLogin() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initLoading, setInitLoading] = useState(false)
  const [initMessage, setInitMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('表单提交开始')
    
    if (!formData.username || !formData.password) {
      setError('请填写用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('发送登录请求', formData)
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()
      console.log('登录API响应:', {
        success: result.success,
        hasToken: !!result.data?.token,
        tokenLength: result.data?.token ? result.data.token.length : 0,
        error: result.error
      })

      if (result.success && result.data?.token) {
        // 设置令牌到 cookie - 简化版本，避免兼容性问题
        const cookieString = `admin_token=${result.data.token}; path=/; max-age=${24 * 60 * 60}; samesite=lax`
        document.cookie = cookieString
        
        console.log('登录成功，设置cookie:', cookieString)
        
        // 验证cookie是否设置成功
        setTimeout(() => {
          const cookies = document.cookie.split(';')
          const adminToken = cookies.find(c => c.trim().startsWith('admin_token='))
          console.log('cookie设置验证:', adminToken ? 'SUCCESS' : 'FAILED')
          console.log('所有cookies:', document.cookie)
          
          // 如果cookie设置失败，尝试更简单的方式
          if (!adminToken) {
            console.log('尝试备用cookie设置方式...')
            document.cookie = `admin_token=${result.data.token}; path=/`
            
            // 再次验证
            setTimeout(() => {
              const cookiesAgain = document.cookie.split(';')
              const adminTokenAgain = cookiesAgain.find(c => c.trim().startsWith('admin_token='))
              console.log('备用方式验证:', adminTokenAgain ? 'SUCCESS' : 'FAILED')
            }, 100)
          }
        }, 100)
        
        // 跳转到管理后台
        console.log('开始跳转到管理后台...')
        try {
          await router.push('/admin/dashboard')
          console.log('router.push 调用成功')
          router.refresh()
          console.log('router.refresh 调用成功')
        } catch (routerError) {
          console.error('路由跳转失败:', routerError)
        }
      } else {
        console.error('登录失败，原因:', result.error || '未知错误')
        setError(result.error || '登录失败')
      }

    } catch (error) {
      console.error('登录请求失败:', error)
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('') // 清除错误信息
  }

  const handleInitAdmin = async () => {
    console.log('开始初始化管理员')
    setInitLoading(true)
    setInitMessage('')
    
    try {
      const response = await fetch('/api/admin/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (result.success) {
        setInitMessage('默认管理员已创建！用户名: admin, 密码: admin123')
        // 自动填充表单
        setFormData({ username: 'admin', password: 'admin123' })
      } else {
        setInitMessage(result.error || '初始化失败')
      }

    } catch (error) {
      console.error('初始化请求失败:', error)
      setInitMessage('网络错误，请稍后重试')
    } finally {
      setInitLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            管理员登录
          </CardTitle>
          <CardDescription className="text-gray-600">
            LinkedIn数据提取系统管理后台
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                用户名
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10 pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  登录中...
                </div>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
            {initMessage && (
              <Alert className={initMessage.includes('已创建') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <AlertDescription className={initMessage.includes('已创建') ? 'text-green-800' : 'text-red-800'}>
                  {initMessage}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleInitAdmin}
                disabled={initLoading}
                className="w-full text-sm"
              >
                {initLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    初始化中...
                  </div>
                ) : (
                  '创建默认管理员账号'
                )}
              </Button>
            </div>
            
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>默认账号信息：</p>
              <p className="font-mono bg-gray-100 px-2 py-1 rounded">
                用户名: admin / 密码: admin123
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}