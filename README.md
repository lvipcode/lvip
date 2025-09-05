# LinkedIn 数据提取系统

基于 Next.js 15 的智能销售线索数据提取平台，支持多插件协作和实时任务分配。

## 🚀 功能特性

- **🔐 兑换码验证系统** - 安全的访问控制机制
- **🔍 智能搜索引擎** - 支持多种搜索条件和筛选器
- **🤖 多插件架构** - Chrome扩展插件自动数据提取
- **📊 实时进度跟踪** - SSE实时任务状态更新
- **📈 数据质量评分** - AI驱动的数据完整性评估
- **📋 多格式导出** - 支持CSV、Excel、JSON格式导出
- **💾 数据持久化** - 基于Supabase的可靠数据存储
- **📱 响应式设计** - 完美适配各种设备尺寸

## 🛠 技术栈

- **前端**: Next.js 15 + TypeScript + Tailwind CSS
- **数据库**: Supabase PostgreSQL
- **通信**: HTTP API + Server-Sent Events (SSE)
- **插件**: Chrome Extension Manifest V3
- **数据导出**: SheetJS (xlsx) + CSV
- **样式**: Tailwind CSS + Lucide Icons

## 📦 项目结构

```
src/
├── app/                 # Next.js App Router 页面
│   ├── api/            # API 路由处理
│   │   ├── export/     # 数据导出接口
│   │   ├── plugins/    # 插件管理接口
│   │   ├── tasks/      # 任务管理接口
│   │   └── redemption-codes/ # 兑换码验证
│   ├── search/         # 搜索功能页面
│   └── layout.tsx      # 全局布局
├── components/         # 可复用组件
│   ├── ui/            # 基础UI组件
│   ├── TaskProgress.tsx    # 任务进度跟踪
│   ├── ResultDisplay.tsx   # 结果展示
│   └── SearchForm.tsx      # 搜索表单
├── lib/               # 工具库
│   ├── api.ts         # API客户端
│   ├── supabase.ts    # 数据库连接
│   └── utils.ts       # 工具函数
└── types/             # TypeScript类型定义

database/              # 数据库脚本
├── 01-create-tables.sql    # 创建数据表
├── 02-create-functions.sql # 存储过程
├── 03-seed-data.sql        # 初始数据
└── 04-scheduled-tasks.sql  # 定时任务

extension/             # Chrome扩展
├── manifest.json      # 扩展清单
├── background.js      # 后台服务
├── content.js         # 内容脚本
├── popup.html         # 弹窗界面
└── popup.js           # 弹窗逻辑
```

## ⚡ 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/lvipcode/linkedinvip.git
cd linkedinvip

# 安装依赖
npm install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑环境变量
nano .env.local
```

填写必要的环境变量：

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

### 3. 数据库初始化

在 Supabase Dashboard 中按顺序执行以下 SQL 文件：

```sql
-- 1. 创建数据表
database/01-create-tables.sql

-- 2. 创建存储过程
database/02-create-functions.sql

-- 3. 插入初始数据
database/03-seed-data.sql

-- 4. 设置定时任务
database/04-scheduled-tasks.sql
```

### 4. 启动开发服务器

```bash
# 启动开发服务器
npm run dev

# 或使用其他包管理器
yarn dev
pnpm dev
bun dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 🔧 开发命令

```bash
# 开发环境启动
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 部署前完整检查
npm run pre-deploy:check
```

## 🔌 Chrome 扩展安装

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录下的 `extension` 文件夹
5. 扩展安装完成后，配置 API 地址为 `http://localhost:3000/api`

## 💡 使用指南

### 1. 获取兑换码

联系管理员获取有效的兑换码。

### 2. 系统访问

1. 访问系统主页
2. 输入兑换码进行验证
3. 验证成功后选择搜索功能

### 3. 数据提取

1. 配置搜索参数（关键词、地点、公司等）
2. 设置提取数量上限
3. 提交任务，系统自动分配给可用插件
4. 实时监控提取进度
5. 任务完成后查看和导出结果

### 4. 结果导出

支持多种格式导出：
- **CSV**: 轻量级表格数据
- **Excel**: 包含格式化的工作表
- **JSON**: 结构化数据格式

## 📊 系统架构

### 核心组件

1. **Web应用** - Next.js前端 + API后端
2. **数据库** - Supabase PostgreSQL
3. **插件系统** - Chrome扩展自动化数据提取
4. **任务队列** - 智能任务分配和进度跟踪

### 数据流程

```
用户提交搜索任务 → 任务入队 → 插件接收 → 数据提取 → 结果存储 → 用户查看导出
```

### 通信机制

- **HTTP API**: REST风格的数据操作接口
- **Server-Sent Events**: 实时任务状态推送
- **Chrome Extension Messages**: 插件与网页通信

## 🔒 安全特性

- **兑换码验证**: 多层权限控制
- **JWT认证**: 安全的会话管理
- **数据加密**: 敏感信息加密存储
- **速率限制**: 防止API滥用
- **输入验证**: 全面的数据校验

## 🚀 部署指南

### Vercel 部署

1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 自动部署

### Docker 部署

```bash
# 构建镜像
docker build -t linkedin-extractor .

# 运行容器
docker run -p 3000:3000 linkedin-extractor
```

### 自定义部署

详见 `DEPLOYMENT_WORKFLOW_GUIDE.md` 文档。

## 📝 API 文档

### 主要接口

- `POST /api/redemption-codes/validate` - 兑换码验证
- `POST /api/tasks/create` - 创建搜索任务
- `GET /api/tasks/status/:id` - 查询任务状态
- `GET /api/tasks/results/:id` - 获取任务结果
- `GET /api/export/:id` - 导出数据

### 插件接口

- `POST /api/plugins/register` - 插件注册
- `POST /api/plugins/heartbeat` - 心跳检测
- `GET /api/plugins/tasks/stream` - SSE任务流
- `POST /api/plugins/submit` - 提交结果

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 `LICENSE` 文件。

## 📞 支持与帮助

- **问题反馈**: [GitHub Issues](https://github.com/lvipcode/linkedinvip/issues)
- **文档中心**: 查看项目根目录下的详细文档
- **技术支持**: 联系项目维护者

## 🔄 更新日志

### v1.0.0 (2025-01-28)

- ✨ 初始版本发布
- ✅ 完整的前端界面实现
- ✅ RESTful API 接口完成
- ✅ Chrome扩展插件开发完成
- ✅ 数据库架构设计完成
- ✅ 实时任务分配系统
- ✅ 多格式数据导出功能

---

**📌 注意**: 本系统仅供学习和研究使用，请遵守相关网站的使用条款和隐私政策。
