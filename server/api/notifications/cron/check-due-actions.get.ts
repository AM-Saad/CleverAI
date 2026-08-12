import { checkDueActions } from "~~/server/tasks/check-due-actions"
import { Errors, success } from "~~/server/utils/error"

export default defineEventHandler(async (event) => {
  const isDev = process.env.NODE_ENV === 'development'
  const authHeader = getHeader(event, 'authorization')
  const validToken = process.env.CRON_SECRET_TOKEN

  const isAuthorized = isDev || (authHeader && validToken && authHeader === `Bearer ${validToken}`)
  if (!isAuthorized) {
    throw Errors.unauthorized()
  }

  const result = await checkDueActions()
  return success(result, { message: 'Action item reminder check completed' })
})
