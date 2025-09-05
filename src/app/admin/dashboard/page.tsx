'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Code, 
  Activity, 
  Database,
  Plus,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react'

interface AdminStats {
  totalUsers: number
  activeCodes: number
  totalTasks: number
  completedTasks: number
}

interface RedemptionCode {
  id: string
  code: string
  isUsed: boolean
  usedAt?: string
  createdAt: string
}

interface TaskSummary {
  id: string
  status: string
  totalResults: number
  createdAt: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeCodes: 0,
    totalTasks: 0,
    completedTasks: 0
  })
  const [codes, setCodes] = useState<RedemptionCode[]>([])
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [newCode, setNewCode] = useState('')
  const [adminToken] = useState('admin_token_secure_2025_change_in_production') // 临时写死

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // 模拟数据 - 实际项目中需要调用真实API
      setTimeout(() => {
        setStats({
          totalUsers: 12,
          activeCodes: 8,
          totalTasks: 45,
          completedTasks: 32
        })
        
        setCodes([
          {
            id: '1',
            code: 'DEMO2025',
            isUsed: false,
            createdAt: '2025-01-28T10:00:00Z'
          },
          {
            id: '2', 
            code: 'TEST123',
            isUsed: true,
            usedAt: '2025-01-28T15:30:00Z',
            createdAt: '2025-01-28T09:00:00Z'
          }
        ])
        
        setTasks([
          {
            id: '1',
            status: 'completed',
            totalResults: 25,
            createdAt: '2025-01-28T14:00:00Z'
          },
          {
            id: '2',
            status: 'processing',
            totalResults: 0,
            createdAt: '2025-01-28T16:00:00Z'
          }
        ])
        
        setLoading(false)
      }, 1000)
      
    } catch (error) {
      console.error('获取后台数据失败:', error)
      setLoading(false)
    }
  }

  const generateCode = async () => {
    if (!newCode.trim()) return
    
    try {
      // 模拟API调用
      const code: RedemptionCode = {
        id: Date.now().toString(),
        code: newCode,
        isUsed: false,
        createdAt: new Date().toISOString()
      }
      
      setCodes(prev => [code, ...prev])
      setNewCode('')
      setStats(prev => ({ ...prev, activeCodes: prev.activeCodes + 1 }))
      
    } catch (error) {
      console.error('生成兑换码失败:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LinkedIn数据提取系统</h1>
          <p className="text-gray-600 mt-2">管理后台控制面板</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">总用户数</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">有效兑换码</CardTitle>
              <Code className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCodes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">总任务数</CardTitle>
              <Activity className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTasks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">已完成任务</CardTitle>
              <Database className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedTasks}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 兑换码管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                兑换码管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 新增兑换码 */}
                <div className="flex gap-2">
                  <Input 
                    placeholder="输入新兑换码"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && generateCode()}
                  />
                  <Button onClick={generateCode} disabled={!newCode.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* 兑换码列表 */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {codes.map((code) => (
                    <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-mono font-semibold">{code.code}</div>
                        <div className="text-sm text-gray-500">
                          创建于 {new Date(code.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={code.isUsed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                          {code.isUsed ? '已使用' : '未使用'}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 任务监控 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                最近任务
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold">任务 #{task.id}</div>
                      <div className="text-sm text-gray-500">
                        {task.totalResults > 0 ? `${task.totalResults} 条结果` : '处理中...'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === 'completed' ? '已完成' :
                       task.status === 'processing' ? '处理中' : 
                       task.status === 'failed' ? '失败' : task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 警告提示 */}
        <Card className="mt-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <h3 className="font-semibold text-orange-800 mb-2">⚠️ 开发版本提示</h3>
                <p className="text-orange-700 text-sm">
                  当前为演示版本，数据为模拟数据。生产环境请配置真实的管理员API端点和身份验证。
                </p>
                <p className="text-orange-700 text-sm mt-1">
                  请在环境变量中设置 <code className="bg-orange-100 px-1 rounded">ADMIN_TOKEN</code> 以启用管理员功能。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}