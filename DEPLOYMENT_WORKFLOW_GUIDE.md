# GitHub + Vercel 部署工作流指南

基于**"本地测试优先，分阶段部署"**策略的完整配置指南

---

## 🎯 **部署策略总览**

```
📱 本地开发 (第1-4天上午) → 🚀 预览环境 (第4天下午) → 🎉 生产环境 (第6天下午)
     localhost:3000          git push origin dev        git push origin main
```

---

## 📦 **GitHub仓库设置**

### 1. 创建GitHub仓库
```bash
# 本地项目初始化
cd C:\wz\linkedin2
git init
git add .
git commit -m "initial: 项目初始化和基础架构"

# 创建远程仓库连接
git remote add origin https://github.com/your-username/linkedin-data-extractor.git
git branch -M main
git push -u origin main
```

### 2. 分支策略配置
```bash
# 创建开发分支
git checkout -b dev
git push -u origin dev

# 创建功能分支 (可选)
git checkout -b feature-api
git checkout -b feature-frontend
git checkout -b feature-extension
```

### 3. 分支保护规则设置
在GitHub仓库设置中配置：
```
Settings → Branches → Branch protection rules

main分支保护规则:
✅ Require pull request reviews before merging
✅ Require status checks to pass before merging
✅ Require branches to be up to date before merging
✅ Include administrators
```

---

## 🚀 **Vercel自动部署配置**

### 1. 连接Vercel账户
```bash
# 访问 https://vercel.com
1. 使用GitHub账户登录
2. 点击 "New Project"
3. 导入 GitHub 仓库: linkedin-data-extractor
4. 选择框架: Next.js
5. 配置项目设置
```

### 2. 自动部署规则配置
```bash
Production Branch: main
# main分支的推送 → 自动部署到生产环境

Preview Branches: All branches
# 其他分支的推送 → 自动生成预览环境
```

### 3. 环境变量配置
在Vercel项目设置中添加：

#### 生产环境变量
```bash
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
JWT_SECRET=your_production_jwt_secret
NODE_ENV=production
```

#### 预览环境变量
```bash
NEXT_PUBLIC_SUPABASE_URL=your_development_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_development_anon_key  
SUPABASE_SERVICE_ROLE_KEY=your_development_service_key
NEXT_PUBLIC_APP_URL=https://linkedin2-git-dev-username.vercel.app
JWT_SECRET=your_development_jwt_secret
NODE_ENV=development
```

---

## 📅 **6天部署时间表**

### 第1-3天：纯本地开发 📱
```bash
# 工作流程
1. 本地开发和测试
2. 功能完成后提交到功能分支
3. 不触发任何部署

# 示例命令
git add .
git commit -m "feat: 添加兑换码验证API"
# 暂不推送，继续本地开发
```

**优势**：
- ✅ 快速迭代，无等待时间
- ✅ 完全控制测试环境
- ✅ 节省部署资源

### 第4天上午：本地功能完善 📱
```bash
# 完成核心功能开发
- API开发完成
- Chrome扩展基础功能完成  
- 前端界面基本完成

# 准备首次部署
git add .
git commit -m "feat: 完成核心API、扩展和前端基础功能"
```

### 第4天下午15:00：首次预览部署 🚀
```bash
# 推送到dev分支触发预览部署
git push origin dev

# 自动触发Vercel预览部署
# 预览URL: https://linkedin2-git-dev-username.vercel.app
```

**部署后验证清单**：
- [ ] ✅ 构建成功无错误
- [ ] ✅ 页面可以正常访问
- [ ] ✅ API端点响应正确
- [ ] ✅ 环境变量配置生效
- [ ] ✅ Supabase数据库连接正常

### 第4-5天：基于预览环境优化 🚀
```bash
# 持续优化和改进
git add .
git commit -m "fix: 修复预览环境发现的问题"
git push origin dev  # 自动更新预览环境

# 团队成员可以通过预览URL体验和反馈
```

### 第6天下午16:00：生产环境部署 🎉
```bash
# 合并到主分支触发生产部署
git checkout main
git merge dev
git commit -m "release: v1.0.0 生产环境首次发布"
git push origin main

# 自动部署到生产环境
# 生产URL: https://your-domain.vercel.app
```

**生产部署后验证**：
- [ ] ✅ 健康检查API响应 200
- [ ] ✅ 核心功能完整可用
- [ ] ✅ 性能指标达标
- [ ] ✅ SSL证书正常
- [ ] ✅ 自定义域名解析
- [ ] ✅ 监控系统正常

---

## ⚙️ **自动化配置文件**

### 1. Vercel配置文件
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 2. GitHub Actions工作流 (可选)
```yaml
# .github/workflows/test-and-deploy.yml
name: Test and Deploy

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run type check
      run: npm run typecheck
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm run test
    
    - name: Build project
      run: npm run build

  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security audit
      run: npm audit --audit-level high
```

### 3. 环境特定配置
```typescript
// src/config/environment.ts
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    logLevel: 'debug'
  },
  preview: {
    apiUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    logLevel: 'info'
  },
  production: {
    apiUrl: 'https://your-domain.vercel.app',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    logLevel: 'error'
  }
}

export default config[process.env.NODE_ENV as keyof typeof config] || config.development
```

---

## 🔍 **监控和调试**

### 1. Vercel Analytics集成
```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 2. 部署状态监控
```bash
# Vercel CLI工具安装
npm i -g vercel

# 查看部署状态
vercel ls

# 查看部署日志
vercel logs your-deployment-url

# 本地预览生产构建
vercel build
vercel dev --listen 3000
```

### 3. 错误追踪配置
```typescript
// src/lib/error-tracking.ts
export const logError = (error: Error, context?: any) => {
  if (process.env.NODE_ENV === 'production') {
    // 生产环境发送到错误追踪服务
    console.error('Production Error:', error, context)
  } else {
    // 开发环境详细日志
    console.error('Development Error:', error, context)
  }
}
```

---

## 🚨 **应急预案**

### 1. 快速回滚
```bash
# Vercel一键回滚
vercel rollback [deployment-url]

# 或通过Vercel控制台
# 找到上一个稳定版本 → 点击 "Promote to Production"
```

### 2. 热修复流程
```bash
# 紧急修复
git checkout main
git checkout -b hotfix-urgent-issue

# 修复代码
git add .
git commit -m "hotfix: 修复紧急问题"

# 直接合并到main触发部署
git checkout main
git merge hotfix-urgent-issue
git push origin main
```

### 3. 数据库回滚
```sql
-- Supabase自动备份恢复
-- 通过Supabase控制台恢复到指定时间点
```

---

## 📊 **部署成功指标**

### 技术指标
- ✅ 构建时间 < 3分钟
- ✅ 首次内容绘制 < 2秒
- ✅ API响应时间 < 500ms
- ✅ 错误率 < 1%

### 业务指标  
- ✅ 兑换码验证功能正常
- ✅ 数据提取流程完整
- ✅ 管理后台访问正常
- ✅ Chrome扩展下载可用

---

**工作流指南创建时间**: 2025-08-27  
**适用项目**: LinkedIn数据提取系统  
**部署平台**: GitHub + Vercel  
**预期效果**: 6天完成从开发到生产的完整部署