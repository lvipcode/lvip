# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述
这是LinkedIn数据提取系统的Chrome扩展插件组件，采用Manifest V3规范。插件负责在LinkedIn页面上提取用户数据，并与后端API系统进行通信。

## 技术栈
- **扩展规范**: Chrome Extension Manifest V3
- **通信方式**: Chrome Runtime Messaging + Server-Sent Events
- **语言**: JavaScript (ES6+)
- **架构**: Service Worker + Content Scripts + Popup UI

## 开发和测试命令

### 插件安装和调试
```bash
# Chrome浏览器操作步骤：
# 1. 打开 chrome://extensions/
# 2. 开启"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择当前 extension/ 文件夹
```

### 本地开发环境
插件默认配置为连接到 `http://localhost:3000/api` 的后端API，可在popup界面中修改API地址。

### 插件重载和调试
- **重载插件**: chrome://extensions/ -> 点击插件的刷新图标
- **查看日志**: Chrome DevTools -> Console -> 选择扩展程序上下文
- **调试Popup**: 右键插件图标 -> "审查弹出内容"
- **调试Content Script**: 在LinkedIn页面按F12，查看Console

## 代码架构

### 核心文件结构
- `manifest.json` - 扩展配置文件，定义权限和入口点
- `background.js` - Service Worker，处理插件生命周期和API通信
- `content.js` - Content Script，在LinkedIn页面中执行数据提取
- `popup.html/popup.js` - 弹窗界面，用于插件状态管理和配置
- `rules.json` - Declarative Net Request规则，处理HTTP头部修改

### 通信架构
1. **Background ↔ API Server**: HTTP requests + Server-Sent Events
2. **Background ↔ Content Script**: Chrome Runtime Messaging
3. **Background ↔ Popup**: Chrome Runtime Messaging
4. **插件注册流程**: 自动向API服务器注册并获取任务

### 关键类和组件

#### LinkedInExtractorPlugin (background.js)
- 插件主控制器，管理插件生命周期
- 处理与API服务器的通信（注册、心跳、任务监听）
- 维护SSE连接监听任务分配
- 关键方法：`registerPlugin()`, `startTaskListener()`, `handleNewTask()`

#### LinkedInDataExtractor (content.js)
- LinkedIn页面数据提取核心逻辑
- 处理搜索导航、页面解析、数据提取
- 模拟人工操作，包含反反爬虫机制
- 关键方法：`executeSearchAndExtraction()`, `extractPersonData()`, `calculateDataQuality()`

#### PopupManager (popup.js)
- 弹窗界面管理器
- 实时显示插件状态和任务进度
- 提供插件配置界面
- 关键方法：`loadPluginStatus()`, `updateStatusDisplay()`, `registerPlugin()`

## 开发注意事项

### Manifest V3 特殊要求
- Service Worker替代Background Page，需要处理生命周期管理
- 使用Declarative Net Request代替webRequest API
- 动态导入和异步操作需要特殊处理

### LinkedIn反反爬虫策略
- 模拟人工操作：随机延迟、鼠标事件模拟
- 页面导航：处理SPA路由变化监听
- 数据质量评分：确保提取数据完整性
- 错误恢复：网络错误和页面变化的处理

### API通信机制
- **插件注册**: 向 `/api/plugins/register` 注册插件
- **任务监听**: 通过 `/api/plugins/tasks/stream` SSE连接接收任务
- **结果提交**: 向 `/api/plugins/submit` 提交提取结果
- **心跳维护**: 向 `/api/plugins/heartbeat` 发送状态更新

### 数据提取流程
1. 接收任务参数（关键词、地理位置、公司等）
2. 导航到LinkedIn搜索页面
3. 逐页提取用户数据（姓名、职位、公司、位置）
4. 数据质量评分和验证
5. 实时进度报告和结果提交

### 调试技巧
- 使用 `console.log` 进行详细日志记录
- Background Script错误查看：chrome://extensions/ -> 错误详情
- Content Script调试：直接在LinkedIn页面DevTools查看
- 网络请求监控：DevTools Network面板监控API调用

### 权限和安全
- `host_permissions`: LinkedIn域名访问权限
- `activeTab`: 当前标签页访问
- `storage`: 本地存储配置信息
- `declarativeNetRequest`: HTTP头部修改权限

## 常见问题和解决方案

### 插件无法注册
- 检查API服务器是否运行在配置的地址
- 验证网络连接和CORS设置
- 查看Background Script控制台错误信息

### 数据提取失败
- 确认用户已登录LinkedIn
- 检查LinkedIn页面结构是否发生变化
- 验证搜索参数格式是否正确

### SSE连接问题
- 检查服务器SSE端点是否正常工作
- 验证插件ID是否正确注册
- 查看网络面板的SSE连接状态

### Content Script注入失败
- 确认LinkedIn页面已完全加载
- 检查manifest.json中的matches配置
- 验证content_scripts的run_at设置