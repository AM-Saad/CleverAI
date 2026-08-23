import type { ConsumedQuota } from "../ports/QuotaPort";

export interface GenerationQuotaStatus {
  canGenerate: boolean;
  subscription: {
    tier: string;
    generationsUsed: number;
    generationsQuota: number;
    remaining: number;
    creditBalance: number;
  };
  error?: string;
}

export interface ConsumedGenerationQuota {
  tier: string;
  generationsUsed: number;
  generationsQuota: number;
  remaining: number;
  creditBalance: number;
  creditSpent: boolean;
  reservationKind: "quota" | "credit" | "unlimited";
}

export async function checkGenerationQuota(input: {
  prisma: any;
  userId: string;
}): Promise<GenerationQuotaStatus> {
  const { prisma, userId } = input;

  try {
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        canGenerate: true,
        subscription: {
          tier: "FREE",
          generationsUsed: 0,
          generationsQuota: 10,
          remaining: 10,
          creditBalance: 0,
        },
      };
    }

    const remaining = Math.max(
      0,
      subscription.generationsQuota - subscription.generationsUsed,
    );
    const creditBalance = subscription.creditBalance ?? 0;
    const canGenerate =
      remaining > 0 || subscription.tier !== "FREE" || creditBalance > 0;

    return {
      canGenerate,
      subscription: {
        tier: subscription.tier,
        generationsUsed: subscription.generationsUsed,
        generationsQuota: subscription.generationsQuota,
        remaining,
        creditBalance,
      },
      error: canGenerate
        ? undefined
        : "Generation quota exceeded and no credits remaining. Purchase credits or watch an ad to continue.",
    };
  } catch (error) {
    console.error("Failed to check user quota:", error);
    throw error;
  }
}

export async function consumeGenerationQuota(input: {
  prisma: any;
  userId: string;
}): Promise<ConsumedGenerationQuota> {
  const { prisma, userId } = input;

  try {
    return await prisma.$transaction(async (tx: any) => {
      let subscription = await tx.userSubscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        subscription = await tx.userSubscription.create({
          data: {
            userId,
            tier: "FREE",
            generationsUsed: 1,
            generationsQuota: 10,
          },
        });
        return quotaResult(subscription, false, "quota");
      }

      if (subscription.tier !== "FREE") {
        return quotaResult(subscription, false, "unlimited");
      }

      if (subscription.generationsUsed < subscription.generationsQuota) {
        subscription = await tx.userSubscription.update({
          where: { userId },
          data: { generationsUsed: { increment: 1 } },
        });
        return quotaResult(subscription, false, "quota");
      }

      if ((subscription.creditBalance ?? 0) < 1) {
        throw new Error("GENERATION_QUOTA_EXCEEDED");
      }

      subscription = await tx.userSubscription.update({
        where: { userId },
        data: { creditBalance: { decrement: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          delta: -1,
          type: "GENERATION_SPEND",
        },
      });
      return quotaResult(subscription, true, "credit");
    });
  } catch (error) {
    console.error("Failed to reserve generation quota:", error);
    throw error;
  }
}

function quotaResult(
  subscription: any,
  creditSpent: boolean,
  reservationKind: ConsumedGenerationQuota["reservationKind"],
): ConsumedGenerationQuota {
  return {
    tier: subscription.tier,
    generationsUsed: subscription.generationsUsed,
    generationsQuota: subscription.generationsQuota,
    remaining: Math.max(
      0,
      subscription.generationsQuota - subscription.generationsUsed,
    ),
    creditBalance: subscription.creditBalance ?? 0,
    creditSpent,
    reservationKind,
  };
}

export async function refundGenerationQuota(input: {
  prisma: any;
  userId: string;
  reservation: ConsumedQuota;
}): Promise<void> {
  const { prisma, userId, reservation } = input;
  if (reservation.reservationKind === "unlimited") return;

  await prisma.$transaction(async (tx: any) => {
    if (reservation.reservationKind === "credit") {
      await tx.userSubscription.update({
        where: { userId },
        data: { creditBalance: { increment: 1 } },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          delta: 1,
          type: "GENERATION_REFUND",
        },
      });
      return;
    }

    const subscription = await tx.userSubscription.findUnique({
      where: { userId },
      select: { generationsUsed: true },
    });
    if ((subscription?.generationsUsed ?? 0) > 0) {
      await tx.userSubscription.update({
        where: { userId },
        data: { generationsUsed: { decrement: 1 } },
      });
    }
  });
}
