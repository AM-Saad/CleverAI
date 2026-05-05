import { CreditTxType } from "@prisma/client";

export const CREDIT_PACKS = [
  {
    id: "pack_50" as const,
    label: "50 credits",
    credits: 50,
    netCents: 500,
    chargeCents: 546,
    displayPrice: "$5.50",
  },
  {
    id: "pack_120" as const,
    label: "120 credits",
    credits: 120,
    netCents: 1000,
    chargeCents: 1061,
    displayPrice: "$10.99",
  },
  {
    id: "pack_300" as const,
    label: "300 credits",
    credits: 300,
    netCents: 2000,
    chargeCents: 2091,
    displayPrice: "$21.50",
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

export const FREE_MONTHLY_CREDITS = 5;

export function getPackById(id: string): (typeof CREDIT_PACKS)[number] | null {
  return CREDIT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function grossUpForStripe(netCents: number): number {
  return Math.ceil((netCents + 30) / (1 - 0.029));
}

export async function spendCredit(input: { prisma: any; userId: string }) {
  const { prisma, userId } = input;
  return prisma.$transaction(async (tx: any) => {
    const subscription = await tx.userSubscription.findUnique({
      where: { userId },
      select: { creditBalance: true },
    });

    if (!subscription || subscription.creditBalance < 1) {
      return false;
    }

    await tx.userSubscription.update({
      where: { userId },
      data: { creditBalance: { decrement: 1 } },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        delta: -1,
        type: CreditTxType.GENERATION_SPEND,
      },
    });

    return true;
  });
}

export async function grantCredits(input: {
  prisma: any;
  userId: string;
  amount: number;
  type: CreditTxType;
  metadata?: Record<string, unknown>;
}) {
  const { prisma, userId, amount, type, metadata } = input;
  await prisma.$transaction([
    prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: "FREE",
        generationsUsed: 0,
        generationsQuota: 10,
        creditBalance: amount,
        lifetimeCredits: amount,
      },
      update: {
        creditBalance: { increment: amount },
        lifetimeCredits: { increment: amount },
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        delta: amount,
        type,
        metadata: metadata ?? null,
      },
    }),
  ]);
}

export async function getCreditBalance(input: { prisma: any; userId: string }) {
  const subscription = await input.prisma.userSubscription.findUnique({
    where: { userId: input.userId },
    select: { creditBalance: true },
  });
  return subscription?.creditBalance ?? 0;
}

export async function runMonthlyFreeRefill(input: { prisma: any }) {
  const { prisma } = input;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      OR: [
        { lastFreeRefillAt: null },
        { lastFreeRefillAt: { lt: startOfMonth } },
      ],
    },
    select: { userId: true },
  });

  let refilled = 0;
  for (const subscription of subscriptions) {
    try {
      await prisma.$transaction([
        prisma.userSubscription.update({
          where: { userId: subscription.userId },
          data: {
            creditBalance: { increment: FREE_MONTHLY_CREDITS },
            lifetimeCredits: { increment: FREE_MONTHLY_CREDITS },
            lastFreeRefillAt: now,
          },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: subscription.userId,
            delta: FREE_MONTHLY_CREDITS,
            type: CreditTxType.FREE_MONTHLY_REFILL,
            metadata: {
              month: now.getMonth() + 1,
              year: now.getFullYear(),
            },
          },
        }),
      ]);
      refilled += 1;
    } catch (error) {
      console.error(
        `[credits] Monthly refill failed for ${subscription.userId}:`,
        error
      );
    }
  }

  console.info(`[credits] Monthly refill complete — ${refilled} users refilled`);
  return refilled;
}
