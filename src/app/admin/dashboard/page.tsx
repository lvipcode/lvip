'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { 
  Users, 
  Code, 
  Activity, 
  Database,
  Plus,
  Eye,
  RefreshCw,
  Download,
  LogOut,
  ShoppingCart,
  Search
} from 'lucide-react'

interface DashboardStats {
  totalCodes: number
  activeCodes: number
  usedCodes: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
}

interface RedemptionCode {
  id: string
  code: string
  total_uses: number
  used_count: number
  status: string
  batch_name?: string
  created_at: string
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  quantity: number
  status: string
  total_amount: number
  created_at: string
}

interface CodeGenForm {
  batchName: string
  quantity: number
  usageLimit: number
  notes: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalCodes: 0,
    activeCodes: 0,
    usedCodes: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  })
  const [recentCodes, setRecentCodes] = useState<RedemptionCode[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCodeForm, setShowCodeForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [codeForm, setCodeForm] = useState<CodeGenForm>({
    batchName: '',
    quantity: 10,
    usageLimit: 1,
    notes: ''
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // 并行获取数据
      const [codesResponse, ordersResponse] = await Promise.all([
        fetch('/api/admin/codes?limit=10'),
        fetch('/api/admin/orders?limit=10')
      ])

      if (!codesResponse.ok || !ordersResponse.ok) {
        throw new Error('获取数据失败')
      }

      const codesData = await codesResponse.json()
      const ordersData = await ordersResponse.json()

      if (codesData.success && ordersData.success) {
        // 计算统计数据
        const codes = codesData.data.codes
        const orders = ordersData.data.orders

        setStats({
          totalCodes: codes.length,
          activeCodes: codes.filter((c: RedemptionCode) => c.status === 'active' && c.used_count < c.total_uses).length,
          usedCodes: codes.filter((c: RedemptionCode) => c.used_count >= c.total_uses).length,
          totalOrders: orders.length,
          pendingOrders: orders.filter((o: Order) => o.status === 'pending').length,
          completedOrders: orders.filter((o: Order) => o.status === 'delivered').length
        })

        setRecentCodes(codes)
        setRecentOrders(orders)
      } else {
        throw new Error('数据格式错误')
      }

    } catch (error) {
      console.error('获取后台数据失败:', error)
      setError('获取数据失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCodes = async () => {
    if (!codeForm.batchName || !codeForm.quantity || !codeForm.usageLimit) {
      setError('请填写所有必需字段')
      return
    }

    try {
      setGenerating(true)
      setError('')

      const response = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(codeForm)
      })

      const result = await response.json()

      if (result.success) {
        // 重置表单
        setCodeForm({
          batchName: '',
          quantity: 10,
          usageLimit: 1,
          notes: ''
        })
        setShowCodeForm(false)
        
        // 刷新数据
        fetchDashboardData()
        
        alert(`成功生成 ${codeForm.quantity} 个兑换码！`)
      } else {
        setError(result.error || '生成兑换码失败')
      }

    } catch (error) {
      console.error('生成兑换码失败:', error)
      setError('网络错误，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST'
      })
      
      // 清除 cookie
      document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
      
      // 跳转到登录页
      router.push('/admin/login')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载管理后台数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LinkedIn数据提取系统</h1>
              <p className="text-gray-600">管理后台控制面板</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={fetchDashboardData}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">兑换码总数</CardTitle>
              <Code className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCodes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">可用兑换码</CardTitle>
              <Database className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeCodes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">订单总数</CardTitle>
              <ShoppingCart className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">待处理订单</CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 兑换码管理 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  兑换码管理
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={() => window.open('/api/admin/codes/export?format=csv')}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    导出
                  </Button>
                  <Button
                    onClick={() => setShowCodeForm(!showCodeForm)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    生成
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 生成兑换码表单 */}
              {showCodeForm && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="batchName">批次名称</Label>
                      <Input
                        id="batchName"
                        placeholder="输入批次名称"
                        value={codeForm.batchName}
                        onChange={(e) => setCodeForm(prev => ({ ...prev, batchName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity">生成数量</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        max="1000"
                        value={codeForm.quantity}
                        onChange={(e) => setCodeForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="usageLimit">使用次数</Label>
                      <Input
                        id="usageLimit"
                        type="number"
                        min="1"
                        max="100"
                        value={codeForm.usageLimit}
                        onChange={(e) => setCodeForm(prev => ({ ...prev, usageLimit: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">备注</Label>
                      <Input
                        id="notes"
                        placeholder="可选备注"
                        value={codeForm.notes}
                        onChange={(e) => setCodeForm(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleGenerateCodes}
                      disabled={generating}
                      size="sm"
                    >
                      {generating ? '生成中...' : '确认生成'}
                    </Button>
                    <Button
                      onClick={() => setShowCodeForm(false)}
                      variant="outline"
                      size="sm"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 最近的兑换码 */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-mono font-semibold">{code.code}</div>
                      <div className="text-sm text-gray-500">
                        {code.batch_name || '单独生成'} • 使用 {code.used_count}/{code.total_uses} 次
                      </div>
                    </div>
                    <Badge className={getStatusColor(code.status)}>
                      {code.used_count >= code.total_uses ? '已用完' : '可用'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 订单管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                最近订单
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold">{order.order_number}</div>
                      <div className="text-sm text-gray-500">
                        {order.customer_name} • {order.quantity} 个兑换码
                      </div>
                      <div className="text-xs text-gray-400">
                        ¥{order.total_amount.toFixed(2)} • {new Date(order.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status === 'pending' ? '待处理' :
                       order.status === 'paid' ? '已支付' : 
                       order.status === 'delivered' ? '已交付' : 
                       order.status === 'cancelled' ? '已取消' : order.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快捷操作 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Button
                onClick={() => window.open('/api/admin/codes/export?format=csv')}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                导出所有兑换码
              </Button>
              <Button
                onClick={() => setShowCodeForm(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                批量生成兑换码
              </Button>
              <Button
                onClick={() => router.push('/admin/orders')}
                variant="outline"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                管理订单
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}