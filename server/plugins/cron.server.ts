import { checkDueCards } from '~~/server/tasks/check-due-cards'
import { cronManager } from "~~/server/services/CronManager"


export default defineNitroPlugin(async (nitroApp) => {
  // Only initialize cron jobs on the server side and not in development API routes
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    console.log('🕐 Initializing cron jobs...')

    try {
      // Register tasks
      cronManager.registerTask('check-due-cards', async () => {
        await checkDueCards()
      })

      // Add jobs with configuration from environment
      const jobConfigs = [
        {
          name: 'check-due-cards',
          schedule: process.env.CRON_CHECK_DUE_CARDS_SCHEDULE || '0 */4 * * *', // Every 4 hours
          taskName: 'check-due-cards' as const,
          timezone: process.env.CRON_CHECK_DUE_CARDS_TIMEZONE || 'UTC',
          enabled: true
        }
      ]

      await cronManager.loadJobs(jobConfigs)
      cronManager.startAll()

      console.log('✅ Cron jobs initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize cron jobs:', error)
    }

    // Graceful shutdown
    nitroApp.hooks.hook('close', async () => {
      console.log('🛑 Shutting down cron jobs...')
      cronManager.stopAll()
    })
  } else {
    console.log('⏸️ Cron jobs disabled (development mode)')
  }
})
