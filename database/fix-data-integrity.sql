-- 修复数据完整性问题 - 安全版本
-- 在Supabase SQL编辑器中执行这个脚本

-- 第一步：删除所有外键约束以避免冲突
ALTER TABLE redemption_codes DROP CONSTRAINT IF EXISTS fk_redemption_codes_batch_id;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_batch_id_fkey;

-- 第二步：确保所有必要的表存在
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

-- 第三步：确保 redemption_codes 表有必要的列
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS batch_name VARCHAR(100);
ALTER TABLE redemption_codes ADD COLUMN IF NOT EXISTS notes TEXT;

-- 第四步：清理无效的 batch_id 引用
-- 将所有无效的 batch_id 设为 NULL
UPDATE redemption_codes 
SET batch_id = NULL 
WHERE batch_id IS NOT NULL 
  AND batch_id NOT IN (SELECT id FROM redemption_code_batches);

-- 第五步：为没有 batch_id 的兑换码创建默认批次
DO $$
DECLARE
    default_batch_id UUID;
    codes_without_batch INTEGER;
BEGIN
    -- 计算没有 batch_id 的兑换码数量
    SELECT COUNT(*) INTO codes_without_batch 
    FROM redemption_codes 
    WHERE batch_id IS NULL;
    
    -- 如果有没有 batch_id 的兑换码，创建默认批次
    IF codes_without_batch > 0 THEN
        INSERT INTO redemption_code_batches (
            batch_name, 
            total_codes, 
            usage_limit, 
            notes, 
            created_by,
            generated_count
        ) VALUES (
            '系统默认批次', 
            codes_without_batch,
            10,
            '为现有兑换码自动创建的默认批次',
            'system',
            codes_without_batch
        ) RETURNING id INTO default_batch_id;
        
        -- 更新所有没有 batch_id 的兑换码
        UPDATE redemption_codes 
        SET batch_id = default_batch_id,
            batch_name = '系统默认批次'
        WHERE batch_id IS NULL;
        
        RAISE NOTICE '已为 % 个兑换码创建默认批次', codes_without_batch;
    END IF;
END $$;

-- 第六步：确保所有兑换码都有有效的 batch_id
-- 如果仍然有 NULL 的 batch_id，创建个体批次
DO $$
DECLARE
    code_record RECORD;
    individual_batch_id UUID;
BEGIN
    FOR code_record IN 
        SELECT id, code FROM redemption_codes WHERE batch_id IS NULL
    LOOP
        -- 为每个无批次的兑换码创建个体批次
        INSERT INTO redemption_code_batches (
            batch_name, 
            total_codes, 
            usage_limit, 
            notes, 
            created_by,
            generated_count
        ) VALUES (
            '个体批次-' || code_record.code, 
            1,
            10,
            '为单个兑换码自动创建的批次',
            'system',
            1
        ) RETURNING id INTO individual_batch_id;
        
        UPDATE redemption_codes 
        SET batch_id = individual_batch_id,
            batch_name = '个体批次-' || code_record.code
        WHERE id = code_record.id;
    END LOOP;
END $$;

-- 第七步：现在可以安全地添加外键约束
ALTER TABLE redemption_codes 
ADD CONSTRAINT fk_redemption_codes_batch_id 
FOREIGN KEY (batch_id) REFERENCES redemption_code_batches(id);

-- 第八步：确保其他表结构正确
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

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 第九步：创建必要的索引
CREATE INDEX IF NOT EXISTS idx_redemption_codes_batch_id ON redemption_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_redemption_codes_code ON redemption_codes(code);
CREATE INDEX IF NOT EXISTS idx_redemption_codes_status ON redemption_codes(status);
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);

-- 第十步：更新批次统计信息
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

-- 第十一步：创建兑换码生成函数
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
        -- 生成8位随机兑换码，确保唯一性
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
    
    -- 更新批次统计
    UPDATE redemption_code_batches 
    SET generated_count = p_quantity
    WHERE id = v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql;

-- 验证数据完整性
DO $$
DECLARE
    orphan_codes INTEGER;
    total_codes INTEGER;
    total_batches INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_codes 
    FROM redemption_codes 
    WHERE batch_id IS NULL OR batch_id NOT IN (SELECT id FROM redemption_code_batches);
    
    SELECT COUNT(*) INTO total_codes FROM redemption_codes;
    SELECT COUNT(*) INTO total_batches FROM redemption_code_batches;
    
    RAISE NOTICE '数据完整性检查：';
    RAISE NOTICE '- 总兑换码数量: %', total_codes;
    RAISE NOTICE '- 总批次数量: %', total_batches;
    RAISE NOTICE '- 孤立兑换码数量: %', orphan_codes;
    
    IF orphan_codes > 0 THEN
        RAISE WARNING '仍有 % 个孤立的兑换码！', orphan_codes;
    ELSE
        RAISE NOTICE '✅ 数据完整性检查通过！';
    END IF;
END $$;

-- 完成提示
SELECT '数据完整性修复完成！现在可以正常使用管理后台了。' as message;