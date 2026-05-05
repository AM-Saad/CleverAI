import { readBody } from "h3";
import { createStripeCreditCheckout } from "../../modules/subscription/application/createStripeCreditCheckout";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const { packId } = body

  const result = await createStripeCreditCheckout({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    userId: user.id,
    packId,
  });

  return { clientSecret: result.clientSecret }
})
