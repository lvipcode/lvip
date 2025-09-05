// 应用核心类型定义

// LinkedIn数据结构（标准化）
export interface LinkedInProfile {
  name: string
  company: string
  position: string
  experience: string
  about: string
  location: string
  linkedinUrl: string
  extractedAt: string
  dataQuality: number
}

// 搜索参数
export interface SearchParams {
  keywords: string
  location?: string
  company?: string
  industry?: string
  experience?: string
  skills?: string[]
  [key: string]: any
}

// 任务状态
export type TaskStatus = 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'partial'

// 任务进度信息
export interface TaskProgress {
  taskId: string
  status: TaskStatus
  progress: number
  processedCount: number
  totalCount: number
  assignedPlugin?: string
  startedAt?: string
  estimatedCompletion?: string
  message: string
}

// 插件状态
export type PluginStatus = 'online' | 'offline' | 'busy'

// 插件信息
export interface PluginInfo {
  pluginId: string
  version: string
  capabilities: string[]
  status: PluginStatus
  lastHeartbeat?: string
  totalTasks: number
  successfulTasks: number
  performanceScore: number
}

// API响应格式
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 兑换码验证结果
export interface CodeValidationResult {
  isValid: boolean
  codeId?: string
  remainingUses: number
  dailyRemaining: number
  singleLimit: number
  message: string
}

// 任务创建结果
export interface TaskCreationResult {
  success: boolean
  taskId?: string
  message: string
}

// 搜索结果
export interface SearchResult {
  taskId: string
  results: LinkedInProfile[]
  totalCount: number
  quality: {
    averageScore: number
    completenessRate: number
  }
  metadata: {
    searchParams: SearchParams
    processingTime: number
    pluginUsed: string
    extractedAt: string
  }
}

// 系统健康状态
export interface SystemHealth {
  checkName: string
  status: 'healthy' | 'warning' | 'critical'
  details: string
  checkedAt: string
}

// 插件性能统计
export interface PluginPerformance {
  pluginId: string
  status: PluginStatus
  totalTasks: number
  completedTasks: number
  failedTasks: number
  successRate: number
  avgProcessingTime: string
  lastActive: string
  performanceScore: number
}

// 数据质量监控
export interface DataQualityMetric {
  metricName: string
  metricValue: number
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'needs_improvement'
  details: string
}

// 管理员用户
export interface AdminUser {
  id: string
  username: string
  role: string
  lastLogin?: string
  createdAt: string
}

// 系统日志
export interface SystemLog {
  id: string
  logLevel: 'info' | 'warn' | 'error' | 'debug'
  logType: string
  pluginId?: string
  taskId?: string
  userIp?: string
  message?: string
  details?: any
  createdAt: string
}

// HTTP + SSE 通信相关类型

// 插件注册请求
export interface PluginRegisterRequest {
  pluginId: string
  version: string
  capabilities: string[]
}

// 插件心跳请求
export interface PluginHeartbeatRequest {
  pluginId: string
  status: PluginStatus
  currentTask?: string | null
}

// 任务提交请求
export interface TaskSubmitRequest {
  taskId: string
  pluginId: string
  results: LinkedInProfile[]
  status: 'completed' | 'partial' | 'failed'
  processedCount: number
  totalCount: number
}

// SSE推送的任务分配消息
export interface TaskAssignmentMessage {
  taskId: string
  taskType: string
  searchParams: SearchParams
  maxResults: number
  timeout: number
}

// 组件属性类型
export interface SearchFormProps {
  onSubmit: (params: SearchParams) => void
  isLoading: boolean
  remainingUses: number
  singleLimit: number
}

export interface TaskProgressProps {
  taskId: string
  onTaskComplete?: (result: SearchResult) => void
}

export interface ResultsListProps {
  results: LinkedInProfile[]
  onExport?: () => void
  showQualityScore?: boolean
}

// 页面参数类型
export interface SearchPageParams {
  taskId?: string
}

export interface AdminPageParams {
  section?: 'dashboard' | 'plugins' | 'tasks' | 'codes' | 'logs'
}