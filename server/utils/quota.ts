
/**
 * Check if a user has exceeded their generation quota.
 * Credit-aware: if free-tier generations are exhausted, checks creditBalance > 0.
 * Returns an object with quota information and whether the user can generate.
 */
export async function checkUserQuota(userId: string): Promise<{
  canGenerate: boolean;
  subscription: {
    tier: string;
    generationsUsed: number;
    generationsQuota: number;
    remaining: number;
    creditBalance: number;
  };
  error?: string;
}> {
  try {
    // Get or create user subscription
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: "FREE",
          generationsUsed: 0,
          generationsQuota: 10, // Default free quota
        },
      });
    }

    const remaining = Math.max(
      0,
      subscription.generationsQuota - subscription.generationsUsed
    );

    // Credit-aware logic: allow generation if:
    // 1. Free quota has remaining uses, OR
    // 2. User is on a paid tier, OR
    // 3. User has credits to spend (credits act as overflow beyond free tier)
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
    // Fail open if there's an error checking the quota
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

/**
 * Increment the user's generation count.
 * Credit-aware: if free-tier quota is exhausted, automatically spends a credit.
 * Returns the updated subscription information.
 */
export async function incrementGenerationCount(userId: string): Promise<{
  tier: string;
  generationsUsed: number;
  generationsQuota: number;
  remaining: number;
  creditBalance: number;
  creditSpent: boolean;
}> {
  try {
    // Get or create user subscription
    let subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    // If no subscription exists, create a free tier subscription
    if (!subscription) {
      subscription = await prisma.userSubscription.create({
        data: {
          userId,
          tier: "FREE",
          generationsUsed: 1, // Start at 1 since this is the first generation
          generationsQuota: 10, // Default free quota
        },
      });

      const remaining = Math.max(
        0,
        subscription.generationsQuota - subscription.generationsUsed
      );

      return {
        tier: subscription.tier,
        generationsUsed: subscription.generationsUsed,
        generationsQuota: subscription.generationsQuota,
        remaining,
        creditBalance: subscription.creditBalance ?? 0,
        creditSpent: false,
      };
    }

    const freeRemaining =
      subscription.generationsQuota - subscription.generationsUsed;
    let creditSpent = false;

    if (subscription.tier === "FREE") {
      if (freeRemaining > 0) {
        // Still have free generations left — just increment the counter
        subscription = await prisma.userSubscription.update({
          where: { userId },
          data: {
            generationsUsed: { increment: 1 },
          },
        });
      } else {
        // Free quota exhausted — spend a credit instead
        const spent = await spendCredit(userId);
        if (spent) {
          creditSpent = true;
          // Re-fetch to get updated creditBalance
          subscription = await prisma.userSubscription.findUnique({
            where: { userId },
          }) ?? subscription;
        }
        // If no credit was spent, we still allow through here
        // (the pre-check in checkUserQuota should have blocked if truly empty)
      }
    }
    // Paid tiers: no counter increment, no credit spend

    const remaining = Math.max(
      0,
      subscription.generationsQuota - subscription.generationsUsed
    );

    return {
      tier: subscription.tier,
      generationsUsed: subscription.generationsUsed,
      generationsQuota: subscription.generationsQuota,
      remaining,
      creditBalance: subscription.creditBalance ?? 0,
      creditSpent,
    };
  } catch (error) {
    console.error("Failed to increment generation count:", error);
    // Return default values if update fails
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
