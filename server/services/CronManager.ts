import { CronJob } from 'cron'

// Available tasks for cron jobs
export type TaskName = 'check-due-cards' | 'process-notifications'

// Configuration for a cron job
export interface CronConfig {
  schedule: string
  taskName: TaskName
  timezone?: string
  enabled?: boolean
}

// Internal job storage structure
interface JobInfo {
  cronJob: CronJob
  config: CronConfig
  lastRun: Date | null
  lastResult: { success: boolean; error?: string } | null
  isStarted: boolean
}

// Task function type
type TaskFunction = () => Promise<void>

export class CronManager {
  private jobs = new Map<string, JobInfo>()
  private tasks = new Map<TaskName, TaskFunction>()

  constructor() {
    console.info('🕐 CronManager initialized')
  }

  // Register a task function
  registerTask(taskName: TaskName, taskFunction: TaskFunction): void {
    this.tasks.set(taskName, taskFunction)
    console.info(`📝 Task '${taskName}' registered`)
  }

  // Add a cron job
  addJob(jobName: string, config: CronConfig): void {
    const taskFunction = this.tasks.get(config.taskName)
    if (!taskFunction) {
      throw new Error(`Task '${config.taskName}' not found`)
    }

    if (this.jobs.has(jobName)) {
      console.warn(`Job '${jobName}' already exists. Skipping.`)
      return
    }

    try {
      const cronJob = new CronJob(
        config.schedule,
        () => this.executeTask(jobName, config.taskName, taskFunction),
        null, // onComplete
        false, // start
        config.timezone || 'UTC' // timeZone
      )

      this.jobs.set(jobName, {
        cronJob,
        config,
        lastRun: null,
        lastResult: null,
        isStarted: false
      })

      console.info(`✅ Cron job '${jobName}' added with schedule: ${config.schedule}`)
    } catch (error) {
      console.error(`❌ Failed to add cron job '${jobName}':`, error)
      throw error
    }
  }

  // Safe task execution with error handling
  private async executeTask(jobName: string, taskName: TaskName, taskFunction: TaskFunction): Promise<void> {
    const startTime = Date.now()
    console.info(`🚀 Starting cron job '${jobName}' (task: ${taskName})`)

    try {
      await taskFunction()

      const duration = Date.now() - startTime
      const result = { success: true }

      // Update job info
      const jobInfo = this.jobs.get(jobName)
      if (jobInfo) {
        jobInfo.lastRun = new Date()
        jobInfo.lastResult = result
      }

      console.info(`✅ Cron job '${jobName}' completed successfully in ${duration}ms`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      const result = { success: false, error: errorMessage }

      // Update job info
      const jobInfo = this.jobs.get(jobName)
      if (jobInfo) {
        jobInfo.lastRun = new Date()
        jobInfo.lastResult = result
      }

      console.error(`❌ Cron job '${jobName}' failed after ${duration}ms:`, error)
    }
  }

  // Load jobs from configuration
  async loadJobs(jobConfigs: Array<CronConfig & { name: string }>): Promise<void> {
    for (const jobConfig of jobConfigs) {
      if (jobConfig.enabled !== false) {
        this.addJob(jobConfig.name, jobConfig)
      }
    }
  }

  // Start all jobs
  startAll(): void {
    for (const [jobName, jobInfo] of this.jobs) {
      if (jobInfo.config.enabled !== false) {
        jobInfo.cronJob.start()
        jobInfo.isStarted = true
        console.info(`▶️ Started cron job '${jobName}'`)
      }
    }
  }

  // Stop all jobs
  stopAll(): void {
    for (const [jobName, jobInfo] of this.jobs) {
      jobInfo.cronJob.stop()
      jobInfo.isStarted = false
      console.info(`⏹️ Stopped cron job '${jobName}'`)
    }
  }

  // Manually trigger a job
  async triggerJob(jobName: string): Promise<{ success: boolean; error?: string }> {
    const jobInfo = this.jobs.get(jobName)
    if (!jobInfo) {
      const error = `Job '${jobName}' not found`
      console.error(`❌ ${error}`)
      return { success: false, error }
    }

    const taskFunction = this.tasks.get(jobInfo.config.taskName)
    if (!taskFunction) {
      const error = `Task '${jobInfo.config.taskName}' not found`
      console.error(`❌ ${error}`)
      return { success: false, error }
    }

    try {
      console.info(`🔄 Manually triggering job '${jobName}'`)
      await this.executeTask(jobName, jobInfo.config.taskName, taskFunction)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }

  // Get job status
  getJobStatus(jobName: string): {
    exists: boolean
    running?: boolean
    config?: CronConfig
    lastRun?: Date | null
    lastResult?: { success: boolean; error?: string } | null
    nextRun?: string
  } {
    const jobInfo = this.jobs.get(jobName)
    if (!jobInfo) {
      return { exists: false }
    }

    // Get running status using our own tracking
    const isRunning = jobInfo.isStarted

    return {
      exists: true,
      running: isRunning,
      config: jobInfo.config,
      lastRun: jobInfo.lastRun,
      lastResult: jobInfo.lastResult,
      nextRun: jobInfo.cronJob.nextDate()?.toString()
    }
  }

  // Get all jobs status
  getAllJobsStatus(): Record<string, ReturnType<CronManager['getJobStatus']>> {
    const status: Record<string, ReturnType<CronManager['getJobStatus']>> = {}

    for (const jobName of this.jobs.keys()) {
      status[jobName] = this.getJobStatus(jobName)
    }

    return status
  }
}

// Create and export a single instance directly
export const cronManager = new CronManager()
