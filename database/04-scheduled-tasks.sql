-- LinkedIn数据提取系统 - 定时任务和数据清理
-- 基于CLAUDE-REDESIGN.md设计

-- 1. 创建定时清理触发器
CREATE OR REPLACE FUNCTION trigger_daily_cleanup()
RETURNS TRIGGER AS $$
DECLARE
    v_cleanup_needed BOOLEAN := FALSE;
BEGIN
    -- 检查是否需要执行清理（每天只执行一次）
    IF NOT EXISTS (
        SELECT 1 FROM cleanup_tasks 
        WHERE task_type = 'daily_cleanup' 
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
    ) THEN
        v_cleanup_needed := TRUE;
    END IF;
    
    -- 如果需要清理，创建清理任务
    IF v_cleanup_needed THEN
        INSERT INTO cleanup_tasks (task_type, status, target_date)
        VALUES ('daily_cleanup', 'pending', CURRENT_DATE);
        
        -- 执行清理
        PERFORM cleanup_old_data();
        
        -- 标记清理完成
        UPDATE cleanup_tasks 
        SET status = 'completed', records_deleted = 1
        WHERE task_type = 'daily_cleanup' 
        AND DATE(created_at) = CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建系统健康检查函数
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT,
    checked_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- 检查在线插件数量
    RETURN QUERY 
    SELECT 
        'active_plugins'::TEXT,
        CASE 
            WHEN COUNT(*) >= 1 THEN 'healthy'::TEXT
            ELSE 'warning'::TEXT
        END,
        CONCAT(COUNT(*), ' plugins online')::TEXT,
        NOW()
    FROM plugin_registry 
    WHERE status = 'online' 
    AND last_heartbeat > NOW() - INTERVAL '5 minutes';
    
    -- 检查待处理任务数量
    RETURN QUERY
    SELECT 
        'pending_tasks'::TEXT,
        CASE 
            WHEN COUNT(*) <= 10 THEN 'healthy'::TEXT
            WHEN COUNT(*) <= 50 THEN 'warning'::TEXT
            ELSE 'critical'::TEXT
        END,
        CONCAT(COUNT(*), ' tasks pending')::TEXT,
        NOW()
    FROM task_queue 
    WHERE status = 'pending';
    
    -- 检查失败任务比率
    RETURN QUERY
    SELECT 
        'task_success_rate'::TEXT,
        CASE 
            WHEN 
                (SELECT COUNT(*) FROM task_queue WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours') * 100.0 / 
                NULLIF((SELECT COUNT(*) FROM task_queue WHERE status IN ('completed', 'failed') AND created_at > NOW() - INTERVAL '24 hours'), 0) 
                >= 80 THEN 'healthy'::TEXT
            WHEN 
                (SELECT COUNT(*) FROM task_queue WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours') * 100.0 / 
                NULLIF((SELECT COUNT(*) FROM task_queue WHERE status IN ('completed', 'failed') AND created_at > NOW() - INTERVAL '24 hours'), 0) 
                >= 60 THEN 'warning'::TEXT
            ELSE 'critical'::TEXT
        END,
        CONCAT(
            ROUND(
                (SELECT COUNT(*) FROM task_queue WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours') * 100.0 / 
                NULLIF((SELECT COUNT(*) FROM task_queue WHERE status IN ('completed', 'failed') AND created_at > NOW() - INTERVAL '24 hours'), 0), 
                1
            ), 
            '% success rate (24h)'
        )::TEXT,
        NOW();
    
    -- 检查数据库大小
    RETURN QUERY
    SELECT 
        'database_size'::TEXT,
        CASE 
            WHEN pg_database_size(current_database()) < 1073741824 THEN 'healthy'::TEXT  -- < 1GB
            WHEN pg_database_size(current_database()) < 5368709120 THEN 'warning'::TEXT  -- < 5GB
            ELSE 'critical'::TEXT
        END,
        pg_size_pretty(pg_database_size(current_database()))::TEXT,
        NOW();
END;
$$ LANGUAGE plpgsql;

-- 3. 创建插件性能统计函数
CREATE OR REPLACE FUNCTION get_plugin_performance_stats(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    plugin_id VARCHAR(100),
    status VARCHAR(20),
    total_tasks INTEGER,
    completed_tasks INTEGER,
    failed_tasks INTEGER,
    success_rate DECIMAL(5,2),
    avg_processing_time INTERVAL,
    last_active TIMESTAMP,
    performance_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.plugin_id,
        pr.status,
        COUNT(tq.id)::INTEGER as total_tasks,
        COUNT(CASE WHEN tq.status = 'completed' THEN 1 END)::INTEGER as completed_tasks,
        COUNT(CASE WHEN tq.status = 'failed' THEN 1 END)::INTEGER as failed_tasks,
        ROUND(
            COUNT(CASE WHEN tq.status = 'completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN tq.status IN ('completed', 'failed') THEN 1 END), 0), 
            2
        ) as success_rate,
        AVG(CASE 
            WHEN tq.status IN ('completed', 'failed') AND tq.started_at IS NOT NULL AND tq.completed_at IS NOT NULL 
            THEN tq.completed_at - tq.started_at 
        END) as avg_processing_time,
        pr.last_heartbeat,
        pr.performance_score
    FROM plugin_registry pr
    LEFT JOIN task_queue tq ON tq.assigned_plugin_id = pr.plugin_id 
        AND tq.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY pr.plugin_id, pr.status, pr.last_heartbeat, pr.performance_score
    ORDER BY success_rate DESC, total_tasks DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建任务分配优化函数
CREATE OR REPLACE FUNCTION get_best_plugin_for_task(p_task_type VARCHAR(50))
RETURNS VARCHAR(100) AS $$
DECLARE
    v_plugin_id VARCHAR(100);
BEGIN
    -- 选择最佳插件：在线 + 空闲 + 性能评分最高
    SELECT plugin_id INTO v_plugin_id
    FROM plugin_registry
    WHERE status = 'online' 
    AND last_heartbeat > NOW() - INTERVAL '2 minutes'
    AND capabilities @> jsonb_build_array(p_task_type)
    ORDER BY performance_score DESC, last_heartbeat DESC
    LIMIT 1;
    
    -- 如果没有完全空闲的插件，选择在线且性能最好的
    IF v_plugin_id IS NULL THEN
        SELECT plugin_id INTO v_plugin_id
        FROM plugin_registry
        WHERE status IN ('online', 'busy')
        AND last_heartbeat > NOW() - INTERVAL '2 minutes' 
        AND capabilities @> jsonb_build_array(p_task_type)
        ORDER BY 
            CASE WHEN status = 'online' THEN 1 ELSE 2 END,
            performance_score DESC, 
            last_heartbeat DESC
        LIMIT 1;
    END IF;
    
    RETURN v_plugin_id;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建任务分配函数
CREATE OR REPLACE FUNCTION assign_task_to_plugin(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_task task_queue%ROWTYPE;
    v_plugin_id VARCHAR(100);
BEGIN
    -- 获取待分配任务
    SELECT * INTO v_task
    FROM task_queue
    WHERE id = p_task_id AND status = 'pending';
    
    IF v_task.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 选择最佳插件
    SELECT get_best_plugin_for_task(v_task.task_type) INTO v_plugin_id;
    
    IF v_plugin_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 分配任务
    UPDATE task_queue 
    SET 
        status = 'assigned',
        assigned_plugin_id = v_plugin_id,
        assigned_at = NOW()
    WHERE id = p_task_id;
    
    -- 更新插件状态为忙碌
    UPDATE plugin_registry 
    SET status = 'busy' 
    WHERE plugin_id = v_plugin_id;
    
    -- 记录分配日志
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
        p_task_id,
        v_plugin_id,
        '任务已分配给插件',
        jsonb_build_object('task_type', v_task.task_type, 'max_results', v_task.max_results)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建数据质量监控函数
CREATE OR REPLACE FUNCTION monitor_data_quality()
RETURNS TABLE (
    metric_name TEXT,
    metric_value DECIMAL(5,2),
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- 总体数据质量评分
    RETURN QUERY
    SELECT 
        'overall_quality_score'::TEXT,
        ROUND(AVG(data_quality_score), 2),
        CASE 
            WHEN AVG(data_quality_score) >= 0.9 THEN 'excellent'::TEXT
            WHEN AVG(data_quality_score) >= 0.8 THEN 'good'::TEXT
            WHEN AVG(data_quality_score) >= 0.7 THEN 'fair'::TEXT
            ELSE 'poor'::TEXT
        END,
        CONCAT('Based on ', COUNT(*), ' results in last 24h')::TEXT
    FROM task_results 
    WHERE created_at > NOW() - INTERVAL '24 hours';
    
    -- 完整性检查
    RETURN QUERY
    SELECT 
        'data_completeness'::TEXT,
        ROUND(
            COUNT(CASE WHEN (result_data::jsonb ->> 'name') IS NOT NULL 
                       AND (result_data::jsonb ->> 'company') IS NOT NULL 
                       AND (result_data::jsonb ->> 'position') IS NOT NULL 
                  THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 
            2
        ),
        CASE 
            WHEN COUNT(CASE WHEN (result_data::jsonb ->> 'name') IS NOT NULL 
                               AND (result_data::jsonb ->> 'company') IS NOT NULL 
                               AND (result_data::jsonb ->> 'position') IS NOT NULL 
                        THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) >= 95 THEN 'excellent'::TEXT
            WHEN COUNT(CASE WHEN (result_data::jsonb ->> 'name') IS NOT NULL 
                               AND (result_data::jsonb ->> 'company') IS NOT NULL 
                               AND (result_data::jsonb ->> 'position') IS NOT NULL 
                        THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) >= 85 THEN 'good'::TEXT
            ELSE 'needs_improvement'::TEXT
        END,
        'Percentage of records with name, company, and position'::TEXT
    FROM task_results 
    WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 创建数据完整性检查
INSERT INTO system_logs (log_level, log_type, message, details) VALUES 
('info', 'system_event', '定时任务和清理函数创建完成', '{"functions": 6, "health_checks": true}');