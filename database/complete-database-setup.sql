-- LinkedIn数据提取系统 - 完整数据库设置脚本
-- 这个脚本会确保所有必需的表、函数和数据都正确创建

-- =====================================================
-- 第一部分：基础表结构
-- =====================================================

-- 1. 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  last_login TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 兑换码批次表
CREATE TABLE IF NOT EXISTS redemption_code_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name VARCHAR(100) NOT NULL,
  total_codes INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER NOT NULL DEFAULT 1,
  generated_count INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 兑换码表
CREATE TABLE IF NOT EXISTS redemption_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  total_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER DEFAULT 10,
  single_limit INTEGER DEFAULT 500,
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  batch_id UUID REFERENCES redemption_code_batches(id),
  batch_name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 插件注册表
CREATE TABLE IF NOT EXISTS plugin_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(100) UNIQUE NOT NULL,
  version VARCHAR(20) NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'offline',
  last_heartbeat TIMESTAMP,
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 任务队列表
CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_code_id UUID REFERENCES redemption_codes(id),
  task_type VARCHAR(50) NOT NULL,
  search_params JSONB NOT NULL,
  max_results INTEGER DEFAULT 500,
  status VARCHAR(20) DEFAULT 'pending',
  assigned_plugin_id VARCHAR(100),
  assigned_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  timeout_at TIMESTAMP,
  processed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 任务结果表
CREATE TABLE IF NOT EXISTS task_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES task_queue(id) ON DELETE CASCADE,
  plugin_id VARCHAR(100) NOT NULL,
  result_data JSONB NOT NULL,
  result_count INTEGER NOT NULL,
  data_quality_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level VARCHAR(20) NOT NULL,
  log_type VARCHAR(50) NOT NULL,
  plugin_id VARCHAR(100),
  task_id UUID,
  user_ip INET,
  message TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 数据清理任务表
