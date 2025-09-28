import { checkDueCards } from "~~/server/tasks/check-due-cards"
import { success } from "~~/server/utils/error"

export default defineEventHandler(async (_event) => {
  const result = await checkDueCards()
  return success(result, { message: 'Card due notifications check completed (debug)' })
})
