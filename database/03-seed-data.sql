-- LinkedIn数据提取系统 - 种子数据
-- 基于CLAUDE-REDESIGN.md设计

-- 清理现有数据
DELETE FROM system_logs;
DELETE FROM cleanup_tasks;
DELETE FROM task_results;
DELETE FROM task_queue;
DELETE FROM plugin_registry;
DELETE FROM redemption_codes;
DELETE FROM admin_users;

-- 1. 创建管理员账户
-- 密码: admin123 (已使用bcrypt加密)
INSERT INTO admin_users (username, password_hash, role) VALUES 
('admin', '$2b$10$rQa8cTHhRp.mFaP.v8vQp.YvF4u.YzZ3e7kMjH8x1x1x1x1x1x1x1u', 'admin'),
('system', '$2b$10$rQa8cTHhRp.mFaP.v8vQp.YvF4u.YzZ3e7kMjH8x1x1x1x1x1x1x1u', 'admin');

-- 2. 生成测试兑换码
INSERT INTO redemption_codes (code, total_uses, daily_limit, single_limit, status) VALUES 
('TEST001', 10, 10, 500, 'active'),
('TEST002', 20, 10, 500, 'active'),
('TEST003', 5, 5, 200, 'active'),
('DEMO001', 50, 10, 500, 'active'),
('DEMO002', 100, 15, 1000, 'active');

-- 生成一些有过期时间的测试码
INSERT INTO redemption_codes (code, total_uses, daily_limit, single_limit, status, expires_at) VALUES 
('TEMP001', 10, 10, 500, 'active', NOW() + INTERVAL '30 days'),
('TEMP002', 5, 5, 200, 'active', NOW() + INTERVAL '7 days'),
('TEMP003', 20, 10, 500, 'active', NOW() + INTERVAL '1 day');

-- 3. 创建一些示例插件记录
INSERT INTO plugin_registry (plugin_id, version, capabilities, status, last_heartbeat, total_tasks, successful_tasks) VALUES 
('plugin-demo-001', '1.0.0', '["person-search"]', 'offline', NOW() - INTERVAL '10 minutes', 0, 0),
('plugin-demo-002', '1.0.0', '["person-search"]', 'offline', NOW() - INTERVAL '1 hour', 0, 0);

-- 4. 创建一些示例系统日志
INSERT INTO system_logs (log_level, log_type, message, details) VALUES 
('info', 'system_event', '系统初始化完成', '{"version": "1.0.0", "database_setup": true}'),
('info', 'system_event', '种子数据创建完成', '{"redemption_codes": 8, "admin_users": 2}');

-- 5. 创建定期清理任务记录
INSERT INTO cleanup_tasks (task_type, status, target_date) VALUES 
('data_cleanup', 'completed', CURRENT_DATE - INTERVAL '1 day'),
('log_cleanup', 'completed', CURRENT_DATE - INTERVAL '1 day');

-- 6. 创建一些测试任务历史记录（用于展示）
DO $$
DECLARE 
    v_code_id UUID;
    v_task_id UUID;
BEGIN
    -- 获取测试兑换码ID
    SELECT id INTO v_code_id FROM redemption_codes WHERE code = 'TEST001' LIMIT 1;
    
    -- 创建一个已完成的测试任务
    INSERT INTO task_queue (
        redemption_code_id,
        task_type,
        search_params,
        max_results,
        status,
        assigned_plugin_id,
        assigned_at,
        started_at,
        completed_at,
        processed_count
    ) VALUES (
        v_code_id,
        'person-search',
        '{"keywords": "产品经理", "location": "北京", "company": ""}',
        100,
        'completed',
        'plugin-demo-001',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '1 hour',
        85
    ) RETURNING id INTO v_task_id;
    
    -- 为这个任务创建一些示例结果
    INSERT INTO task_results (
        task_id,
        plugin_id,
        result_data,
        result_count,
        data_quality_score
    ) VALUES (
        v_task_id,
        'plugin-demo-001',
        '[
            {
                "name": "张三",
                "company": "腾讯科技",
                "position": "高级产品经理",
                "experience": "5年",
                "about": "专注于用户体验设计和产品策略...",
                "location": "北京市",
                "linkedinUrl": "https://linkedin.com/in/example1",
                "extractedAt": "2025-01-20T10:30:00Z",
                "dataQuality": 0.95
            },
            {
                "name": "李四",
                "company": "字节跳动",
                "position": "产品经理",
                "experience": "3年",
                "about": "关注移动互联网产品...",
                "location": "北京市",
                "linkedinUrl": "https://linkedin.com/in/example2",
                "extractedAt": "2025-01-20T10:32:00Z",
                "dataQuality": 0.87
            }
        ]',
        2,
        0.91
    );
    
    -- 更新兑换码使用次数
    UPDATE redemption_codes 
    SET used_count = used_count + 1 
    WHERE id = v_code_id;
    
    -- 记录任务完成日志
    INSERT INTO system_logs (
        log_level,
        log_type,
        task_id,
        plugin_id,
        message,
        details
    ) VALUES (
        'info',
        'task_event',
        v_task_id,
        'plugin-demo-001',
        '测试任务完成',
        '{"processed": 85, "expected": 100, "success_rate": 0.85}'
    );
END $$;

-- 验证数据创建结果
SELECT 'redemption_codes' as table_name, COUNT(*) as count FROM redemption_codes
UNION ALL
SELECT 'admin_users', COUNT(*) FROM admin_users
UNION ALL  
SELECT 'plugin_registry', COUNT(*) FROM plugin_registry
UNION ALL
SELECT 'task_queue', COUNT(*) FROM task_queue
UNION ALL
SELECT 'task_results', COUNT(*) FROM task_results
UNION ALL
SELECT 'system_logs', COUNT(*) FROM system_logs
UNION ALL
SELECT 'cleanup_tasks', COUNT(*) FROM cleanup_tasks;