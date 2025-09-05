// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      redemption_codes: {
        Row: {
          id: string
          code: string
          total_uses: number
          used_count: number
          daily_limit: number
          single_limit: number
          status: 'active' | 'inactive' | 'expired'
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          total_uses?: number
          used_count?: number
          daily_limit?: number
          single_limit?: number
          status?: 'active' | 'inactive' | 'expired'
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          total_uses?: number
          used_count?: number
          daily_limit?: number
          single_limit?: number
          status?: 'active' | 'inactive' | 'expired'
          expires_at?: string | null
          created_at?: string
        }
      }
      plugin_registry: {
        Row: {
          id: string
          plugin_id: string
          version: string
          capabilities: any
          status: 'online' | 'offline' | 'busy'
          last_heartbeat: string | null
          total_tasks: number
          successful_tasks: number
          performance_score: number
          created_at: string
        }
        Insert: {
          id?: string
          plugin_id: string
          version: string
          capabilities: any
          status?: 'online' | 'offline' | 'busy'
          last_heartbeat?: string | null
          total_tasks?: number
          successful_tasks?: number
          performance_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          plugin_id?: string
          version?: string
          capabilities?: any
          status?: 'online' | 'offline' | 'busy'
          last_heartbeat?: string | null
          total_tasks?: number
          successful_tasks?: number
          performance_score?: number
          created_at?: string
        }
      }
      task_queue: {
        Row: {
          id: string
          redemption_code_id: string | null
          task_type: string
          search_params: any
          max_results: number
          status: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'partial'
          assigned_plugin_id: string | null
          assigned_at: string | null
          started_at: string | null
          completed_at: string | null
          timeout_at: string | null
          processed_count: number
          created_at: string
        }
        Insert: {
          id?: string
          redemption_code_id?: string | null
          task_type: string
          search_params: any
          max_results?: number
          status?: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'partial'
          assigned_plugin_id?: string | null
          assigned_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          timeout_at?: string | null
          processed_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          redemption_code_id?: string | null
          task_type?: string
          search_params?: any
          max_results?: number
          status?: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'partial'
          assigned_plugin_id?: string | null
          assigned_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          timeout_at?: string | null
          processed_count?: number
          created_at?: string
        }
      }
      task_results: {
        Row: {
          id: string
          task_id: string
          plugin_id: string
          result_data: any
          result_count: number
          data_quality_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          plugin_id: string
          result_data: any
          result_count: number
          data_quality_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          plugin_id?: string
          result_data?: any
          result_count?: number
          data_quality_score?: number | null
          created_at?: string
        }
      }
      system_logs: {
        Row: {
          id: string
          log_level: 'info' | 'warn' | 'error' | 'debug'
          log_type: string
          plugin_id: string | null
          task_id: string | null
          user_ip: string | null
          message: string | null
          details: any | null
          created_at: string
        }
        Insert: {
          id?: string
          log_level: 'info' | 'warn' | 'error' | 'debug'
          log_type: string
          plugin_id?: string | null
          task_id?: string | null
          user_ip?: string | null
          message?: string | null
          details?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          log_level?: 'info' | 'warn' | 'error' | 'debug'
          log_type?: string
          plugin_id?: string | null
          task_id?: string | null
          user_ip?: string | null
          message?: string | null
          details?: any | null
          created_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          username: string
          password_hash: string
          role: string
          last_login: string | null
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          role?: string
          last_login?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          role?: string
          last_login?: string | null
          created_at?: string
        }
      }
      cleanup_tasks: {
        Row: {
          id: string
          task_type: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          target_date: string | null
          records_deleted: number
          created_at: string
        }
        Insert: {
          id?: string
          task_type: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          target_date?: string | null
          records_deleted?: number
          created_at?: string
        }
        Update: {
          id?: string
          task_type?: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          target_date?: string | null
          records_deleted?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      validate_redemption_code: {
        Args: {
          p_code: string
        }
        Returns: {
          is_valid: boolean
          code_id: string | null
          remaining_uses: number
          daily_remaining: number
          single_limit: number
          message: string
        }[]
      }
      create_search_task: {
        Args: {
          p_code: string
          p_task_type: string
          p_search_params: any
          p_max_results?: number
        }
        Returns: {
          success: boolean
          task_id: string | null
          message: string
        }[]
      }
      get_task_status: {
        Args: {
          p_task_id: string
        }
        Returns: {
          task_id: string
          status: string
          progress: number
          processed_count: number
          max_results: number
          assigned_plugin: string | null
          started_at: string | null
          estimated_completion: string | null
          message: string
        }[]
      }
      update_plugin_heartbeat: {
        Args: {
          p_plugin_id: string
          p_status: string
          p_current_task?: string | null
        }
        Returns: boolean
      }
      cleanup_old_data: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      system_health_check: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: string
          checked_at: string
        }[]
      }
      get_plugin_performance_stats: {
        Args: {
          p_hours?: number
        }
        Returns: {
          plugin_id: string
          status: string
          total_tasks: number
          completed_tasks: number
          failed_tasks: number
          success_rate: number
          avg_processing_time: string
          last_active: string
          performance_score: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}