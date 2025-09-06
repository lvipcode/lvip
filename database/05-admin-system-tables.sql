-- 管理后台系统扩展表
-- 支持订单管理和兑换码批量生成

-- 1. 扩展兑换码表 - 添加批次管理
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_name VARCHAR(100);
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. 创建兑换码批次表
CREATE TABLE IF NOT EXISTS redemption_code_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name VARCHAR(100) NOT NULL,
  total_codes INTEGER NOT NULL,
  usage_limit INTEGER NOT NULL,        -- 每个兑换码的使用次数
  generated_count INTEGER DEFAULT 0,   -- 已生成数量
  used_count INTEGER DEFAULT 0,        -- 已使用数量
  notes TEXT,
  created_by VARCHAR(50),              -- 管理员用户名
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建订单表
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  product_type VARCHAR(50) NOT NULL,   -- "redemption_codes" 
  quantity INTEGER NOT NULL,           -- 兑换码数量
  usage_limit INTEGER NOT NULL,       -- 每个兑换码使用次数
  unit_price DECIMAL(10,2),           -- 单价
  total_amount DECIMAL(10,2),         -- 总金额
  status VARCHAR(20) DEFAULT 'pending', -- "pending", "paid", "delivered", "cancelled"
  batch_id UUID REFERENCES redemption_code_batches(id), -- 关联批次
  payment_method VARCHAR(50),         -- 支付方式（预留）
  paid_at TIMESTAMP,
  delivered_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建管理员会话表
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建兑换码使用记录表（详细追踪）
CREATE TABLE IF NOT EXISTS redemption_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_code_id UUID REFERENCES redemption_codes(id) ON DELETE CASCADE,
  task_id UUID REFERENCES task_queue(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_ip INET,
  results_count INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_redemption_codes_batch_id ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_redemption_code_usage_code_id ON redemption_code_usage(redemption_code_id);

-- 创建约束
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_order_status') THEN
    ALTER TABLE orders ADD CONSTRAINT check_order_status 
      CHECK (status IN ('pending', 'paid', 'delivered', 'cancelled'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_positive_quantity') THEN
    ALTER TABLE orders ADD CONSTRAINT check_positive_quantity 
      CHECK (quantity > 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_positive_usage_limit') THEN
    ALTER TABLE orders ADD CONSTRAINT check_positive_usage_limit 
      CHECK (usage_limit > 0);
  END IF;
END $$;

-- 更新兑换码表约束以支持批次
UPDATE redemption_codes SET batch_id = gen_random_uuid() WHERE batch_id IS NULL;

-- 创建触发器自动更新订单更新时间
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE PROCEDURE update_orders_updated_at();

-- 创建触发器自动更新批次统计
CREATE OR REPLACE FUNCTION update_batch_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- 新增兑换码时更新批次统计
        UPDATE redemption_code_batches 
        SET generated_count = generated_count + 1
        WHERE id = NEW.batch_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- 兑换码使用时更新批次统计
        IF OLD.used_count != NEW.used_count THEN
            UPDATE redemption_code_batches 
            SET used_count = (
                SELECT SUM(used_count) 
                FROM redemption_codes 
                WHERE batch_id = NEW.batch_id
            )
            WHERE id = NEW.batch_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_redemption_codes_batch_stats
    AFTER INSERT OR UPDATE ON redemption_codes
    FOR EACH ROW
    EXECUTE PROCEDURE update_batch_stats();

-- 插入默认管理员用户（用户名：admin，密码：admin123）
-- 实际部署时请修改默认密码
INSERT INTO admin_users (username, password_hash, role)
VALUES ('admin', '$2a$12$5yP0EQC9YhNbVLwX3Vx8AeqK6YrY7kK8xR5gF7K1nP8qJ2Dw7Qs6K', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 创建兑换码生成函数
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

-- 创建兑换码导出视图
CREATE OR REPLACE VIEW v_unused_redemption_codes AS
SELECT 
    rc.id,
    rc.code,
    rc.total_uses,
    rc.used_count,
    rc.batch_name,
    rc.notes,
    rc.created_at,
    rcb.usage_limit as batch_usage_limit
FROM redemption_codes rc
LEFT JOIN redemption_code_batches rcb ON rc.batch_id = rcb.id
WHERE rc.status = 'active' 
  AND rc.used_count < rc.total_uses
ORDER BY rc.created_at DESC;