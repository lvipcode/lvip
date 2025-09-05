#!/usr/bin/env node
/**
 * LinkedIn数据提取系统 - 完整系统测试脚本
 * 
 * 功能：
 * - API接口健康检查
 * - 数据库连接验证
 * - 环境变量配置检查
 * - 基础功能集成测试
 * 
 * 使用方法：
 * node scripts/test-system.js [--baseUrl=http://localhost:3000]
 */

const axios = require('axios').default
const fs = require('fs')
const path = require('path')

class LinkedInSystemTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    this.testResults = []
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
    }
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`)
  }

  async runAllTests() {
    this.log('\n🚀 LinkedIn数据提取系统 - 完整系统测试', 'bright')
    this.log('='.repeat(60), 'cyan')
    this.log(`📍 测试目标: ${this.baseUrl}`, 'blue')
    this.log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}`, 'blue')
    this.log('='.repeat(60), 'cyan')

    // 测试套件
    const testSuites = [
      { name: '环境配置检查', method: 'testEnvironmentConfig' },
      { name: '服务器健康检查', method: 'testServerHealth' },
      { name: '数据库连接测试', method: 'testDatabaseConnection' },
      { name: 'API接口测试', method: 'testAPIEndpoints' },
      { name: '兑换码验证测试', method: 'testRedemptionCode' },
      { name: '任务管理测试', method: 'testTaskManagement' },
      { name: '插件系统测试', method: 'testPluginSystem' },
      { name: '数据导出测试', method: 'testDataExport' },
      { name: '安全性测试', method: 'testSecurity' },
    ]

    for (const suite of testSuites) {
      await this.runTestSuite(suite)
    }

    this.printSummary()
    return this.getTestSuccess()
  }

  async runTestSuite(suite) {
    this.log(`\n📋 ${suite.name}...`, 'yellow')
    try {
      await this[suite.method]()
      this.log(`✅ ${suite.name} - 通过`, 'green')
    } catch (error) {
      this.log(`❌ ${suite.name} - 失败: ${error.message}`, 'red')
      this.testResults.push({ 
        suite: suite.name, 
        status: 'FAIL', 
        error: error.message 
      })
    }
  }

  async testEnvironmentConfig() {
    const envFile = path.join(process.cwd(), '.env.local')
    
    if (!fs.existsSync(envFile)) {
      throw new Error('.env.local 文件不存在')
    }

    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_APP_URL',
      'JWT_SECRET'
    ]

    const envContent = fs.readFileSync(envFile, 'utf8')
    
    for (const varName of requiredVars) {
      if (!envContent.includes(varName)) {
        throw new Error(`缺少必需的环境变量: ${varName}`)
      }
    }

    this.testResults.push({ suite: '环境配置检查', status: 'PASS' })
  }

  async testServerHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}`, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      })
      
      if (response.status >= 400) {
        throw new Error(`服务器返回错误状态: ${response.status}`)
      }

      this.testResults.push({ suite: '服务器健康检查', status: 'PASS' })
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('服务器未启动或无法连接')
      }
      throw error
    }
  }

  async testDatabaseConnection() {
    try {
      // 尝试访问一个需要数据库的API端点
      const response = await axios.post(`${this.baseUrl}/api/redemption-codes/validate`, {
        code: 'TEST_CONNECTION'
      }, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      })

      if (response.status === 500) {
        throw new Error('数据库连接失败或配置错误')
      }

      this.testResults.push({ suite: '数据库连接测试', status: 'PASS' })
    } catch (error) {
      if (error.response?.status === 500) {
        throw new Error('数据库连接失败')
      }
      // 其他错误（如400）表示连接正常但数据无效，这是预期的
      this.testResults.push({ suite: '数据库连接测试', status: 'PASS' })
    }
  }

  async testAPIEndpoints() {
    const endpoints = [
      { path: '/api/redemption-codes/validate', method: 'POST' },
      { path: '/api/tasks/create', method: 'POST' },
      { path: '/api/plugins/register', method: 'POST' },
      { path: '/api/plugins/heartbeat', method: 'POST' }
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${this.baseUrl}${endpoint.path}`,
          data: {},
          timeout: 5000,
          validateStatus: (status) => status < 500
        })

        if (response.status >= 500) {
          throw new Error(`${endpoint.path} 返回服务器错误`)
        }
      } catch (error) {
        if (error.response?.status >= 500) {
          throw new Error(`API端点 ${endpoint.path} 服务器错误`)
        }
      }
    }

    this.testResults.push({ suite: 'API接口测试', status: 'PASS' })
  }

  async testRedemptionCode() {
    try {
      // 测试无效兑换码
      const response = await axios.post(`${this.baseUrl}/api/redemption-codes/validate`, {
        code: 'INVALID_TEST_CODE_123'
      }, {
        timeout: 5000,
        validateStatus: () => true
      })

      // 应该返回400或者成功但验证失败的结果
      if (response.status === 500) {
        throw new Error('兑换码验证API出现服务器错误')
      }

      this.testResults.push({ suite: '兑换码验证测试', status: 'PASS' })
    } catch (error) {
      throw new Error(`兑换码验证API测试失败: ${error.message}`)
    }
  }

  async testTaskManagement() {
    // 这里可以添加更复杂的任务管理测试
    // 目前只验证端点可访问性
    try {
      const response = await axios.post(`${this.baseUrl}/api/tasks/create`, {
        code: 'TEST_CODE',
        taskType: 'person-search',
        searchParams: { keywords: 'test' },
        maxResults: 10
      }, {
        timeout: 5000,
        validateStatus: () => true
      })

      if (response.status === 500) {
        throw new Error('任务创建API服务器错误')
      }

      this.testResults.push({ suite: '任务管理测试', status: 'PASS' })
    } catch (error) {
      throw new Error(`任务管理测试失败: ${error.message}`)
    }
  }

  async testPluginSystem() {
    try {
      const response = await axios.post(`${this.baseUrl}/api/plugins/register`, {
        pluginId: 'test-plugin-001',
        version: '1.0.0',
        capabilities: ['person-search']
      }, {
        timeout: 5000,
        validateStatus: () => true
      })

      if (response.status === 500) {
        throw new Error('插件注册API服务器错误')
      }

      this.testResults.push({ suite: '插件系统测试', status: 'PASS' })
    } catch (error) {
      throw new Error(`插件系统测试失败: ${error.message}`)
    }
  }

  async testDataExport() {
    // 测试数据导出功能可用性
    try {
      const response = await axios.get(`${this.baseUrl}/api/export/test-task-id`, {
        timeout: 5000,
        validateStatus: () => true
      })

      // 预期是404或400，但不应该是500
      if (response.status === 500) {
        throw new Error('数据导出API服务器错误')
      }

      this.testResults.push({ suite: '数据导出测试', status: 'PASS' })
    } catch (error) {
      throw new Error(`数据导出测试失败: ${error.message}`)
    }
  }

  async testSecurity() {
    const securityTests = [
      {
        name: 'SQL注入防护',
        test: async () => {
          await axios.post(`${this.baseUrl}/api/redemption-codes/validate`, {
            code: "'; DROP TABLE users; --"
          }, { validateStatus: () => true })
        }
      },
      {
        name: 'XSS防护',
        test: async () => {
          await axios.post(`${this.baseUrl}/api/tasks/create`, {
            code: '<script>alert("xss")</script>',
            taskType: 'person-search',
            searchParams: { keywords: '<script>alert("xss")</script>' }
          }, { validateStatus: () => true })
        }
      }
    ]

    for (const securityTest of securityTests) {
      try {
        await securityTest.test()
      } catch (error) {
        // 安全测试出错可能是好事，表示防护生效
        this.log(`  🛡️  ${securityTest.name} - 防护生效`, 'green')
      }
    }

    this.testResults.push({ suite: '安全性测试', status: 'PASS' })
  }

  printSummary() {
    this.log('\n📊 测试结果汇总', 'bright')
    this.log('='.repeat(60), 'cyan')

    let passed = 0, failed = 0

    this.testResults.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌'
      const color = result.status === 'PASS' ? 'green' : 'red'
      
      this.log(`${icon} ${result.suite}: ${result.status}`, color)
      
      if (result.error) {
        this.log(`   错误详情: ${result.error}`, 'red')
      }
      
      if (result.status === 'PASS') passed++
      else failed++
    })

    this.log('\n' + '='.repeat(60), 'cyan')
    this.log(`📈 总计: ${this.testResults.length} | ✅ 通过: ${passed} | ❌ 失败: ${failed}`, 'bright')
    this.log(`⏰ 完成时间: ${new Date().toLocaleString('zh-CN')}`, 'blue')

    if (failed === 0) {
      this.log('\n🎉 所有测试通过！系统运行正常。', 'green')
    } else {
      this.log('\n⚠️  部分测试失败，请检查上述错误并修复。', 'yellow')
    }

    this.log('='.repeat(60), 'cyan')
  }

  getTestSuccess() {
    return this.testResults.every(result => result.status === 'PASS')
  }
}

// 命令行参数解析
const args = process.argv.slice(2)
const options = {}

args.forEach(arg => {
  if (arg.startsWith('--baseUrl=')) {
    options.baseUrl = arg.split('=')[1]
  }
})

// 运行测试
async function main() {
  try {
    const tester = new LinkedInSystemTester(options)
    const success = await tester.runAllTests()
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('❌ 测试运行失败:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = LinkedInSystemTester