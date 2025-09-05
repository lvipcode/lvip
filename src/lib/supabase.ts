// Supabase客户端配置
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

// 构建时环境变量处理
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// 检查是否为生产环境且缺少真实配置
const isProductionMissingConfig = 
  process.env.NODE_ENV === 'production' && 
  (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder') || supabaseServiceKey.includes('placeholder'))

// 客户端 Supabase 实例（用于浏览器环境）
export const createClientSupabase = () => {
  if (isProductionMissingConfig) {
    console.warn('⚠️ 生产环境缺少Supabase配置，请在Vercel Dashboard设置环境变量')
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// 服务端 Supabase 实例（用于服务器端渲染和API路由）  
export const createServerSupabase = () => {
  if (isProductionMissingConfig) {
    console.warn('⚠️ 生产环境缺少Supabase配置，请在Vercel Dashboard设置环境变量')
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// 默认客户端实例（延迟初始化以避免构建时错误）
let _supabaseClient: ReturnType<typeof createClient<Database>> | null = null
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    if (!_supabaseClient) {
      if (isProductionMissingConfig) {
        console.warn('⚠️ 生产环境缺少Supabase配置，请在Vercel Dashboard设置环境变量')
      }
      _supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
    }
    return _supabaseClient[prop as keyof typeof _supabaseClient]
  }
})

// 数据库操作类型
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// 常用类型导出
export type RedemptionCode = Tables<'redemption_codes'>
export type PluginRegistry = Tables<'plugin_registry'>
export type TaskQueue = Tables<'task_queue'>
export type TaskResults = Tables<'task_results'>
export type SystemLogs = Tables<'system_logs'>
export type AdminUsers = Tables<'admin_users'>
export type CleanupTasks = Tables<'cleanup_tasks'>