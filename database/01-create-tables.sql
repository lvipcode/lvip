-- LinkedIn数据提取系统 - 全新数据库架构
-- 基于CLAUDE-REDESIGN.md设计

-- 删除已存在的表（如果存在）
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS cleanup_tasks;
DROP TABLE IF EXISTS task_results;
DROP TABLE IF EXISTS task_queue;
DROP TABLE IF EXISTS plugin_registry;
DROP TABLE IF EXISTS redemption_codes;
DROP TABLE IF EXISTS admin_users;

-- 1. 兑换码表（重新生成）
CREATE TABLE redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  total_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER DEFAULT 10,        -- 每天限制10次
  single_limit INTEGER DEFAULT 500,      -- 单次限制500条
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 插件注册表
CREATE TABLE plugin_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(100) UNIQUE NOT NULL,
  version VARCHAR(20) NOT NULL,
  capabilities JSONB NOT NULL,           -- ["person-search"]
  status VARCHAR(20) DEFAULT 'offline',  -- "online", "offline", "busy"
  last_heartbeat TIMESTAMP,
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 任务队列表
CREATE TABLE task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_code_id UUID REFERENCES redemption_codes(id),
  task_type VARCHAR(50) NOT NULL,        -- "person-search"
  search_params JSONB NOT NULL,          -- 搜索参数
  max_results INTEGER DEFAULT 500,       -- 最大结果数
  status VARCHAR(20) DEFAULT 'pending',  -- "pending", "assigned", "processing", "completed", "failed", "partial"
  assigned_plugin_id VARCHAR(100),
  assigned_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  timeout_at TIMESTAMP,                  -- 10分钟超时
  processed_count INTEGER DEFAULT 0,     -- 已处理数量（支持部分结果）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 任务结果表
CREATE TABLE task_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_queue(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,
  result_data JSONB NOT NULL,            -- LinkedIn提取的数据
  result_count INTEGER NOT NULL,         -- 实际结果数量
  data_quality_score DECIMAL(3,2),      -- 数据质量评分
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 系统日志表（详细记录）
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level VARCHAR(20) NOT NULL,        -- "info", "warn", "error"
  log_type VARCHAR(50) NOT NULL,         -- "plugin_event", "task_event", "api_request"
  plugin_id VARCHAR(100),
  task_id UUID,
  user_ip INET,
  message TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 管理员表（保留）
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  last_login TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 数据清理任务表
CREATE TABLE cleanup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,        -- "data_cleanup", "log_cleanup"
  status VARCHAR(20) DEFAULT 'pending',
  target_date DATE,                      -- 清理7天前数据
  records_deleted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化性能
CREATE INDEX idx_redemption_codes_code ON redemption_codes(code);
CREATE INDEX idx_redemption_codes_status ON redemption_codes(status);
CREATE INDEX idx_plugin_registry_plugin_id ON plugin_registry(plugin_id);
CREATE INDEX idx_plugin_registry_status ON plugin_registry(status);
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_assigned_plugin ON task_queue(assigned_plugin_id);
CREATE INDEX idx_task_queue_created_at ON task_queue(created_at);
CREATE INDEX idx_task_results_task_id ON task_results(task_id);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX idx_cleanup_tasks_status ON cleanup_tasks(status);
CREATE INDEX idx_cleanup_tasks_target_date ON cleanup_tasks(target_date);

-- 创建约束
ALTER TABLE task_queue ADD CONSTRAINT check_task_status 
  CHECK (status IN ('pending', 'assigned', 'processing', 'completed', 'failed', 'partial'));

ALTER TABLE plugin_registry ADD CONSTRAINT check_plugin_status 
  CHECK (status IN ('online', 'offline', 'busy'));

ALTER TABLE redemption_codes ADD CONSTRAINT check_code_status 
  CHECK (status IN ('active', 'inactive', 'expired'));

ALTER TABLE system_logs ADD CONSTRAINT check_log_level 
  CHECK (log_level IN ('info', 'warn', 'error', 'debug'));

ALTER TABLE cleanup_tasks ADD CONSTRAINT check_cleanup_status 
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));