import { safeGetServerSession } from "../../utils/safeGetServerSession"

type SessionWithUser = {
  user?: {
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
} | null

export default defineEventHandler(async (event) => {
  try {
    // Check for authenticated session with safe handling
    const session = await safeGetServerSession(event) as SessionWithUser
    if (!session || !session.user || !session.user.email) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }

    // Get Prisma client from context
    const prisma = event.context.prisma

    // Fetch user with subscription data
    const userData = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        subscription: true
      }
    })

    if (!userData) {
      setResponseStatus(event, 404)
      return {
        error: 'User not found'
      }
    }

    // Format the response
    const { password, ...userWithoutPassword } = userData

    // Format subscription data
    const subscription = userData.subscription
      ? {
          tier: userData.subscription.tier,
          generationsUsed: userData.subscription.generationsUsed,
          generationsQuota: userData.subscription.generationsQuota,
          remaining: userData.subscription.generationsQuota - userData.subscription.generationsUsed,
          periodStart: userData.subscription.periodStart,
          periodEnd: userData.subscription.periodEnd,
        }
      : {
          tier: 'FREE',
          generationsUsed: 0,
          generationsQuota: 10,
          remaining: 10,
          periodStart: new Date(),
          periodEnd: null,
        }

    return {
      ...userWithoutPassword,
      subscription
    }
  } catch (error: unknown) {
    console.error('Error fetching user profile:', error)
    setResponseStatus(event, 500)
    return {
      error: 'Failed to fetch user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
