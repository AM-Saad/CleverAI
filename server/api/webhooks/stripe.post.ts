import { getHeader, readRawBody } from "h3";
import Stripe from "stripe";
import { grantStripePurchaseCredits } from "../../modules/subscription/application/grantStripePurchaseCredits";

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
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
    if (!packId || !userId) return { received: true }

    await grantStripePurchaseCredits({
      prisma,
      userId,
      packId,
      stripePaymentIntentId: intent.id,
    });
  }

  return { received: true }
})
