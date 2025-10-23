import { cronManager } from '@server/services/CronManager'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const secret = query.secret as string | undefined
  const validToken = process.env.CRON_SECRET_TOKEN
  if (!secret || !validToken || secret !== validToken) {
    throw Errors.unauthorized('Invalid or missing secret token')
  }

  const method = getMethod(event)
  if (method === 'GET') {
    return success(cronManager.getAllJobsStatus())
  }
  if (method === 'POST') {
    const jobName = query.job as string | undefined
    if (!jobName) throw Errors.badRequest('Job name is required')
    const result = await cronManager.triggerJob(jobName)
    if (!result.success) {
      throw Errors.server(`Failed to trigger job '${jobName}': ${result.error}`)
    }
    return success({ job: jobName, triggered: true })
  }
  throw Errors.badRequest('Method not allowed')
})
