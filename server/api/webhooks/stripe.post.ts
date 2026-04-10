// server/api/webhooks/stripe.post.ts
import Stripe from 'stripe'
import { CreditTxType } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const rawBody = await readRawBody(event)
  const sig = getHeader(event, 'stripe-signature')!

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody!, sig, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  // Return 200 immediately, process async — Stripe retries on timeout
  if (stripeEvent.type === 'payment_intent.succeeded') {
    const intent = stripeEvent.data.object as Stripe.PaymentIntent
    const { userId, packId } = intent.metadata
    const pack = CREDIT_PACKS.find(p => p.id === packId)
    if (!pack || !userId) return { received: true }

    await grantCredits(userId, pack.credits, CreditTxType.STRIPE_PURCHASE, {
      stripePaymentIntentId: intent.id,
      packId
    })
  }

  return { received: true }
})