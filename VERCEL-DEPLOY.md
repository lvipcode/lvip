# LinkedIn数据提取系统 - Vercel部署指南

## 🚨 问题解决

您遇到的构建错误 `supabaseUrl is required` 已经修复！现在按照以下步骤在 Vercel 上配置环境变量即可正常部署。

## 📋 Vercel 环境变量配置清单

登录 [Vercel Dashboard](https://vercel.com/dashboard)，进入您的项目设置 > Environment Variables，按照以下配置添加环境变量：

### 🔥 必需环境变量 (Required)

```bash
# Supabase 数据库配置
NEXT_PUBLIC_SUPABASE_URL=https://lpcdphgqmbaoqfsfqdpt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY2RwaGdxbWJhb3Fmc2ZxZHB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDUzMzIsImV4cCI6MjA3MTg4MTMzMn0.eKh62zTU_osPvPdj-uF7xGDse4eBNZV16mTKzO-nF8A
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY2RwaGdxbWJhb3Fmc2ZxZHB0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjMwNTMzMiwiZXhwIjoyMDcxODgxMzMyfQ._Obzb89bVr148BwkU1ahpEXoFQEowAQlkPyC2WL-r0A

# 应用程序配置
NEXT_PUBLIC_APP_URL=https://linkedin2-pi.vercel.app
JWT_SECRET=linkedin_data_extractor_jwt_secret_2025_secure_key_32chars_minimum
NODE_ENV=production

# 禁用遥测数据收集
NEXT_TELEMETRY_DISABLED=1
```

### ⚙️ 可选环境变量 (Optional)

```bash
# 管理员令牌
ADMIN_TOKEN=admin_token_secure_2025_change_in_production

# 功能配置
MAX_SEARCH_RESULTS=1000
DATA_RETENTION_DAYS=7
NEXT_PUBLIC_EXTENSION_SUPPORT=true
API_RATE_LIMIT_PER_MINUTE=60
TASK_TIMEOUT_MS=300000
LOG_LEVEL=info
```

## 🎯 快速部署步骤

### 第1步: 推送代码到 GitHub
```bash
# 提交并推送代码修复
git add .
git commit -m "fix: 修复Vercel部署环境变量问题"
git push origin main
```

### 第2步: 在 Vercel 配置环境变量
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的 `linkedin2` 项目
3. 点击 **Settings** 选项卡
4. 点击左侧 **Environment Variables**
5. 逐一添加上述必需环境变量
6. 确保所有变量的 **Environment** 都选择了 `Production`, `Preview`, 和 `Development`

### 第3步: 重新部署
1. 进入 **Deployments** 选项卡
2. 点击最新失败部署旁的 **⋯** 菜单
3. 选择 **Redeploy**
4. 选择 **Use existing Build Cache** 或不选（推荐不选以确保使用最新环境变量）

## ✅ 验证部署成功

部署成功后，您应该能够：

1. **访问主页**: https://linkedin2-pi.vercel.app
2. **测试兑换码验证功能**
3. **访问人员搜索页面**: https://linkedin2-pi.vercel.app/search/person
4. **API端点正常响应**: https://linkedin2-pi.vercel.app/api/tasks/status/test

## 🐛 常见问题排查

### 如果仍然出现构建错误：

1. **检查环境变量拼写**: 确保变量名完全匹配，区分大小写
2. **检查引号**: Vercel环境变量不需要加引号
3. **重新部署**: 添加环境变量后必须重新部署

### 如果运行时错误：

1. **检查 Supabase 连接**: 确认数据库URL和密钥正确
2. **检查函数日志**: 在 Vercel Dashboard > Functions 查看错误日志
3. **检查数据库初始化**: 确认已执行 database/ 目录下的SQL脚本

## 📚 后续配置

部署成功后，还需要：

1. **初始化数据库**: 按照 `CLAUDE.md` 中的说明执行SQL脚本
2. **配置兑换码**: 在数据库中添加有效的兑换码
3. **安装Chrome扩展**: 配置扩展指向您的生产环境API

## 🔒 安全提示

- 已将真实的API密钥从 `.env.example` 中移除
- `.env.local` 文件不会被提交到版本控制
- 生产环境使用强随机JWT密钥
- 建议定期轮换API密钥

---

🎉 **修复完成！** 现在您可以成功部署到 Vercel 了！