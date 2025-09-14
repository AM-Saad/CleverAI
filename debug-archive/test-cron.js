#!/usr/bin/env node

// Simple test script for our CronManager
const { CronManager } = require('./server/services/CronManager.ts')

async function test() {
  console.log('🧪 Testing CronManager...')

  const cronManager = new CronManager()

  // Register a simple test task
  cronManager.registerTask('check-due-cards', async () => {
    console.log('📬 Checking for due cards...')
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100))
    console.log('✅ Due cards check completed')
  })

  // Add a job
  cronManager.addJob('test-job', {
    schedule: '*/10 * * * * *', // Every 10 seconds
    taskName: 'check-due-cards',
    enabled: true
  })

  // Get status
  console.log('📊 Job status:', cronManager.getJobStatus('test-job'))

  // Test manual trigger
  console.log('🔄 Manually triggering job...')
  const result = await cronManager.triggerJob('test-job')
  console.log('📋 Result:', result)

  console.log('✅ CronManager test completed successfully!')
}

test().catch(console.error)
