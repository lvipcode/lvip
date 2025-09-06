-- 修复外键关系和数据库完整性
-- 在Supabase SQL编辑器中执行这个脚本

-- 1. 首先确保 redemption_code_batches 表存在
CREATE TABLE IF NOT EXISTS redemption_code_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name VARCHAR(100) NOT NULL,
  total_codes INTEGER NOT NULL,
  usage_limit INTEGER NOT NULL,
  generated_count INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 确保 redemption_codes 表有必要的列
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_name VARCHAR(100);
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. 为所有没有 batch_id 的兑换码创建默认批次
DO $$
DECLARE
    default_batch_id UUID;
BEGIN
    -- 检查是否有没有 batch_id 的兑换码
    IF EXISTS (SELECT 1 FROM redemption_codes WHERE batch_id IS NULL) THEN
        -- 创建默认批次
        INSERT INTO redemption_code_batches (
            batch_name, total_codes, usage_limit, notes, created_by
        ) VALUES (
            '系统默认批次', 
            (SELECT COUNT(*) FROM redemption_codes WHERE batch_id IS NULL),
            10,
            '系统自动创建的默认批次',
            'system'
        ) RETURNING id INTO default_batch_id;
        
        -- 更新所有没有 batch_id 的兑换码
        UPDATE redemption_codes 
        SET batch_id = default_batch_id,
            batch_name = '系统默认批次'
        WHERE batch_id IS NULL;
    END IF;
END $$;

-- 4. 现在可以安全地添加外键约束了
ALTER TABLE redemption_codes 
DROP CONSTRAINT IF EXISTS fk_redemption_codes_batch_id;

ALTER TABLE redemption_codes 
ADD CONSTRAINT fk_redemption_codes_batch_id 
FOREIGN KEY (batch_id) REFERENCES redemption_code_batches(id);

-- 5. 确保 orders 表也正确设置
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  product_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  usage_limit INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  batch_id UUID REFERENCES redemption_code_batches(id),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  delivered_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 确保 admin_sessions 表存在
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建索引
CREATE INDEX IF NOT EXISTS idx_redemption_codes_batch_id ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- 8. 重新创建兑换码生成函数（如果不存在）
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
    -- 创建批次记录
    INSERT INTO redemption_code_batches (
        batch_name, total_codes, usage_limit, notes, created_by
    ) VALUES (
        p_batch_name, p_quantity, p_usage_limit, p_notes, p_created_by
    ) RETURNING id INTO v_batch_id;
    
    -- 生成兑换码
    FOR i IN 1..p_quantity LOOP
        -- 生成8位随机兑换码
        v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        
        INSERT INTO redemption_codes (
            code, total_uses, batch_id, batch_name, notes
        ) VALUES (
            v_code, p_usage_limit, v_batch_id, p_batch_name, p_notes
        );
    END LOOP;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 9. 更新批次统计数据
UPDATE redemption_code_batches 
SET generated_count = (
    SELECT COUNT(*) 
    FROM redemption_codes 
    WHERE batch_id = redemption_code_batches.id
),
used_count = (
    SELECT COALESCE(SUM(used_count), 0)
    FROM redemption_codes 
    WHERE batch_id = redemption_code_batches.id
);

-- 完成提示
SELECT '外键关系修复完成！管理后台应该可以正常工作了。' as message;