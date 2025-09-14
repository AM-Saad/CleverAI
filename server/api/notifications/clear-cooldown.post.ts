import { defineEventHandler } from 'h3'
import { prisma } from '~~/server/prisma/utils'

export default defineEventHandler(async (event) => {
  try {
    // Check for authorization - allow internal cron calls with secret token
    const cronToken = getHeader(event, 'x-cron-secret')

    // Allow internal cron calls with valid secret token
    const isInternalCronCall = cronToken === process.env.CRON_SECRET_TOKEN

    // Allow authenticated users (check for session cookie)
    const sessionCookie = getCookie(event, 'next-auth.session-token') || getCookie(event, '__Secure-next-auth.session-token')
    const isAuthenticatedUser = !!sessionCookie

    if (process.env.NODE_ENV === 'production' && !isInternalCronCall && !isAuthenticatedUser) {
      // In production, require some form of authorization for non-cron calls
      throw createError({
        statusCode: 401,
        statusMessage: 'Authorization required'
      })
    }

    // In development, allow all requests
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 Development mode: allowing clear cooldown request')
    }

    // For now, clear cooldown for all users (we can make this user-specific later)
    // Delete recent CARD_DUE notifications to clear the 6-hour cooldown
    const result = await prisma.scheduledNotification.deleteMany({
      where: {
        type: 'CARD_DUE',
        scheduledFor: {
          gte: new Date(Date.now() - 6 * 60 * 60 * 1000) // Last 6 hours
        }
      }
    })

    console.log(`[DEBUG] Cleared ${result.count} recent notifications`)

    return {
      success: true,
      message: `Cleared ${result.count} recent notifications`,
      count: result.count
    }

  } catch (error) {
    console.error('[API] Clear cooldown error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to clear notification cooldown'
    })
  }
})
