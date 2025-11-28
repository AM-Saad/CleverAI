import { z } from 'zod'
import { safeGetServerSession } from '@server/utils/safeGetServerSession'
import { Errors, success } from '@server/utils/error'

const SnoozeSchema = z.object({
  duration: z.number().int().min(60).max(86400), // 1 minute to 24 hours in seconds
  timestamp: z.number().optional()
})

interface SessionWithUser {
  user?: { email?: string; id?: string }
}

export default defineEventHandler(async (event) => {
  try {
    // Get session
    const session = (await safeGetServerSession(event)) as SessionWithUser | null
    if (!session?.user?.email) {
      throw Errors.unauthorized('Must be logged in to snooze notifications')
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    if (!user) throw Errors.unauthorized('User not found')

    // Parse request body
    const body = await readBody(event)
    const { duration } = SnoozeSchema.parse(body)

    // Calculate snooze time
    const snoozeUntil = new Date(Date.now() + duration * 1000)

    // Update user's notification preferences with snooze time
    await prisma.userNotificationPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        snoozedUntil: snoozeUntil
      },
      update: {
        snoozedUntil: snoozeUntil
      }
    })

    // Mark all pending CARD_DUE notifications as skipped
    await prisma.scheduledNotification.updateMany({
      where: {
        userId: user.id,
        type: 'CARD_DUE',
        sent: false,
        scheduledFor: {
          lte: snoozeUntil
        }
      },
      data: {
        sent: true,
        lastError: `Snoozed until ${snoozeUntil.toISOString()}`
      }
    })

    console.log(`⏰ Snoozed notifications for user ${user.id} until ${snoozeUntil.toISOString()}`)

    return success(
      {
        snoozedUntil: snoozeUntil.toISOString(),
        durationSeconds: duration
      },
      { message: `Notifications snoozed for ${Math.floor(duration / 60)} minutes` }
    )
  } catch (error) {
    console.error('Snooze notification error:', error)
    if (error instanceof z.ZodError) {
      throw Errors.badRequest('Invalid snooze data', { issues: error.issues })
    }
    throw Errors.server('Failed to snooze notifications')
  }
})
