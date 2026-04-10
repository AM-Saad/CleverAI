// server/api/credits/checkout.post.ts
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { packId } = body

  const pack = getPackById(packId)
  if (!pack) {
    throw createError({ statusCode: 400, message: `Unknown pack: ${packId}` })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    throw createError({ statusCode: 500, message: "Stripe has not been configured with a secret key yet." })
  }
  const stripe = new Stripe(stripeKey)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: pack.chargeCents,
    currency: 'usd',
    metadata: {
      userId: user.id,
      packId: pack.id,
    },
    description: `Cognilo ${pack.label}`,
  })

  return { clientSecret: paymentIntent.client_secret }
})
