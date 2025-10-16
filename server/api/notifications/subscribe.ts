import { z } from 'zod'
import { prisma } from '~~/server/prisma/utils'
import { safeGetServerSession } from '~~/server/utils/safeGetServerSession'
import { Errors, success } from '~/../server/utils/error'

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ auth: z.string(), p256dh: z.string() }),
  userId: z.string().optional()
})

interface SessionWithUser { user?: { email?: string; id?: string } }

export default defineEventHandler(async (event) => {
  let body: unknown
  try {
    body = await readBody(event)
    console.log('📥 Received subscription data:', body)

    const subscription = SubscriptionSchema.parse(body)

    const session = (await safeGetServerSession(event)) as SessionWithUser | null
    if (!session?.user?.email) {
      throw Errors.unauthorized('Must be logged in to subscribe to notifications')
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) throw Errors.unauthorized('User not found')

    const existingSubscription = await prisma.notificationSubscription.findUnique({ where: { endpoint: subscription.endpoint } })
    if (existingSubscription) {
      return success(existingSubscription, { message: 'Subscription already exists' })
    }

    const savedSubscription = await prisma.notificationSubscription.create({
      data: { endpoint: subscription.endpoint, keys: subscription.keys, userId: user.id }
    })

    return success(savedSubscription, { message: 'Subscription saved' })
  } catch (error) {
    console.error('Failed to save subscription:', error)
    if (error instanceof z.ZodError) {
      throw Errors.badRequest('Invalid subscription data', { issues: error.issues, received: body })
    }
    throw Errors.server('Failed to save subscription')
  }
})
