-- LinkedIn数据提取系统 - 数据库函数
-- 基于CLAUDE-REDESIGN.md设计

-- 1. 验证兑换码函数
CREATE OR REPLACE FUNCTION validate_redemption_code(
    p_code VARCHAR(50)
)
RETURNS TABLE (
    is_valid BOOLEAN,
    code_id UUID,
    remaining_uses INTEGER,
    daily_remaining INTEGER,
    single_limit INTEGER,
    message TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_code_record redemption_codes%ROWTYPE;
    v_daily_usage INTEGER;
BEGIN
    -- 查找兑换码
    SELECT * INTO v_code_record
    FROM redemption_codes
    WHERE code = p_code AND status = 'active';
    
    -- 兑换码不存在或已失效
    IF v_code_record.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 0, '兑换码无效或已失效'::TEXT;
        RETURN;
    END IF;
    
    -- 检查是否过期
    IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 0, 0, v_code_record.single_limit, '兑换码已过期'::TEXT;
        RETURN;
    END IF;
    
    -- 检查总使用次数
    IF v_code_record.used_count >= v_code_record.total_uses THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 0, 0, v_code_record.single_limit, '兑换码使用次数已达上限'::TEXT;
        RETURN;
    END IF;
    
    -- 检查今日使用次数
    SELECT COUNT(*) INTO v_daily_usage
    FROM task_queue
    WHERE redemption_code_id = v_code_record.id
    AND DATE(created_at) = CURRENT_DATE;
    
    IF v_daily_usage >= v_code_record.daily_limit THEN
        RETURN QUERY SELECT FALSE, v_code_record.id, 
                           v_code_record.total_uses - v_code_record.used_count, 
                           0, 
                           v_code_record.single_limit, 
                           '今日使用次数已达上限'::TEXT;
        RETURN;
    END IF;
    
    -- 验证成功
    RETURN QUERY SELECT TRUE, 
                       v_code_record.id, 
                       v_code_record.total_uses - v_code_record.used_count,
                       v_code_record.daily_limit - v_daily_usage,
                       v_code_record.single_limit,
                       '验证成功'::TEXT;
END;
$$;

-- 2. 创建搜索任务函数
CREATE OR REPLACE FUNCTION create_search_task(
    p_code VARCHAR(50),
    p_task_type VARCHAR(50),
    p_search_params JSONB,
    p_max_results INTEGER DEFAULT 500
)
RETURNS TABLE (
    success BOOLEAN,
    task_id UUID,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_validation_result RECORD;
    v_task_id UUID;
    v_timeout_at TIMESTAMP;
BEGIN
    -- 验证兑换码
    SELECT * INTO v_validation_result
    FROM validate_redemption_code(p_code);
    
    IF NOT v_validation_result.is_valid THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, v_validation_result.message;
        RETURN;
    END IF;
    
    -- 检查是否有正在处理的任务
    IF EXISTS (
        SELECT 1 FROM task_queue 
        WHERE redemption_code_id = v_validation_result.code_id 
        AND status IN ('pending', 'assigned', 'processing')
    ) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, '当前有任务正在处理中，请等待完成后再提交新任务'::TEXT;
        RETURN;
    END IF;
    
    -- 检查单次结果数量限制
    IF p_max_results > v_validation_result.single_limit THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 
                           CONCAT('单次搜索结果数量不能超过 ', v_validation_result.single_limit, ' 条')::TEXT;
        RETURN;
    END IF;
    
    -- 设置超时时间（10分钟）
    v_timeout_at := NOW() + INTERVAL '10 minutes';
    
    -- 创建任务
    INSERT INTO task_queue (
        redemption_code_id,
        task_type,
        search_params,
        max_results,
        status,
        timeout_at
    ) VALUES (
        v_validation_result.code_id,
        p_task_type,
        p_search_params,
        p_max_results,
        'pending',
        v_timeout_at
    ) RETURNING id INTO v_task_id;
    
    -- 记录日志
    INSERT INTO system_logs (
        log_level,
        log_type,
        task_id,
        message,
        details
    ) VALUES (
        'info',
        'task_event',
        v_task_id,
        '新建搜索任务',
        jsonb_build_object(
            'task_type', p_task_type,
            'max_results', p_max_results,
            'code_id', v_validation_result.code_id
        )
    );
    
    RETURN QUERY SELECT TRUE, v_task_id, '任务创建成功'::TEXT;
END;
$$;

-- 3. 获取任务状态函数
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
LANGUAGE plpgsql
AS $$
DECLARE
    v_task task_queue%ROWTYPE;
    v_progress INTEGER;
    v_estimated TIMESTAMP;
BEGIN
    -- 查找任务
    SELECT * INTO v_task
    FROM task_queue
    WHERE id = p_task_id;
    
    IF v_task.id IS NULL THEN
        RETURN QUERY SELECT p_task_id, 'not_found'::VARCHAR(20), 0, 0, 0, 
                           NULL::VARCHAR(100), NULL::TIMESTAMP, NULL::TIMESTAMP, 
                           '任务不存在'::TEXT;
        RETURN;
    END IF;
    
    -- 计算进度
    v_progress := CASE 
        WHEN v_task.max_results = 0 THEN 0
        ELSE LEAST(100, (v_task.processed_count * 100) / v_task.max_results)
    END;
    
    -- 估算完成时间
    IF v_task.status IN ('processing') AND v_task.started_at IS NOT NULL AND v_task.processed_count > 0 THEN
        v_estimated := v_task.started_at + 
                       ((NOW() - v_task.started_at) * v_task.max_results / v_task.processed_count);
    ELSE
        v_estimated := NULL;
    END IF;
    
    RETURN QUERY SELECT v_task.id,
                       v_task.status,
                       v_progress,
                       v_task.processed_count,
                       v_task.max_results,
                       v_task.assigned_plugin_id,
                       v_task.started_at,
                       v_estimated,
                       CASE v_task.status
                           WHEN 'pending' THEN '等待插件处理'
                           WHEN 'assigned' THEN '已分配给插件'
                           WHEN 'processing' THEN '正在提取数据'
                           WHEN 'completed' THEN '任务已完成'
                           WHEN 'failed' THEN '任务失败'
                           WHEN 'partial' THEN '部分完成'
                           ELSE '未知状态'
                       END::TEXT;
END;
$$;

-- 4. 插件心跳更新函数
CREATE OR REPLACE FUNCTION update_plugin_heartbeat(
    p_plugin_id VARCHAR(100),
    p_status VARCHAR(20),
    p_current_task UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- 更新或插入插件状态
    INSERT INTO plugin_registry (plugin_id, status, last_heartbeat, version, capabilities)
    VALUES (p_plugin_id, p_status, NOW(), '1.0.0', '["person-search"]'::JSONB)
    ON CONFLICT (plugin_id) 
    DO UPDATE SET 
        status = p_status,
        last_heartbeat = NOW();
    
    -- 记录心跳日志
    INSERT INTO system_logs (
        log_level,
        log_type,
        plugin_id,
        task_id,
        message,
        details
    ) VALUES (
        'debug',
        'plugin_event',
        p_plugin_id,
        p_current_task,
        '插件心跳更新',
        jsonb_build_object('status', p_status)
    );
    
    RETURN TRUE;
END;
$$;

-- 5. 自动清理过期数据函数
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_total_deleted INTEGER := 0;
BEGIN
    -- 清理7天前的系统日志
    DELETE FROM system_logs 
    WHERE created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_deleted_count;
    
    -- 清理7天前的已完成任务结果
    DELETE FROM task_results 
    WHERE task_id IN (
        SELECT id FROM task_queue 
        WHERE status IN ('completed', 'failed', 'partial') 
        AND completed_at < NOW() - INTERVAL '7 days'
    );
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_deleted_count;
    
    -- 清理7天前的已完成任务
    DELETE FROM task_queue 
    WHERE status IN ('completed', 'failed', 'partial') 
    AND completed_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_deleted_count;
    
    -- 标记离线插件（5分钟无心跳）
    UPDATE plugin_registry 
    SET status = 'offline' 
    WHERE last_heartbeat < NOW() - INTERVAL '5 minutes' 
    AND status != 'offline';
    
    -- 重置超时任务
    UPDATE task_queue 
    SET status = 'failed',
        completed_at = NOW()
    WHERE status IN ('assigned', 'processing') 
    AND timeout_at < NOW();
    
    -- 记录清理日志
    INSERT INTO system_logs (
        log_level,
        log_type,
        message,
        details
    ) VALUES (
        'info',
        'system_event',
        '自动数据清理完成',
        jsonb_build_object('deleted_records', v_total_deleted)
    );
    
    RETURN v_total_deleted;
END;
$$;