// LinkedIn Data Extractor Background Service Worker
// Manifest V3后台脚本，处理插件注册、任务管理和SSE通信

class LinkedInExtractorPlugin {
  constructor() {
    this.pluginId = 'linkedin-extractor-' + Date.now()
    this.isRegistered = false
    this.currentTask = null
    this.heartbeatInterval = null
    this.taskListenerEventSource = null
    this.apiBaseUrl = 'http://localhost:3000/api' // 默认API地址
    this.registrationToken = null
    this.status = 'offline'
    this.lastHeartbeat = null
    this.capabilities = ['person-search']
    
    this.init()
  }

  async init() {
    console.log('LinkedIn提取器插件初始化中...')
    
    // 加载配置
    await this.loadConfig()
    
    // 设置事件监听器
    this.setupEventListeners()
    
    // 尝试注册插件
    await this.registerPlugin()
    
    // 启动心跳
    this.startHeartbeat()
    
    // 启动任务监听器
    this.startTaskListener()
    
    console.log('LinkedIn提取器插件初始化完成')
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.sync.get([
        'apiBaseUrl',
        'pluginSettings',
        'registrationData'
      ])
      
      if (result.apiBaseUrl) {
        this.apiBaseUrl = result.apiBaseUrl
      }
      
      if (result.registrationData) {
        this.registrationToken = result.registrationData.token
        this.pluginId = result.registrationData.pluginId
      }
      
      console.log('配置加载完成:', { 
        apiBaseUrl: this.apiBaseUrl,
        hasToken: !!this.registrationToken 
      })
    } catch (error) {
      console.error('加载配置时出错:', error)
    }
  }

  setupEventListeners() {
    // 处理扩展安装
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('扩展已安装:', details.reason)
      if (details.reason === 'install') {
        this.showWelcomeNotification()
      }
    })

    // 处理来自content script和popup的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // 保持消息通道开放以处理异步响应
    })

    // 处理标签页更新以检测LinkedIn导航
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isLinkedInUrl(tab.url)) {
        this.onLinkedInPageLoaded(tabId, tab.url)
      }
    })

    // 处理扩展关闭
    chrome.runtime.onSuspend.addListener(() => {
      this.cleanup()
    })
  }

  async handleMessage(message, sender, sendResponse) {
    const { type, data } = message
    
    try {
      switch (type) {
        case 'REGISTER_PLUGIN':
          const registrationResult = await this.registerPlugin()
          sendResponse({ success: true, data: registrationResult })
          break

        case 'GET_PLUGIN_STATUS':
          sendResponse({
            success: true,
            data: {
              pluginId: this.pluginId,
              isRegistered: this.isRegistered,
              status: this.status,
              currentTask: this.currentTask,
              lastHeartbeat: this.lastHeartbeat,
              apiBaseUrl: this.apiBaseUrl
            }
          })
          break

        case 'UPDATE_CONFIG':
          await this.updateConfig(data)
          sendResponse({ success: true })
          break

        case 'LINKEDIN_PAGE_READY':
          this.handleLinkedInPageReady(data, sender.tab)
          sendResponse({ success: true })
          break

        case 'TASK_PROGRESS_UPDATE':
          await this.handleTaskProgressUpdate(data)
          sendResponse({ success: true })
          break

        case 'TASK_RESULTS':
          await this.handleTaskResults(data)
          sendResponse({ success: true })
          break

        case 'TASK_ERROR':
          await this.handleTaskError(data)
          sendResponse({ success: true })
          break

        default:
          console.warn('未知消息类型:', type)
          sendResponse({ success: false, error: '未知消息类型' })
      }
    } catch (error) {
      console.error('处理消息时出错:', error)
      sendResponse({ success: false, error: error.message })
    }
  }

  async registerPlugin() {
    try {
      console.log('注册插件到服务器...')
      
      const response = await fetch(`${this.apiBaseUrl}/plugins/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: this.pluginId,
          pluginType: 'person-search',
          capacity: 10,
          version: '1.0.0',
          metadata: {
            userAgent: navigator.userAgent,
            capabilities: this.capabilities
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        this.isRegistered = true
        this.status = 'online'
        
        // 保存注册信息
        await chrome.storage.sync.set({
          registrationData: {
            pluginId: this.pluginId,
            token: result.data?.token,
            registeredAt: Date.now()
          }
        })
        
        console.log('插件注册成功:', this.pluginId)
        
        // 通知popup更新状态
        this.notifyPopupStatusChange()
        
        return { success: true, pluginId: this.pluginId }
      } else {
        throw new Error(result.error || '注册失败')
      }
    } catch (error) {
      console.error('插件注册失败:', error)
      this.isRegistered = false
      this.status = 'offline'
      throw error
    }
  }

  startHeartbeat() {
    // 清除现有心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    
    // 每30秒发送心跳
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.sendHeartbeat()
      } catch (error) {
        console.error('心跳发送失败:', error)
        
        // 3次失败后尝试重新注册
        if (this.heartbeatFailCount > 3) {
          this.isRegistered = false
          await this.registerPlugin()
          this.heartbeatFailCount = 0
        } else {
          this.heartbeatFailCount = (this.heartbeatFailCount || 0) + 1
        }
      }
    }, 30000) // 30秒心跳间隔
    
    // 立即发送一次心跳
    this.sendHeartbeat()
  }

  async sendHeartbeat() {
    if (!this.isRegistered) return
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/plugins/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: this.pluginId,
          status: this.currentTask ? 'busy' : 'online',
          currentTask: this.currentTask?.taskId || null,
          performance: {
            memoryUsage: performance.memory ? {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize
            } : null,
            timestamp: Date.now()
          }
        }),
      })

      if (response.ok) {
        this.lastHeartbeat = Date.now()
        this.heartbeatFailCount = 0
        console.log('心跳发送成功')
      } else {
        throw new Error(`心跳响应错误: ${response.status}`)
      }
    } catch (error) {
      console.error('发送心跳失败:', error)
      throw error
    }
  }

  startTaskListener() {
    if (!this.isRegistered) {
      console.log('插件未注册，无法启动任务监听器')
      return
    }
    
    try {
      // 建立SSE连接监听任务分配
      const sseUrl = `${this.apiBaseUrl}/plugins/tasks/stream?pluginId=${encodeURIComponent(this.pluginId)}`
      
      this.taskListenerEventSource = new EventSource(sseUrl)
      
      this.taskListenerEventSource.onopen = () => {
        console.log('任务监听器SSE连接已建立')
      }
      
      this.taskListenerEventSource.onmessage = (event) => {
        try {
          const taskData = JSON.parse(event.data)
          console.log('收到新任务:', taskData)
          this.handleNewTask(taskData)
        } catch (error) {
          console.error('解析任务数据失败:', error)
        }
      }
      
      this.taskListenerEventSource.onerror = (error) => {
        console.error('任务监听器SSE连接错误:', error)
        
        // 重连逻辑
        setTimeout(() => {
          if (this.isRegistered) {
            console.log('尝试重新连接任务监听器...')
            this.startTaskListener()
          }
        }, 5000)
      }
      
    } catch (error) {
      console.error('启动任务监听器失败:', error)
    }
  }

  async handleNewTask(taskData) {
    const { taskId, taskType, searchParams, maxResults } = taskData
    
    console.log('处理新任务:', { taskId, taskType, maxResults })
    
    // 检查是否已有任务在处理
    if (this.currentTask) {
      console.log('当前有任务在处理，拒绝新任务')
      return
    }
    
    // 设置当前任务
    this.currentTask = {
      taskId,
      taskType,
      searchParams,
      maxResults,
      startTime: Date.now(),
      status: 'assigned'
    }
    
    // 更新插件状态
    this.status = 'busy'
    
    try {
      // 查找LinkedIn标签页
      const linkedInTabs = await this.findLinkedInTabs()
      
      if (linkedInTabs.length === 0) {
        throw new Error('没有找到LinkedIn标签页，无法执行任务')
      }
      
      // 选择第一个LinkedIn标签页
      const targetTab = linkedInTabs[0]
      
      // 发送任务到content script
      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'START_TASK',
        data: {
          taskId,
          searchParams,
          maxResults
        }
      })
      
      this.currentTask.status = 'processing'
      console.log('任务已发送到content script')
      
    } catch (error) {
      console.error('处理任务时出错:', error)
      
      // 报告任务错误
      await this.reportTaskError(taskId, error.message)
      
      // 清除当前任务
      this.currentTask = null
      this.status = 'online'
    }
  }

  async findLinkedInTabs() {
    try {
      const tabs = await chrome.tabs.query({
        url: ["*://www.linkedin.com/*", "*://linkedin.com/*"]
      })
      return tabs
    } catch (error) {
      console.error('查找LinkedIn标签页失败:', error)
      return []
    }
  }

  async handleTaskProgressUpdate(data) {
    const { taskId, progress, message, extractedCount } = data
    
    if (this.currentTask && this.currentTask.taskId === taskId) {
      this.currentTask.progress = progress
      this.currentTask.message = message
      this.currentTask.extractedCount = extractedCount
      
      console.log(`任务进度更新: ${progress}% - ${message}`)
      
      // 通知popup更新进度
      this.notifyPopupTaskProgress(data)
    }
  }

  async handleTaskResults(data) {
    const { taskId, results, totalCount } = data
    
    console.log(`任务完成: ${taskId}, 结果数量: ${totalCount}`)
    
    try {
      // 提交结果到服务器
      await this.submitTaskResults(taskId, results, totalCount)
      
      // 清除当前任务
      this.currentTask = null
      this.status = 'online'
      
      // 通知popup任务完成
      this.notifyPopupTaskComplete(taskId, totalCount)
      
    } catch (error) {
      console.error('提交任务结果失败:', error)
      await this.reportTaskError(taskId, error.message)
    }
  }

  async handleTaskError(data) {
    const { taskId, error, stack } = data
    
    console.error('任务执行错误:', error)
    
    await this.reportTaskError(taskId, error, stack)
    
    // 清除当前任务
    this.currentTask = null
    this.status = 'online'
  }

  async submitTaskResults(taskId, results, totalCount) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/plugins/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: this.pluginId,
          taskId: taskId,
          results: results,
          resultCount: totalCount,
          completedAt: Date.now()
        }),
      })

      if (!response.ok) {
        throw new Error(`提交失败: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '提交失败')
      }
      
      console.log('任务结果提交成功')
      
    } catch (error) {
      console.error('提交任务结果失败:', error)
      throw error
    }
  }

  async reportTaskError(taskId, errorMessage, stack = null) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/plugins/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: this.pluginId,
          taskId: taskId,
          error: errorMessage,
          stack: stack,
          failedAt: Date.now()
        }),
      })

      if (response.ok) {
        console.log('任务错误已报告')
      }
      
    } catch (error) {
      console.error('报告任务错误失败:', error)
    }
  }

  async updateConfig(config) {
    try {
      if (config.apiBaseUrl) {
        this.apiBaseUrl = config.apiBaseUrl
      }
      
      await chrome.storage.sync.set({
        apiBaseUrl: this.apiBaseUrl,
        pluginSettings: config
      })
      
      console.log('配置已更新')
      
      // 如果API地址发生变化，重新注册
      if (config.apiBaseUrl && config.apiBaseUrl !== this.apiBaseUrl) {
        this.isRegistered = false
        await this.registerPlugin()
        this.startTaskListener()
      }
      
    } catch (error) {
      console.error('更新配置失败:', error)
      throw error
    }
  }

  handleLinkedInPageReady(data, tab) {
    console.log('LinkedIn页面就绪:', data.url, '登录状态:', data.isLoggedIn)
    
    // 如果用户已登录且插件已注册，通知可以开始任务
    if (data.isLoggedIn && this.isRegistered) {
      this.notifyPopupLinkedInReady(tab.id, data)
    }
  }

  isLinkedInUrl(url) {
    return url && (url.includes('linkedin.com') || url.includes('www.linkedin.com'))
  }

  onLinkedInPageLoaded(tabId, url) {
    console.log('LinkedIn页面加载完成:', url)
  }

  showWelcomeNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LinkedIn数据提取器',
      message: '扩展安装成功！请配置API地址并注册插件。'
    })
  }

  // 通知popup的方法
  notifyPopupStatusChange() {
    chrome.runtime.sendMessage({
      type: 'PLUGIN_STATUS_CHANGED',
      data: {
        isRegistered: this.isRegistered,
        status: this.status,
        pluginId: this.pluginId
      }
    }).catch(() => {
      // popup可能没有打开，忽略错误
    })
  }

  notifyPopupTaskProgress(data) {
    chrome.runtime.sendMessage({
      type: 'TASK_PROGRESS',
      data: data
    }).catch(() => {
      // popup可能没有打开，忽略错误
    })
  }

  notifyPopupTaskComplete(taskId, totalCount) {
    chrome.runtime.sendMessage({
      type: 'TASK_COMPLETED',
      data: {
        taskId,
        totalCount,
        completedAt: Date.now()
      }
    }).catch(() => {
      // popup可能没有打开，忽略错误
    })
  }

  notifyPopupLinkedInReady(tabId, data) {
    chrome.runtime.sendMessage({
      type: 'LINKEDIN_READY',
      data: {
        tabId,
        ...data
      }
    }).catch(() => {
      // popup可能没有打开，忽略错误
    })
  }

  cleanup() {
    console.log('清理插件资源...')
    
    // 清除心跳
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    // 关闭SSE连接
    if (this.taskListenerEventSource) {
      this.taskListenerEventSource.close()
      this.taskListenerEventSource = null
    }
    
    // 取消当前任务
    this.currentTask = null
    this.status = 'offline'
  }
}

// 初始化插件
const plugin = new LinkedInExtractorPlugin()

console.log('LinkedIn数据提取器后台脚本已启动')