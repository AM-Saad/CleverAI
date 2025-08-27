import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/**
 * Check if a user has exceeded their generation quota
 * Returns an object with quota information and whether the user can generate
 */
export async function checkUserQuota(userId: string): Promise<{
  canGenerate: boolean
  subscription: {
    tier: string
    generationsUsed: number
    generationsQuota: number
    remaining: number
  }
  error?: string
}> {
  try {
    // Get or create user subscription
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    })

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: 'FREE',
          generationsUsed: 0,
          generationsQuota: 10, // Default free quota
        },
      })
    }

    const remaining = Math.max(0, subscription.generationsQuota - subscription.generationsUsed)
    const canGenerate = remaining > 0 || subscription.tier !== 'FREE'

    return {
      canGenerate,
      subscription: {
        tier: subscription.tier,
        generationsUsed: subscription.generationsUsed,
        generationsQuota: subscription.generationsQuota,
        remaining,
      },
      error: canGenerate ? undefined : 'Generation quota exceeded. Please upgrade to continue generating content.',
    }
  } catch (error) {
    console.error('Failed to check user quota:', error)
    // Fail open if there's an error checking the quota
    return {
      canGenerate: true,
      subscription: {
        tier: 'FREE',
        generationsUsed: 0,
        generationsQuota: 10,
        remaining: 10,
      },
      error: 'Failed to check quota. Please try again later.',
    }
  }
}

/**
 * Increment the user's generation count
 * Returns the updated subscription information
 */
export async function incrementGenerationCount(userId: string): Promise<{
  tier: string
  generationsUsed: number
  generationsQuota: number
  remaining: number
}> {
  try {
    // Get or create user subscription
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    })

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: 'FREE',
          generationsUsed: 1, // Start at 1 since this is the first generation
          generationsQuota: 10, // Default free quota
        },
      })
    } else {
      // Only increment for free tier users
      if (subscription.tier === 'FREE') {
        subscription = await prisma.userSubscription.update({
          where: { userId },
          data: {
            generationsUsed: { increment: 1 }
          },
        })
      }
    }

    const remaining = Math.max(0, subscription.generationsQuota - subscription.generationsUsed)

    return {
      tier: subscription.tier,
      generationsUsed: subscription.generationsUsed,
      generationsQuota: subscription.generationsQuota,
      remaining,
    }
  } catch (error) {
    console.error('Failed to increment generation count:', error)
    // Return default values if update fails
    return {
      tier: 'FREE',
      generationsUsed: 0,
      generationsQuota: 10,
      remaining: 10,
    }
  }
}
