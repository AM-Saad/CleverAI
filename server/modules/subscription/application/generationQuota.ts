import { spendCredit } from "./creditLedger";

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
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: "FREE",
          generationsUsed: 0,
          generationsQuota: 10,
        },
      });
    }

    const remaining = Math.max(
      0,
      subscription.generationsQuota - subscription.generationsUsed
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
    return {
      canGenerate: true,
      subscription: {
        tier: "FREE",
        generationsUsed: 0,
        generationsQuota: 10,
        remaining: 10,
        creditBalance: 0,
      },
      error: "Failed to check quota. Please try again later.",
    };
  }
}

export async function consumeGenerationQuota(input: {
  prisma: any;
  userId: string;
}): Promise<ConsumedGenerationQuota> {
  const { prisma, userId } = input;

  try {
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: "FREE",
          generationsUsed: 1,
          generationsQuota: 10,
        },
      });

      return {
        tier: subscription.tier,
        generationsUsed: subscription.generationsUsed,
        generationsQuota: subscription.generationsQuota,
        remaining: Math.max(
          0,
          subscription.generationsQuota - subscription.generationsUsed
        ),
        creditBalance: subscription.creditBalance ?? 0,
        creditSpent: false,
      };
    }

    const freeRemaining =
      subscription.generationsQuota - subscription.generationsUsed;
    let creditSpent = false;

    if (subscription.tier === "FREE") {
      if (freeRemaining > 0) {
        subscription = await prisma.userSubscription.update({
          where: { userId },
          data: { generationsUsed: { increment: 1 } },
        });
      } else if (await spendCredit({ prisma, userId })) {
        creditSpent = true;
        subscription =
          (await prisma.userSubscription.findUnique({
            where: { userId },
          })) ?? subscription;
      }
    }

    return {
      tier: subscription.tier,
      generationsUsed: subscription.generationsUsed,
      generationsQuota: subscription.generationsQuota,
      remaining: Math.max(
        0,
        subscription.generationsQuota - subscription.generationsUsed
      ),
      creditBalance: subscription.creditBalance ?? 0,
      creditSpent,
    };
  } catch (error) {
    console.error("Failed to increment generation count:", error);
    return {
      tier: "FREE",
      generationsUsed: 0,
      generationsQuota: 10,
      remaining: 10,
      creditBalance: 0,
      creditSpent: false,
    };
  }
}
