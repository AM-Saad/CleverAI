import Stripe from "stripe";
import { getPackById } from "./creditLedger";

export interface CreateStripeCreditCheckoutResult {
  clientSecret: string | null;
  packId: string;
}

export async function createStripeCreditCheckout(input: {
  stripeSecretKey: string | undefined;
  userId: string;
  packId: string;
  stripe?: Pick<Stripe, "paymentIntents">;
}): Promise<CreateStripeCreditCheckoutResult> {
  const { stripeSecretKey, userId, packId } = input;
  const pack = getPackById(packId);

  if (!pack) {
    throw createError({ statusCode: 400, message: `Unknown pack: ${packId}` });
  }

  if (!stripeSecretKey) {
    throw createError({
      statusCode: 500,
      message: "Stripe has not been configured with a secret key yet.",
    });
  }

  const stripe = input.stripe ?? new Stripe(stripeSecretKey);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pack.chargeCents,
    currency: "usd",
    metadata: {
      userId,
      packId: pack.id,
    },
    description: `Cognilo ${pack.label}`,
  });

  return {
    clientSecret: paymentIntent.client_secret,
    packId: pack.id,
  };
}
