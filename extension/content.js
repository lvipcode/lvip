// LinkedIn Data Extractor Content Script
// 处理LinkedIn页面数据提取的核心逻辑

class LinkedInDataExtractor {
  constructor() {
    this.isActive = false
    this.currentTask = null
    this.extractedData = []
    this.extractionProgress = 0
    this.isExtracting = false
    this.maxRetries = 3
    this.retryDelay = 2000
    this.pageLoadTimeout = 10000
    
    this.init()
  }

  init() {
    console.log('LinkedIn数据提取器内容脚本已加载')
    
    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // 保持消息通道开放
    })

    // 监听页面导航
    this.setupNavigationListener()
    
    // 检查是否在LinkedIn页面
    if (this.isLinkedInPage()) {
      this.onLinkedInPageReady()
    }
  }

  setupNavigationListener() {
    // LinkedIn使用SPA导航，需要监听URL变化
    let currentUrl = window.location.href
    
    const observer = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href
        console.log('LinkedIn页面导航检测到:', currentUrl)
        
        // 延迟确保页面加载完成
        setTimeout(() => {
          this.onLinkedInPageReady()
        }, 1000)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  async handleMessage(message, sender, sendResponse) {
    const { type, data } = message
    
    try {
      switch (type) {
        case 'START_TASK':
          await this.startExtractionTask(data)
          sendResponse({ success: true })
          break

        case 'CANCEL_TASK':
          await this.cancelExtractionTask()
          sendResponse({ success: true })
          break

        case 'GET_EXTRACTION_STATUS':
          sendResponse({
            success: true,
            data: {
              isActive: this.isActive,
              isExtracting: this.isExtracting,
              progress: this.extractionProgress,
              extractedCount: this.extractedData.length,
              currentTask: this.currentTask
            }
          })
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

  isLinkedInPage() {
    return window.location.hostname.includes('linkedin.com')
  }

  onLinkedInPageReady() {
    if (!this.isLinkedInPage()) return
    
    console.log('LinkedIn页面就绪:', window.location.href)
    
    // 通知background script页面已就绪
    chrome.runtime.sendMessage({
      type: 'LINKEDIN_PAGE_READY',
      data: {
        url: window.location.href,
        title: document.title,
        isLoggedIn: this.checkLoginStatus()
      }
    }).catch(error => {
      console.error('发送页面就绪消息失败:', error)
    })
  }

  checkLoginStatus() {
    // 检查LinkedIn登录状态的标识元素
    const loginIndicators = [
      'nav .global-nav__me',
      '[data-control-name="nav.settings_signout"]',
      '.global-nav__me-photo',
      '.global-nav__me-text',
      '.nav-item__profile-member-photo'
    ]
    
    return loginIndicators.some(selector => document.querySelector(selector))
  }

  async startExtractionTask(data) {
    const { taskId, searchParams, maxResults } = data
    
    this.currentTask = {
      taskId,
      searchParams,
      maxResults,
      startTime: Date.now(),
      extractedCount: 0
    }
    
    this.isActive = true
    this.isExtracting = true
    this.extractedData = []
    this.extractionProgress = 0
    
    console.log('开始LinkedIn数据提取任务:', { taskId, searchParams, maxResults })
    
    try {
      // 检查是否在LinkedIn页面
      if (!this.isLinkedInPage()) {
        throw new Error('不在LinkedIn页面，无法执行提取任务')
      }
      
      // 检查登录状态
      if (!this.checkLoginStatus()) {
        throw new Error('用户未登录LinkedIn，请先登录')
      }
      
      // 报告任务开始
      await this.reportTaskProgress(0, '任务开始，准备搜索...')
      
      // 执行搜索和数据提取
      await this.executeSearchAndExtraction()
      
      // 报告最终结果
      await this.reportResults()
      
    } catch (error) {
      console.error('数据提取错误:', error)
      await this.reportError(error)
    } finally {
      this.isExtracting = false
      this.isActive = false
    }
  }

  async executeSearchAndExtraction() {
    const { searchParams, maxResults } = this.currentTask
    
    // 导航到搜索页面
    await this.navigateToSearchPage(searchParams)
    
    // 等待搜索结果加载
    await this.waitForSearchResults()
    
    // 开始提取数据
    let extractedCount = 0
    let currentPage = 1
    const maxPages = Math.ceil(maxResults / 10) // LinkedIn通常每页10条结果
    
    while (extractedCount < maxResults && currentPage <= maxPages) {
      console.log(`提取第${currentPage}页数据...`)
      
      // 提取当前页面的结果
      const pageResults = await this.extractCurrentPageResults()
      
      if (pageResults.length === 0) {
        console.log('没有更多结果，结束提取')
        break
      }
      
      // 添加到结果集
      for (const result of pageResults) {
        if (extractedCount >= maxResults) break
        
        this.extractedData.push(result)
        extractedCount++
        
        // 更新进度
        this.extractionProgress = Math.floor((extractedCount / maxResults) * 100)
        
        // 定期报告进度
        if (extractedCount % 5 === 0) {
          await this.reportTaskProgress(
            this.extractionProgress, 
            `已提取 ${extractedCount}/${maxResults} 条数据`
          )
        }
      }
      
      // 如果还需要更多数据，翻到下一页
      if (extractedCount < maxResults && currentPage < maxPages) {
        await this.navigateToNextPage()
        currentPage++
        
        // 页面间等待，避免请求过快
        await this.randomDelay(2000, 4000)
      }
    }
    
    console.log(`数据提取完成，共提取 ${extractedCount} 条记录`)
  }

  async navigateToSearchPage(searchParams) {
    const searchUrl = this.buildSearchUrl(searchParams)
    
    console.log('导航到搜索页面:', searchUrl)
    
    // 如果已经在搜索页面，只需更新搜索参数
    if (window.location.pathname.includes('/search/results/people')) {
      // 检查当前搜索是否匹配
      const currentParams = new URLSearchParams(window.location.search)
      const targetParams = new URLSearchParams(searchUrl.split('?')[1])
      
      if (currentParams.get('keywords') !== targetParams.get('keywords')) {
        window.location.href = searchUrl
        await this.waitForPageLoad()
      }
    } else {
      // 导航到新的搜索页面
      window.location.href = searchUrl
      await this.waitForPageLoad()
    }
  }

  buildSearchUrl(searchParams) {
    const { keywords, location, company, industry, experience } = searchParams
    
    // LinkedIn搜索基础URL
    let url = 'https://www.linkedin.com/search/results/people/?'
    
    const params = new URLSearchParams()
    
    // 关键词搜索
    if (keywords) {
      params.append('keywords', keywords.trim())
    }
    
    // 地理位置（简化处理）
    if (location) {
      params.append('geoUrn', JSON.stringify([`geographic:${location.trim()}`]))
    }
    
    // 当前公司
    if (company) {
      params.append('currentCompany', JSON.stringify([company.trim()]))
    }
    
    return url + params.toString()
  }

  async waitForSearchResults() {
    const maxWaitTime = this.pageLoadTimeout
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      // 检查搜索结果是否加载
      const resultsList = document.querySelector('.search-results-container')
      const peopleResults = document.querySelectorAll('.reusable-search__result-container')
      
      if (resultsList && peopleResults.length > 0) {
        console.log(`搜索结果已加载，找到 ${peopleResults.length} 条结果`)
        return true
      }
      
      await this.delay(500)
    }
    
    throw new Error('等待搜索结果超时')
  }

  async extractCurrentPageResults() {
    const results = []
    
    // LinkedIn搜索结果选择器
    const resultSelectors = [
      '.reusable-search__result-container',
      '.search-result__wrapper',
      '[data-test-search-result]'
    ]
    
    let resultElements = []
    
    // 尝试不同的选择器找到结果元素
    for (const selector of resultSelectors) {
      resultElements = document.querySelectorAll(selector)
      if (resultElements.length > 0) break
    }
    
    console.log(`找到 ${resultElements.length} 个结果元素`)
    
    for (let i = 0; i < resultElements.length; i++) {
      try {
        const resultElement = resultElements[i]
        const personData = await this.extractPersonData(resultElement)
        
        if (personData && this.isValidPersonData(personData)) {
          results.push(personData)
        }
        
        // 元素间等待，模拟人工浏览
        await this.randomDelay(100, 300)
        
      } catch (error) {
        console.error(`提取第 ${i} 个结果时出错:`, error)
        continue
      }
    }
    
    return results
  }

  async extractPersonData(resultElement) {
    try {
      // 提取基本信息
      const personData = {
        name: this.extractText(resultElement, [
          '.entity-result__title-text a span[aria-hidden="true"]',
          '.search-result__title a',
          '.actor-name'
        ]),
        
        position: this.extractText(resultElement, [
          '.entity-result__primary-subtitle',
          '.search-result__snippets .text-body-small',
          '.subline-level-1'
        ]),
        
        company: this.extractText(resultElement, [
          '.entity-result__secondary-subtitle',
          '.search-result__snippets .text-body-small:nth-child(2)',
          '.subline-level-2'
        ]),
        
        location: this.extractText(resultElement, [
          '.entity-result__secondary-subtitle:last-child',
          '.search-result__snippets .text-body-small:last-child',
          '.entity-result__secondary-subtitle'
        ]),
        
        profileUrl: this.extractAttribute(resultElement, [
          '.entity-result__title-text a',
          '.search-result__title a'
        ], 'href'),
        
        extractedAt: new Date().toISOString(),
        
        // 计算数据质量分数
        dataQuality: 0
      }
      
      // 清理和验证数据
      personData.name = this.cleanText(personData.name)
      personData.position = this.cleanText(personData.position)
      personData.company = this.cleanText(personData.company)
      personData.location = this.cleanText(personData.location)
      
      // 处理LinkedIn URL
      if (personData.profileUrl) {
        personData.profileUrl = this.normalizeLinkedInUrl(personData.profileUrl)
      }
      
      // 计算数据质量分数
      personData.dataQuality = this.calculateDataQuality(personData)
      
      return personData
      
    } catch (error) {
      console.error('提取个人数据时出错:', error)
      return null
    }
  }

  extractText(element, selectors) {
    for (const selector of selectors) {
      const targetElement = element.querySelector(selector)
      if (targetElement) {
        return targetElement.textContent?.trim() || ''
      }
    }
    return ''
  }

  extractAttribute(element, selectors, attribute) {
    for (const selector of selectors) {
      const targetElement = element.querySelector(selector)
      if (targetElement) {
        return targetElement.getAttribute(attribute) || ''
      }
    }
    return ''
  }

  cleanText(text) {
    if (!text) return ''
    
    return text
      .replace(/\\s+/g, ' ')  // 合并多余空格
      .replace(/\\n/g, ' ')   // 移除换行符
      .trim()
  }

  normalizeLinkedInUrl(url) {
    if (!url) return ''
    
    try {
      // 确保是完整URL
      if (url.startsWith('/')) {
        url = 'https://www.linkedin.com' + url
      }
      
      // 移除查询参数和追踪参数
      const urlObj = new URL(url)
      return urlObj.origin + urlObj.pathname
      
    } catch (error) {
      console.error('URL标准化错误:', error)
      return url
    }
  }

  calculateDataQuality(personData) {
    let score = 0
    const maxScore = 5
    
    // 姓名 (必需)
    if (personData.name) score += 1
    
    // 职位
    if (personData.position) score += 1
    
    // 公司
    if (personData.company) score += 1
    
    // 地理位置
    if (personData.location) score += 1
    
    // LinkedIn URL
    if (personData.profileUrl) score += 1
    
    return score / maxScore
  }

  isValidPersonData(personData) {
    // 至少需要姓名
    if (!personData.name) return false
    
    // 数据质量分数至少0.4 (2/5)
    if (personData.dataQuality < 0.4) return false
    
    return true
  }

  async navigateToNextPage() {
    // 查找下一页按钮
    const nextButton = document.querySelector('.artdeco-pagination__button--next')
    
    if (nextButton && !nextButton.disabled) {
      console.log('点击下一页...')
      
      // 模拟人工点击
      await this.humanClick(nextButton)
      
      // 等待页面加载
      await this.waitForPageLoad()
    } else {
      throw new Error('没有更多页面')
    }
  }

  async humanClick(element) {
    // 模拟人工点击，包括鼠标移动
    const rect = element.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    
    // 滚动到元素可见
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await this.delay(500)
    
    // 触发鼠标事件
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    await this.delay(100)
    
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await this.delay(50)
    
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    
    await this.delay(200)
  }

  async waitForPageLoad() {
    // 等待页面加载完成
    await this.delay(2000)
    
    // 等待特定元素加载
    const maxWaitTime = this.pageLoadTimeout
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      if (document.readyState === 'complete') {
        await this.delay(1000) // 额外等待确保内容渲染
        return
      }
      await this.delay(200)
    }
  }

  async reportTaskProgress(progress, message) {
    try {
      await chrome.runtime.sendMessage({
        type: 'TASK_PROGRESS_UPDATE',
        data: {
          taskId: this.currentTask?.taskId,
          progress,
          message,
          extractedCount: this.extractedData.length,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('报告任务进度失败:', error)
    }
  }

  async reportResults() {
    try {
      console.log('报告提取结果:', this.extractedData.length, '条数据')
      
      await chrome.runtime.sendMessage({
        type: 'TASK_RESULTS',
        data: {
          taskId: this.currentTask?.taskId,
          results: this.extractedData,
          totalCount: this.extractedData.length,
          completedAt: Date.now()
        }
      })
    } catch (error) {
      console.error('报告结果失败:', error)
    }
  }

  async reportError(error) {
    try {
      await chrome.runtime.sendMessage({
        type: 'TASK_ERROR',
        data: {
          taskId: this.currentTask?.taskId,
          error: error.message,
          stack: error.stack,
          timestamp: Date.now()
        }
      })
    } catch (reportError) {
      console.error('报告错误失败:', reportError)
    }
  }

  async cancelExtractionTask() {
    console.log('取消数据提取任务')
    
    this.isActive = false
    this.isExtracting = false
    this.currentTask = null
    this.extractedData = []
    this.extractionProgress = 0
    
    await this.reportTaskProgress(0, '任务已取消')
  }

  // 工具函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    return this.delay(delay)
  }
}

// 初始化数据提取器
const extractor = new LinkedInDataExtractor()

console.log('LinkedIn数据提取器内容脚本初始化完成')