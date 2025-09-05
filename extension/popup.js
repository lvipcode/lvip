// LinkedIn Data Extractor Popup Script
// 管理插件Popup界面和用户交互

class PopupManager {
  constructor() {
    this.currentStatus = null
    this.refreshInterval = null
    this.init()
  }

  async init() {
    console.log('Popup初始化中...')
    
    // 设置事件监听器
    this.setupEventListeners()
    
    // 加载初始数据
    await this.loadPluginStatus()
    await this.loadConfiguration()
    
    // 启动自动刷新
    this.startAutoRefresh()
    
    // 隐藏加载状态
    this.hideLoading()
  }

  setupEventListeners() {
    // 注册插件按钮
    document.getElementById('register-btn').addEventListener('click', () => {
      this.registerPlugin()
    })

    // 刷新状态按钮
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadPluginStatus()
    })

    // 取消任务按钮
    document.getElementById('cancel-task-btn').addEventListener('click', () => {
      this.cancelCurrentTask()
    })

    // 配置按钮
    document.getElementById('config-btn').addEventListener('click', () => {
      this.showConfigSection()
    })

    // 保存配置按钮
    document.getElementById('save-config-btn').addEventListener('click', () => {
      this.saveConfiguration()
    })

    // 取消配置按钮
    document.getElementById('cancel-config-btn').addEventListener('click', () => {
      this.hideConfigSection()
    })

    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message, sender, sendResponse)
    })
  }

  async loadPluginStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_PLUGIN_STATUS' 
      })
      
      if (response.success) {
        this.currentStatus = response.data
        this.updateStatusDisplay()
      } else {
        this.showAlert('无法获取插件状态', 'error')
      }
    } catch (error) {
      console.error('加载插件状态失败:', error)
      this.showAlert('加载插件状态失败', 'error')
    }
  }

  async loadConfiguration() {
    try {
      const result = await chrome.storage.sync.get([
        'apiBaseUrl',
        'pluginSettings'
      ])
      
      if (result.apiBaseUrl) {
        document.getElementById('api-url').value = result.apiBaseUrl
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  updateStatusDisplay() {
    if (!this.currentStatus) return
    
    const {
      pluginId,
      isRegistered,
      status,
      currentTask,
      lastHeartbeat,
      apiBaseUrl
    } = this.currentStatus
    
    // 更新插件ID
    document.getElementById('plugin-id').textContent = pluginId || '未知'
    
    // 更新连接状态
    const statusIndicator = document.getElementById('status-indicator')
    const statusText = document.getElementById('status-text')
    
    if (isRegistered) {
      if (status === 'online') {
        statusIndicator.className = 'status-indicator status-online'
        statusText.textContent = '在线'
      } else if (status === 'busy') {
        statusIndicator.className = 'status-indicator status-busy'
        statusText.textContent = '忙碌中'
      } else {
        statusIndicator.className = 'status-indicator status-offline'
        statusText.textContent = '离线'
      }
    } else {
      statusIndicator.className = 'status-indicator status-offline'
      statusText.textContent = '未注册'
    }
    
    // 更新最后心跳时间
    if (lastHeartbeat) {
      const heartbeatTime = new Date(lastHeartbeat)
      const timeAgo = this.getTimeAgo(heartbeatTime)
      document.getElementById('last-heartbeat').textContent = timeAgo
    } else {
      document.getElementById('last-heartbeat').textContent = '无'
    }
    
    // 显示/隐藏任务进度
    if (currentTask) {
      this.showTaskProgress(currentTask)
    } else {
      this.hideTaskProgress()
    }
    
    // 更新按钮状态
    this.updateButtonStates()
    
    // 显示状态区域
    this.showStatusSection()
  }

  showTaskProgress(task) {
    const progressSection = document.getElementById('progress-section')
    progressSection.classList.add('show')
    
    document.getElementById('task-id').textContent = task.taskId || '无'
    document.getElementById('extracted-count').textContent = task.extractedCount || 0
    
    const progress = task.progress || 0
    document.getElementById('progress-fill').style.width = `${progress}%`
    document.getElementById('progress-text').textContent = `${progress}% 完成`
    
    // 显示取消按钮
    document.getElementById('cancel-task-btn').classList.remove('hidden')
  }

  hideTaskProgress() {
    const progressSection = document.getElementById('progress-section')
    progressSection.classList.remove('show')
    
    // 隐藏取消按钮
    document.getElementById('cancel-task-btn').classList.add('hidden')
  }

  updateButtonStates() {
    const registerBtn = document.getElementById('register-btn')
    const refreshBtn = document.getElementById('refresh-btn')
    const cancelTaskBtn = document.getElementById('cancel-task-btn')
    
    if (this.currentStatus?.isRegistered) {
      registerBtn.textContent = '重新注册'
      registerBtn.disabled = false
    } else {
      registerBtn.textContent = '注册插件'
      registerBtn.disabled = false
    }
    
    refreshBtn.disabled = false
    
    // 根据任务状态显示/隐藏取消按钮
    if (this.currentStatus?.currentTask) {
      cancelTaskBtn.classList.remove('hidden')
    } else {
      cancelTaskBtn.classList.add('hidden')
    }
  }

  async registerPlugin() {
    try {
      this.showAlert('正在注册插件...', 'warning')
      
      const response = await chrome.runtime.sendMessage({ 
        type: 'REGISTER_PLUGIN' 
      })
      
      if (response.success) {
        this.showAlert('插件注册成功！', 'success')
        await this.loadPluginStatus()
      } else {
        this.showAlert('插件注册失败', 'error')
      }
    } catch (error) {
      console.error('注册插件失败:', error)
      this.showAlert(`注册失败: ${error.message}`, 'error')
    }
  }

  async cancelCurrentTask() {
    if (!this.currentStatus?.currentTask) {
      this.showAlert('没有正在执行的任务', 'warning')
      return
    }
    
    try {
      // 通过content script取消任务
      const tabs = await chrome.tabs.query({ 
        url: ["*://www.linkedin.com/*", "*://linkedin.com/*"] 
      })
      
      if (tabs.length > 0) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CANCEL_TASK'
        })
        
        if (response.success) {
          this.showAlert('任务已取消', 'success')
          await this.loadPluginStatus()
        } else {
          this.showAlert('取消任务失败', 'error')
        }
      } else {
        this.showAlert('未找到LinkedIn页面', 'error')
      }
    } catch (error) {
      console.error('取消任务失败:', error)
      this.showAlert(`取消失败: ${error.message}`, 'error')
    }
  }

  showConfigSection() {
    document.getElementById('config-section').classList.remove('hidden')
    document.getElementById('actions-section').classList.add('hidden')
  }

  hideConfigSection() {
    document.getElementById('config-section').classList.add('hidden')
    document.getElementById('actions-section').classList.remove('hidden')
  }

  async saveConfiguration() {
    try {
      const apiUrl = document.getElementById('api-url').value.trim()
      
      if (!apiUrl) {
        this.showAlert('请输入API地址', 'error')
        return
      }
      
      // 验证URL格式
      try {
        new URL(apiUrl)
      } catch {
        this.showAlert('请输入有效的URL格式', 'error')
        return
      }
      
      // 发送配置更新到background script
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        data: {
          apiBaseUrl: apiUrl
        }
      })
      
      if (response.success) {
        this.showAlert('配置保存成功', 'success')
        this.hideConfigSection()
        
        // 重新加载插件状态
        await this.loadPluginStatus()
      } else {
        this.showAlert('配置保存失败', 'error')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      this.showAlert(`保存失败: ${error.message}`, 'error')
    }
  }

  handleBackgroundMessage(message, sender, sendResponse) {
    const { type, data } = message
    
    switch (type) {
      case 'PLUGIN_STATUS_CHANGED':
        console.log('插件状态变更:', data)
        this.loadPluginStatus()
        break
        
      case 'TASK_PROGRESS':
        console.log('任务进度更新:', data)
        if (this.currentStatus?.currentTask?.taskId === data.taskId) {
          this.currentStatus.currentTask = { 
            ...this.currentStatus.currentTask, 
            ...data 
          }
          this.updateStatusDisplay()
        }
        break
        
      case 'TASK_COMPLETED':
        console.log('任务完成:', data)
        this.showAlert(`任务完成！提取了 ${data.totalCount} 条数据`, 'success')
        this.loadPluginStatus()
        break
        
      case 'LINKEDIN_READY':
        console.log('LinkedIn页面就绪:', data)
        if (data.isLoggedIn) {
          this.showAlert('LinkedIn页面已就绪，可以开始提取', 'success')
        } else {
          this.showAlert('请登录LinkedIn后再使用', 'warning')
        }
        break
        
      default:
        console.log('未知背景消息:', type, data)
    }
    
    sendResponse({ received: true })
  }

  showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alerts-container')
    
    const alert = document.createElement('div')
    alert.className = `alert alert-${type}`
    alert.textContent = message
    
    alertsContainer.appendChild(alert)
    
    // 3秒后自动移除
    setTimeout(() => {
      if (alert.parentElement) {
        alert.parentElement.removeChild(alert)
      }
    }, 3000)
  }

  startAutoRefresh() {
    // 每10秒刷新一次状态
    this.refreshInterval = setInterval(() => {
      this.loadPluginStatus()
    }, 10000)
  }

  showStatusSection() {
    document.getElementById('status-section').classList.remove('hidden')
    document.getElementById('actions-section').classList.remove('hidden')
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden')
  }

  getTimeAgo(date) {
    const now = new Date()
    const diffMs = now - date
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}秒前`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`
    } else if (diffHours < 24) {
      return `${diffHours}小时前`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}天前`
    }
  }

  // 清理资源
  cleanup() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }
}

// 初始化Popup管理器
const popupManager = new PopupManager()

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  popupManager.cleanup()
})

console.log('LinkedIn数据提取器Popup脚本已加载')