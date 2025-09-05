# LinkedIn数据提取系统 - 最终技术架构方案

## 🎯 项目重新定位

LinkedIn销售数据提取系统，专注于为销售团队提供高效的多维度LinkedIn数据获取服务，支持分布式Chrome扩展协作和智能任务分配。

---

## 🏗 **最终确定的核心架构**

### **混合通信架构（HTTP + SSE）**
```
[Chrome插件] ←→ [HTTP API + Server-Sent Events] ←→ [Vercel API Routes] ←→ [Supabase数据库]
     ↓                        ↓                           ↓                    ↓
  数据提取              任务分发通知                  业务逻辑              数据存储
  结果提交              实时推送                    状态管理              日志记录
```

### 技术栈选择
- **前端框架**: Next.js 15 + TypeScript + Tailwind CSS
- **云端部署**: Vercel (前端) + Supabase (数据库)
- **扩展技术**: Chrome Extension Manifest V3
- **通信协议**: HTTP API + Server-Sent Events (SSE)
- **状态管理**: React Context + Supabase数据库

---

## 🔌 **Chrome扩展通信机制**

### **HTTP API接口**（稳定可靠）
```javascript
// 插件注册
POST /api/plugins/register
{
  "pluginId": "chrome-extension-uuid",
  "version": "1.0.0",
  "capabilities": ["person-search"]
}

// 定时心跳（30秒间隔）
POST /api/plugins/heartbeat
{
  "pluginId": "plugin-uuid",
  "status": "idle" | "busy",
  "currentTask": "task-id" | null
}

// 提交任务结果（支持部分结果）
POST /api/plugins/submit
{
  "taskId": "task-uuid",
  "pluginId": "plugin-uuid",
  "results": [...],
  "status": "completed" | "partial" | "failed",
  "processedCount": 300,  // 实际处理数量
  "totalCount": 500       // 目标总数量
}
```

### **Server-Sent Events推送**（实时通知）
```javascript
// 插件监听任务分配
GET /api/plugins/tasks/stream?pluginId=xxx

// 服务器推送任务：
data: {
  "taskId": "task-uuid",
  "taskType": "person-search", 
  "searchParams": {...},
  "maxResults": 500,
  "timeout": 600000  // 10分钟超时
}
```

### **插件配置要求**
- **接口地址配置**: 插件需输入完整地址 `https://your-app.vercel.app`
- **地址验证**: 通过ping测试验证地址有效性
- **心跳机制**: 30秒间隔，超过5分钟无响应 = 掉线
- **自动重连**: 断线后立即尝试重连

---

## 📋 **多插件任务分配系统**

### **插件管理策略**
- **数量限制**: 无限制插件接入
- **授权机制**: 插件必须配置正确接口地址才能使用
- **状态监控**: 实时跟踪在线状态、任务处理数、成功率、最后活跃时间
- **离线处理**: 超过5分钟无心跳自动标记离线

### **任务处理逻辑**
- **任务分配**: 单个插件处理完整任务（不拆分大任务）
- **优先级**: 先来先服务，按任务创建时间排序
- **并发控制**: 单个兑换码同时只能有1个活跃任务
- **任务超时**: 插件接收任务后10分钟未完成算超时
- **失败处理**: 任务失败直接标记失败，不自动重试
- **部分结果**: 任务失败时保存已处理的部分结果

---

## 🗄 **数据库最终设计**

### **核心数据表**
```sql
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
```

---

## 📊 **LinkedIn数据字段定义**

### **标准化数据结构**
```json
{
  "name": "张三",                    // 姓名
  "company": "阿里巴巴集团",         // 公司
  "position": "高级前端工程师",       // 职位
  "experience": "5年",              // 工作年限
  "about": "专注于React和Node.js开发...", // About信息
  "location": "杭州市",             // 地点
  "linkedinUrl": "https://linkedin.com/in/zhangsan",
  "extractedAt": "2025-01-20T10:30:00Z",
  "dataQuality": 0.95
}
```

### **数据质量评分规则**
- 所有字段完整：1.0分
- 缺少1-2个字段：0.8分  
- 缺少3-4个字段：0.6分
- 只有姓名和公司：0.4分
- 数据明显错误：0.2分

---

## 🌐 **前端多功能页面架构**

### **页面结构设计**
```
src/app/
├── page.tsx                    # 主页 - 兑换码验证
├── search/
│   └── person/                 # 人员搜索（优先开发）
│       ├── page.tsx           # 搜索界面
│       ├── components/        # 搜索组件
│       │   ├── SearchForm.tsx
│       │   ├── TaskProgress.tsx
│       │   └── ResultsList.tsx
│       └── results/
│           └── page.tsx       # 结果详情页
├── admin/                      # 管理后台
│   ├── dashboard/             # 概览
│   ├── plugins/               # 插件监控
│   ├── tasks/                 # 任务监控  
│   └── codes/                 # 兑换码管理
└── api/                       # API路由
    ├── plugins/               # 插件相关API
    │   ├── register/
    │   ├── heartbeat/
    │   ├── submit/
    │   └── tasks/
    │       └── stream/        # SSE端点
    ├── tasks/                 # 任务管理API
    └── admin/                 # 管理API
```

### **核心组件设计**
```typescript
// 搜索表单组件
interface SearchFormProps {
  onSubmit: (params: SearchParams) => void
  isLoading: boolean
  remainingUses: number
}

// 任务进度组件  
interface TaskProgressProps {
  taskId: string
  progress: number        // 0-100百分比
  status: TaskStatus
  processedCount: number  // 支持部分结果显示
  totalCount: number
}

// 结果列表组件
interface ResultsListProps {
  results: LinkedInProfile[]
  onExport: () => void    // 只支持Excel导出
  showQualityScore: boolean
}
```