CREATE TABLE IF NOT EXISTS cleanup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  target_date DATE,
  records_deleted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 订单表（管理后台）
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  product_type VARCHAR(50) NOT NULL DEFAULT 'redemption_codes',
  quantity INTEGER NOT NULL,
  usage_limit INTEGER NOT NULL,
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'pending',
  batch_id UUID REFERENCES redemption_code_batches(id),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  delivered_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. 管理员会话表
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 第二部分：索引创建
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_redemption_codes_code ON redemption_codes(code);
CREATE INDEX IF NOT EXISTS idx_redemption_codes_status ON redemption_codes(status);
CREATE INDEX IF NOT EXISTS idx_redemption_codes_batch_id ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_plugin_id ON plugin_registry(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_task_queue_assigned_plugin ON task_queue(assigned_plugin_id);
CREATE INDEX IF NOT EXISTS idx_task_queue_created_at ON task_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_task_results_task_id ON task_results(task_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_cleanup_tasks_status ON cleanup_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cleanup_tasks_target_date ON cleanup_tasks(target_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- =====================================================
-- 第三部分：约束和触发器
-- =====================================================

-- 兑换码状态约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_code_status') THEN
    ALTER TABLE redemption_codes ADD CONSTRAINT check_code_status 
      CHECK (status IN ('active', 'inactive', 'expired'));
  END IF;
END $$;

-- 插件状态约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_plugin_status') THEN
    ALTER TABLE plugin_registry ADD CONSTRAINT check_plugin_status 
      CHECK (status IN ('online', 'offline', 'busy'));
  END IF;
END $$;

-- 任务状态约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_task_status') THEN
    ALTER TABLE task_queue ADD CONSTRAINT check_task_status 
      CHECK (status IN ('pending', 'assigned', 'processing', 'completed', 'failed', 'partial'));
  END IF;
END $$;

-- 订单状态约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_order_status') THEN
    ALTER TABLE orders ADD CONSTRAINT check_order_status 
      CHECK (status IN ('pending', 'paid', 'delivered', 'cancelled'));
  END IF;
END $$;

-- 日志级别约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_log_level') THEN
    ALTER TABLE system_logs ADD CONSTRAINT check_log_level 
      CHECK (log_level IN ('info', 'warn', 'error', 'debug'));
  END IF;
END $$;

-- =====================================================
-- 第四部分：核心函数
-- =====================================================

-- 1. 兑换码验证函数
CREATE OR REPLACE FUNCTION validate_redemption_code(p_code VARCHAR(50))
RETURNS TABLE (
    is_valid BOOLEAN,
    code_id UUID,
    remaining_uses INTEGER,
    daily_remaining INTEGER,
    single_limit INTEGER,
    message TEXT
) 
LANGUAGE plpgsql AS $$
DECLARE
    v_code_record redemption_codes%ROWTYPE;
    v_daily_usage INTEGER;
BEGIN
    SELECT * INTO v_code_record
    FROM redemption_codes
    WHERE code = p_code AND status = 'active';
    
    IF v_code_record.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 0, '兑换码无效或已失效'::TEXT;
        RETURN;
    END IF;
    
    IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 0, 0, v_code_record.single_limit, '兑换码已过期'::TEXT;
        RETURN;
    END IF;
    
    IF v_code_record.used_count >= v_code_record.total_uses THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 0, 0, v_code_record.single_limit, '兑换码使用次数已达上限'::TEXT;
        RETURN;
    END IF;
    
    SELECT COUNT(*) INTO v_daily_usage
    FROM task_queue
    WHERE redemption_code_id = v_code_record.id
    AND DATE(created_at) = CURRENT_DATE;
    
    IF v_daily_usage >= v_code_record.daily_limit THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 
                           (v_code_record.total_uses - v_code_record.used_count),
                           0, v_code_record.single_limit, 
                           '今日使用次数已达上限'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_code_record.id, 
                       (v_code_record.total_uses - v_code_record.used_count),
                       (v_code_record.daily_limit - v_daily_usage),
                       v_code_record.single_limit,
                       '兑换码有效'::TEXT;
END;
$$;

-- 2. 获取任务状态函数
CREATE OR REPLACE FUNCTION get_task_status(p_task_id UUID)
RETURNS TABLE (
    task_id UUID,
    status VARCHAR(20),
    progress INTEGER,
    processed_count INTEGER,
    max_results INTEGER,
    assigned_plugin VARCHAR(100),
    started_at TIMESTAMP,
    estimated_completion TIMESTAMP,
    message TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_task task_queue%ROWTYPE;
    v_progress INTEGER;
    v_estimated TIMESTAMP;
BEGIN
    SELECT * INTO v_task FROM task_queue WHERE id = p_task_id;
    
    IF v_task.id IS NULL THEN
        RETURN QUERY SELECT p_task_id, 'not_found'::VARCHAR(20), 0, 0, 0, 
                           NULL::VARCHAR(100), NULL::TIMESTAMP, NULL::TIMESTAMP, 
                           '任务不存在'::TEXT;
        RETURN;
    END IF;
    
    v_progress := CASE 
        WHEN v_task.max_results = 0 THEN 0
        ELSE LEAST(100, (v_task.processed_count * 100) / v_task.max_results)
    END;
    
    IF v_task.status IN ('processing') AND v_task.started_at IS NOT NULL AND v_task.processed_count > 0 THEN
        v_estimated := v_task.started_at + 
                       ((NOW() - v_task.started_at) * v_task.max_results / v_task.processed_count);
    END IF;
    
    RETURN QUERY SELECT v_task.id, v_task.status, v_progress, v_task.processed_count,
                       v_task.max_results, v_task.assigned_plugin_id, v_task.started_at,
                       v_estimated, 
                       CASE v_task.status
                           WHEN 'pending' THEN '等待分配插件'
                           WHEN 'assigned' THEN '已分配给插件'
                           WHEN 'processing' THEN '正在处理中'
                           WHEN 'completed' THEN '处理完成'
                           WHEN 'failed' THEN '处理失败'
                           WHEN 'partial' THEN '部分完成'
                           ELSE '状态未知'
                       END::TEXT;
END;
$$;

-- 3. 兑换码生成函数
CREATE OR REPLACE FUNCTION generate_redemption_codes(
    p_batch_name VARCHAR,
    p_quantity INTEGER,
    p_usage_limit INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_created_by VARCHAR DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
    v_batch_id UUID;
    v_code VARCHAR(50);
    i INTEGER;
BEGIN
    INSERT INTO redemption_code_batches (
        batch_name, total_codes, usage_limit, notes, created_by
    ) VALUES (
        p_batch_name, p_quantity, p_usage_limit, p_notes, p_created_by
    ) RETURNING id INTO v_batch_id;
    
    FOR i IN 1..p_quantity LOOP
        LOOP
            v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM redemption_codes WHERE code = v_code);
        END LOOP;
        
        INSERT INTO redemption_codes (
            code, total_uses, batch_id, batch_name, notes
        ) VALUES (
            v_code, p_usage_limit, v_batch_id, p_batch_name, p_notes
        );
    END LOOP;
    
    UPDATE redemption_code_batches 
    SET generated_count = p_quantity
    WHERE id = v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 第五部分：初始数据
-- =====================================================

-- 创建默认管理员（如果不存在）
DO $$
DECLARE
    default_password_hash TEXT := '$2a$12$5yP0EQC9YhNbVLwX3Vx8AeqK6YrY7kK8xR5gF7K1nP8qJ2Dw7Qs6K'; -- admin123
BEGIN
    INSERT INTO admin_users (username, password_hash, role)
    VALUES ('admin', default_password_hash, 'admin')
    ON CONFLICT (username) DO NOTHING;
END $$;

-- 完整性检查
DO $$
DECLARE
    table_count INTEGER;
    function_count INTEGER;
BEGIN
    -- 检查表数量
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'admin_users', 'redemption_code_batches', 'redemption_codes', 
        'plugin_registry', 'task_queue', 'task_results', 'system_logs', 
        'cleanup_tasks', 'orders', 'admin_sessions'
    );
    
    -- 检查函数数量
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN (
        'validate_redemption_code', 'get_task_status', 'generate_redemption_codes'
    );
    
    RAISE NOTICE '✅ 数据库完整性检查：';
    RAISE NOTICE '- 已创建表数量: % / 10', table_count;
    RAISE NOTICE '- 已创建函数数量: % / 3', function_count;
    
    IF table_count = 10 AND function_count = 3 THEN
        RAISE NOTICE '🎉 数据库设置完成！所有表和函数已正确创建。';
    ELSE
        RAISE WARNING '⚠️ 数据库设置不完整，请检查错误日志。';
    END IF;
END $$;

-- 完成提示
SELECT '🎉 LinkedIn数据提取系统数据库已完全设置完成！现在可以正常使用所有功能。' as message;