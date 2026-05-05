import { CreditTxType } from "@prisma/client";
import { getPackById, grantCredits } from "./creditLedger";

export interface GrantStripePurchaseCreditsResult {
  ok: boolean;
  duplicate: boolean;
  packId: string | null;
  creditsGranted: number;
}

export async function grantStripePurchaseCredits(input: {
  prisma: any;
  userId: string;
  packId: string;
  stripePaymentIntentId: string;
}): Promise<GrantStripePurchaseCreditsResult> {
  const { prisma, userId, packId, stripePaymentIntentId } = input;
  const pack = getPackById(packId);

  if (!pack) {
    return {
      ok: false,
      duplicate: false,
      packId: null,
      creditsGranted: 0,
    };
  }

  const existingGrant = await prisma.creditTransaction.findFirst({
    where: {
      metadata: { path: ["stripePaymentIntentId"], equals: stripePaymentIntentId },
    },
  });

  if (existingGrant) {
    return {
      ok: true,
      duplicate: true,
      packId: pack.id,
      creditsGranted: 0,
    };
  }

  await grantCredits({
    prisma,
    userId,
    amount: pack.credits,
    type: CreditTxType.STRIPE_PURCHASE,
    metadata: {
      stripePaymentIntentId,
      packId: pack.id,
    },
  });

  return {
    ok: true,
    duplicate: false,
    packId: pack.id,
    creditsGranted: pack.credits,
  };
}
