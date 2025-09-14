import { checkDueCards } from "~~/server/tasks/check-due-cards"

export default defineEventHandler(async (_event) => {
  try {
    console.log('🔔 DEBUG: Cron job triggered via debug endpoint...')

    const result = await checkDueCards()

    return {
      success: true,
      message: 'Card due notifications check completed (debug)',
      data: result
    }

  } catch (error) {
    console.error('Error in debug cron endpoint:', error)

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to process due card notifications",
      data: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
