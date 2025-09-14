// Simple endpoint to check if user has folders (indicates active usage)
import { prisma } from '~~/server/prisma/utils'

export default defineEventHandler(async (_event) => {
  try {
    // Get user from session (simplified for now)
    // TODO: Replace with actual auth when implemented
    const userId = '68a60683031c492736e6b49a' // Hardcoded test user for now

    const folderCount = await prisma.folder.count({
      where: {
        userId: userId
      }
    })

    return {
      success: true,
      count: folderCount
    }

  } catch (error) {
    console.error('Error counting folders:', error)

    return {
      success: false,
      count: 0,
      error: 'Failed to count folders'
    }
  }
})
