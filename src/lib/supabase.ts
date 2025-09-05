// Supabase客户端配置
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 客户端 Supabase 实例（用于浏览器环境）
export const createClientSupabase = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// 服务端 Supabase 实例（用于服务器端渲染和API路由）
export const createServerSupabase = () => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// 默认客户端实例
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

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