### **组件设计原则**
- **模块化设计**: 每个搜索类型独立组件
- **可复用性**: 不同搜索类型共用组件设计
- **预留扩展**: 为未来功能预留页面和路由

---

## 🔒 **安全防护机制**

### **API安全**
```javascript
// JWT Token认证
const authenticatePlugin = (req, res, next) => {
  const token = req.headers.authorization
  // 验证插件身份
}

// 频率限制
const rateLimiter = {
  windowMs: 60 * 1000,      // 1分钟窗口
  maxRequests: 120,         // 最多120次请求
  skipSuccessfulRequests: true
}
```

### **插件验证**
```javascript
// 插件ID验证
const validatePluginId = (pluginId) => {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(pluginId)
}

// 数据格式验证
const validateTaskResult = (result) => {
  const required = ['name', 'company', 'position']
  return required.every(field => result[field] && result[field].trim())
}
```

### **详细日志记录**
```javascript
// 详细操作日志
const logEvent = (level, type, details) => {
  return supabase.from('system_logs').insert({
    log_level: level,
    log_type: type,
    plugin_id: details.pluginId,
    task_id: details.taskId,
    user_ip: details.ip,
    message: details.message,
    details: details.data
  })
}
```

---

## 🔧 **API接口设计**

### **插件管理接口**
```typescript
POST /api/plugins/register     // 插件注册
POST /api/plugins/heartbeat    // 心跳保持
GET  /api/plugins/tasks/stream // SSE获取任务分配
POST /api/plugins/submit       // 提交任务结果
```

### **任务管理接口**
```typescript
POST /api/tasks/create         // 创建搜索任务
GET  /api/tasks/status/:id     // 查询任务状态
GET  /api/tasks/results/:id    // 获取任务结果
POST /api/tasks/cancel/:id     // 取消任务
```

### **用户功能接口**
```typescript
POST /api/codes/validate       // 验证兑换码
GET  /api/search/history       // 搜索历史
POST /api/export/results       // Excel导出
```

### **管理后台接口**
```typescript
GET  /api/admin/dashboard      // 系统概览
GET  /api/admin/plugins        // 插件状态列表
GET  /api/admin/tasks          // 任务监控
POST /api/admin/codes/generate // 生成兑换码
```

---

## ✅ **最终确定的核心需求**

### **架构决策**
- ✅ HTTP + SSE混合通信架构
- ✅ 单插件完整任务处理（不拆分）
- ✅ 部分结果保存机制
- ✅ 7天数据自动清理
- ✅ 详细日志记录
- ✅ 基础安全防护机制

### **用户权限控制**
- ✅ 所有兑换码功能完全相同
- ✅ 每天最多10次搜索，单次最多500条结果
- ✅ 兑换码完成一个任务后才能提交下一个
- ✅ 插件无频率限制（不考虑反爬虫）

### **用户体验设计**
- ✅ 进度显示：只显示百分比进度
- ✅ 错误通知：任务失败仅页面提示
- ✅ 导出功能：只支持Excel格式，用户主动触发
- ✅ 结果过滤：预留功能，暂不实现

### **LinkedIn数据字段**
- ✅ 姓名、公司、职位、工作年限、About、地点（6个核心字段）
- ✅ 数据质量评分系统
- ✅ 标准化JSON格式存储

### **搜索功能规划**
- ✅ 优先开发"搜索人"功能
- ✅ 暂时只支持关键词搜索，国家等筛选条件后期完善
- ✅ 预留公司搜索、通过公司找人等功能页面

---

## 🚀 **开发执行计划**

### **阶段1：后端核心（2天）**
1. **数据库重建**
   - 删除现有数据，执行新表结构
   - 设置索引和约束
   - 初始化管理员账户

2. **HTTP API开发**  
   - 插件注册、心跳API
   - 任务创建、状态查询API
   - 结果提交API

3. **SSE推送实现**
   - 任务分配SSE端点
   - 实时状态推送逻辑

### **阶段2：Chrome扩展重构（1天）**
1. **简化扩展结构**
   - 最小化manifest权限
   - 清理冗余文件

2. **通信逻辑实现**
   - HTTP API客户端
   - SSE事件监听
   - 错误处理和重连

3. **数据提取核心**
   - LinkedIn页面数据提取（6个字段）
   - 标准化数据格式
   - 部分结果处理逻辑

### **阶段3：前端开发（2天）**
1. **搜索人页面**
   - 搜索表单设计
   - 实时进度显示
   - 结果展示和Excel导出

2. **管理后台完善**
   - 插件监控面板（在线状态、任务数量、成功率、最后活跃时间）
   - 任务状态监控
   - 详细日志查看

### **阶段4：集成测试（1天）**
1. **完整流程测试**
   - 端到端功能验证
   - 多插件协作测试
   - 异常情况处理

2. **性能优化**
   - API响应优化
   - 数据库查询优化
   - 前端渲染优化

---

## 📊 **预期性能指标**

- **响应时间**: API接口响应 < 500ms
- **任务处理**: 单个搜索任务 < 10分钟完成
- **并发支持**: 支持无限插件同时工作
- **成功率**: 数据提取成功率 > 90%（包含部分成功）
- **可用性**: 系统可用性 > 99%

---

## 🎯 **数据迁移策略**

### **彻底重建**
- ✅ 删除所有现有数据
- ✅ 兑换码重新生成
- ✅ 搜索历史从零开始
- ✅ 重新初始化管理员账户

---

**架构方案最终确定，总计6天开发周期，可以开始具体实施！**