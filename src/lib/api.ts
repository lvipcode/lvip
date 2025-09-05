// API 客户端工具函数
import axios, { AxiosResponse, AxiosError } from 'axios'
import type {
  ApiResponse,
  CodeValidationResult,
  TaskCreationResult,
  TaskProgress,
  SearchResult,
  SearchParams,
  PluginRegisterRequest,
  PluginHeartbeatRequest,
  TaskSubmitRequest,
  PluginInfo,
  SystemHealth,
  PluginPerformance
} from '@/types'

// 创建axios实例
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 用户相关API
export const userApi = {
  // 验证兑换码
  validateCode: async (code: string): Promise<CodeValidationResult> => {
    const response = await api.post<ApiResponse<CodeValidationResult>>('/api/redemption-codes/validate', {
      code,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '验证失败')
    }
    
    return response.data.data!
  },
  
  // 创建搜索任务
  createSearchTask: async (
    code: string,
    taskType: string,
    searchParams: SearchParams,
    maxResults: number = 500
  ): Promise<TaskCreationResult> => {
    const response = await api.post<ApiResponse<TaskCreationResult>>('/api/tasks/create', {
      code,
      taskType,
      searchParams,
      maxResults,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '任务创建失败')
    }
    
    return response.data.data!
  },
  
  // 获取任务状态
  getTaskStatus: async (taskId: string): Promise<TaskProgress> => {
    const response = await api.get<ApiResponse<TaskProgress>>(`/api/tasks/status/${taskId}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取任务状态失败')
    }
    
    return response.data.data!
  },
  
  // 获取任务结果
  getTaskResults: async (taskId: string): Promise<SearchResult> => {
    const response = await api.get<ApiResponse<SearchResult>>(`/api/tasks/results/${taskId}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取任务结果失败')
    }
    
    return response.data.data!
  },
  
  // 取消任务
  cancelTask: async (taskId: string): Promise<void> => {
    const response = await api.post<ApiResponse>(`/api/tasks/cancel/${taskId}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '取消任务失败')
    }
  },
  
  // 导出结果到Excel
  exportResults: async (taskId: string): Promise<Blob> => {
    const response = await api.get(`/api/export/results/${taskId}`, {
      responseType: 'blob',
    })
    
    return response.data
  },
}

// 插件相关API
export const pluginApi = {
  // 插件注册
  register: async (request: PluginRegisterRequest): Promise<void> => {
    const response = await api.post<ApiResponse>('/api/plugins/register', request)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '插件注册失败')
    }
  },
  
  // 插件心跳
  heartbeat: async (request: PluginHeartbeatRequest): Promise<void> => {
    const response = await api.post<ApiResponse>('/api/plugins/heartbeat', request)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '心跳更新失败')
    }
  },
  
  // 提交任务结果
  submit: async (request: TaskSubmitRequest): Promise<void> => {
    const response = await api.post<ApiResponse>('/api/plugins/submit', request)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '结果提交失败')
    }
  },
  
  // 获取插件列表
  getList: async (): Promise<PluginInfo[]> => {
    const response = await api.get<ApiResponse<PluginInfo[]>>('/api/plugins')
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取插件列表失败')
    }
    
    return response.data.data!
  },
}

// 管理员API
export const adminApi = {
  // 登录
  login: async (username: string, password: string): Promise<{ token: string }> => {
    const response = await api.post<ApiResponse<{ token: string }>>('/api/admin/auth/login', {
      username,
      password,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '登录失败')
    }
    
    return response.data.data!
  },
  
  // 登出
  logout: async (): Promise<void> => {
    const response = await api.post<ApiResponse>('/api/admin/auth/logout')
    
    if (!response.data.success) {
      throw new Error(response.data.error || '登出失败')
    }
  },
  
  // 获取系统统计
  getStatistics: async (): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/api/admin/statistics')
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取统计数据失败')
    }
    
    return response.data.data!
  },
  
  // 获取系统健康状态
  getHealthStatus: async (): Promise<SystemHealth[]> => {
    const response = await api.get<ApiResponse<SystemHealth[]>>('/api/admin/health')
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取健康状态失败')
    }
    
    return response.data.data!
  },
  
  // 获取插件性能统计
  getPluginPerformance: async (hours: number = 24): Promise<PluginPerformance[]> => {
    const response = await api.get<ApiResponse<PluginPerformance[]>>(`/api/admin/plugins/performance?hours=${hours}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取插件性能失败')
    }
    
    return response.data.data!
  },
  
  // 生成兑换码
  generateCodes: async (
    count: number,
    totalUses: number,
    dailyLimit: number,
    singleLimit: number,
    expiresIn?: number
  ): Promise<string[]> => {
    const response = await api.post<ApiResponse<string[]>>('/api/admin/codes/generate', {
      count,
      totalUses,
      dailyLimit,
      singleLimit,
      expiresIn,
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '生成兑换码失败')
    }
    
    return response.data.data!
  },
  
  // 获取兑换码列表
  getCodes: async (page: number = 1, limit: number = 50): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/api/admin/codes?page=${page}&limit=${limit}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取兑换码列表失败')
    }
    
    return response.data.data!
  },
  
  // 获取任务列表
  getTasks: async (page: number = 1, limit: number = 50): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/api/admin/tasks?page=${page}&limit=${limit}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取任务列表失败')
    }
    
    return response.data.data!
  },
  
  // 获取系统日志
  getLogs: async (page: number = 1, limit: number = 50, level?: string): Promise<any> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    
    if (level) {
      params.append('level', level)
    }
    
    const response = await api.get<ApiResponse<any>>(`/api/admin/logs?${params.toString()}`)
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取系统日志失败')
    }
    
    return response.data.data!
  },
}

// SSE (Server-Sent Events) 客户端
export class SSEClient {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onError?: (error: any) => void,
    private onOpen?: () => void
  ) {}

  connect(): void {
    try {
      this.eventSource = new EventSource(this.url)
      
      this.eventSource.onopen = () => {
        console.log('SSE connection opened')
        this.reconnectAttempts = 0
        this.onOpen?.()
      }
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.onMessage(data)
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }
      
      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        this.onError?.(error)
        
        // 尝试重连
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => {
            this.disconnect()
            this.connect()
          }, this.reconnectDelay * this.reconnectAttempts)
        }
      }
    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      this.onError?.(error)
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// 创建插件任务监听器
export function createPluginTaskListener(
  pluginId: string,
  onTaskAssigned: (task: any) => void,
  onError?: (error: any) => void
): SSEClient {
  return new SSEClient(
    `/api/plugins/tasks/stream?pluginId=${encodeURIComponent(pluginId)}`,
    onTaskAssigned,
    onError
  )
}

export default api