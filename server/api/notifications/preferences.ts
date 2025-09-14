import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"

const PreferencesSchema = z.object({
  cardDueEnabled: z.boolean(),
  cardDueTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  cardDueThreshold: z.number().min(1).max(100),

  dailyReminderEnabled: z.boolean(),
  dailyReminderTime: z.string().regex(/^\d{2}:\d{2}$/),

  timezone: z.string(),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  sendAnytimeOutsideQuietHours: z.boolean().default(false),
  activeHoursEnabled: z.boolean().default(false),
  activeHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  activeHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('21:00'),
})

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  try {
    // TODO: Get user ID from session when auth is implemented
    // const session = await getServerSession(event)
    // if (!session?.user) {
    //   throw createError({
    //     statusCode: 401,
    //     statusMessage: 'Unauthorized'
    //   })
    // }
    // const userId = session.user.id

    // For now, use a placeholder user ID
    const userId = "68a60683031c492736e6b49a" // TODO: Remove when auth is implemented

    if (method === 'GET') {
      // Get user's notification preferences
      let preferences = await prisma.userNotificationPreferences.findUnique({
        where: { userId }
      })

      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await prisma.userNotificationPreferences.create({
          data: {
            userId,
            cardDueEnabled: true,
            cardDueTime: "09:00",
            cardDueThreshold: 5,
            dailyReminderEnabled: false,
            dailyReminderTime: "19:00",
            timezone: "UTC",
            quietHoursEnabled: false,
            quietHoursStart: "22:00",
            quietHoursEnd: "08:00",
            sendAnytimeOutsideQuietHours: false,
            activeHoursEnabled: false,
            activeHoursStart: '09:00',
            activeHoursEnd: '21:00'
          }
        })
      }

      return {
        success: true,
        data: {
          cardDueEnabled: preferences.cardDueEnabled,
          cardDueTime: preferences.cardDueTime,
          cardDueThreshold: preferences.cardDueThreshold,
          dailyReminderEnabled: preferences.dailyReminderEnabled,
          dailyReminderTime: preferences.dailyReminderTime,
          timezone: preferences.timezone,
          quietHoursEnabled: preferences.quietHoursEnabled,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          sendAnytimeOutsideQuietHours: preferences.sendAnytimeOutsideQuietHours,
          activeHoursEnabled: preferences.activeHoursEnabled,
          activeHoursStart: preferences.activeHoursStart,
          activeHoursEnd: preferences.activeHoursEnd
        }
      }
    }

    if (method === 'PUT') {
      // Update user's notification preferences
      const body = await readBody(event)
      const validatedPrefs = PreferencesSchema.parse(body)

      // Upsert preferences
      const preferences = await prisma.userNotificationPreferences.upsert({
        where: { userId },
        update: validatedPrefs,
        create: {
          userId,
          ...validatedPrefs
        }
      })

      return {
        success: true,
        message: 'Preferences updated successfully',
        data: {
          cardDueEnabled: preferences.cardDueEnabled,
          cardDueTime: preferences.cardDueTime,
          cardDueThreshold: preferences.cardDueThreshold,
          dailyReminderEnabled: preferences.dailyReminderEnabled,
          dailyReminderTime: preferences.dailyReminderTime,
          timezone: preferences.timezone,
          quietHoursEnabled: preferences.quietHoursEnabled,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          sendAnytimeOutsideQuietHours: preferences.sendAnytimeOutsideQuietHours,
          activeHoursEnabled: preferences.activeHoursEnabled,
          activeHoursStart: preferences.activeHoursStart,
          activeHoursEnd: preferences.activeHoursEnd
        }
      }
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed'
    })

  } catch (error) {
    console.error("Failed to handle notification preferences:", error)

    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid preferences data',
        data: error.issues
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
    })
  }
})
