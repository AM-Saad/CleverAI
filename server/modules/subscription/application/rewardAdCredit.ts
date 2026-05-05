import { CreditTxType } from "@prisma/client";
import { grantCredits } from "./creditLedger";

export interface RewardAdCreditResult {
  ok: boolean;
  duplicate: boolean;
}

export async function rewardAdCredit(input: {
  prisma: any;
  userId: string;
  sessionToken: string;
}): Promise<RewardAdCreditResult> {
  const { prisma, userId, sessionToken } = input;

  const existingReward = await prisma.creditTransaction.findFirst({
    where: { metadata: { path: ["adSessionToken"], equals: sessionToken } },
  });

  if (existingReward) {
    return { ok: true, duplicate: true };
  }

  await grantCredits({
    prisma,
    userId,
    amount: 1,
    type: CreditTxType.AD_REWARD,
    metadata: { adSessionToken: sessionToken },
  });

  return { ok: true, duplicate: false };
}
