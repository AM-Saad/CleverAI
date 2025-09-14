import { checkDueCards } from "~~/server/tasks/check-due-cards"

export default defineEventHandler(async (event) => {
  try {
    // Basic security - only allow in development or with proper authorization
    const isDev = process.env.NODE_ENV === 'development'
    const authHeader = getHeader(event, 'authorization')
    const validToken = process.env.CRON_SECRET_TOKEN

    console.log('🔍 Debug auth check:', {
      isDev,
      NODE_ENV: process.env.NODE_ENV,
      hasAuthHeader: !!authHeader,
      hasValidToken: !!validToken
    })

    // Allow in development OR with valid authorization token
    const isAuthorized = isDev || (authHeader && validToken && authHeader === `Bearer ${validToken}`)

    if (!isAuthorized) {
      console.log('❌ Authorization failed')
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    console.log('🔔 Cron job triggered: checking due cards...')

    const result = await checkDueCards()

    return {
      success: true,
      message: 'Card due notifications check completed',
      data: result
    }

  } catch (error) {
    console.error('Error in cron/check-due-cards:', error)

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to process due card notifications",
      data: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})
