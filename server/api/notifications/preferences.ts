import { z } from 'zod'
import { prisma } from "~~/server/prisma/utils"

const PreferencesSchema = z.object({
  enabled: z.boolean(),
  types: z.object({
    system: z.boolean(),
    folder_update: z.boolean(),
    quiz_reminder: z.boolean(),
    study_reminder: z.boolean(),
    achievement: z.boolean(),
    marketing: z.boolean(),
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
    end: z.string().regex(/^\d{2}:\d{2}$/),   // HH:MM format
  }).optional(),
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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          // Note: preferences field doesn't exist in schema yet
          // This would need to be added to the User model
        }
      })

      if (!user) {
        throw createError({
          statusCode: 404,
          statusMessage: 'User not found'
        })
      }

      // Return default preferences for now
      const defaultPreferences = {
        enabled: true,
        types: {
          system: true,
          folder_update: true,
          quiz_reminder: true,
          study_reminder: true,
          achievement: true,
          marketing: false,
        },
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
        }
      }

      return {
        success: true,
        data: defaultPreferences
      }
    }

    if (method === 'PUT') {
      // Update user's notification preferences
      const body = await readBody(event)
      const preferences = PreferencesSchema.parse(body)

      // TODO: Update user preferences in database
      // This would require adding a preferences field to the User model
      // await prisma.user.update({
      //   where: { id: userId },
      //   data: { preferences }
      // })

      return {
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
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
