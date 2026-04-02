// server/utils/credits.ts
//
// All credit mutations go through here. Nothing writes to UserSubscription.creditBalance
// or CreditTransaction directly — always use these functions so the audit log stays intact.

import { CreditTxType } from "@prisma/client";

// ─── Pack Configuration ────────────────────────────────────────────────────────
// netCents = what you want to receive after Stripe fees.
// chargeCents = what to charge the user (grossed up).
// Formula: chargeCents = ceil((netCents + 30) / (1 - 0.029))
// Never offer a pack where netCents < 500 — the fixed $0.30 fee makes tiny
// packs uneconomical (>17% effective fee on $2 packs).

export const CREDIT_PACKS = [
  {
    id: "pack_50" as const,
    label: "50 credits",
    credits: 50,
    netCents: 500,       // $5.00 net to you
    chargeCents: 546,    // $5.46 charged (rounds to $5.50 in UI)
    displayPrice: "$5.50",
  },
  {
    id: "pack_120" as const,
    label: "120 credits",
    credits: 120,
    netCents: 1000,      // $10.00 net
    chargeCents: 1061,   // $10.61 (show as $10.99 in UI)
    displayPrice: "$10.99",
  },
  {
    id: "pack_300" as const,
    label: "300 credits",
    credits: 300,
    netCents: 2000,      // $20.00 net
    chargeCents: 2091,   // $20.91 (show as $21.50 in UI)
    displayPrice: "$21.50",
  },
] as const;

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

export function getPackById(id: string): (typeof CREDIT_PACKS)[number] | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

// ─── Stripe Fee Gross-Up ───────────────────────────────────────────────────────
// Returns the amount in cents to charge the user so you net exactly `netCents`
// after Stripe's 2.9% + $0.30 standard US fee.

export function grossUpForStripe(netCents: number): number {
  return Math.ceil((netCents + 30) / (1 - 0.029));
}

// ─── Free Monthly Credits ──────────────────────────────────────────────────────
export const FREE_MONTHLY_CREDITS = 5;

// ─── Core Operations ───────────────────────────────────────────────────────────

/**
 * Attempt to deduct 1 credit from the user's balance atomically.
 * Returns true on success, false if the balance was 0.
 */
export async function spendCredit(userId: string): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    const sub = await tx.userSubscription.findUnique({
      where: { userId },
      select: { creditBalance: true },
    });

    if (!sub || sub.creditBalance < 1) return false;

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

  return result;
}

/**
 * Grant credits to a user and write an audit transaction.
 * Upserts the subscription so it works even before the user has ever generated.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  type: CreditTxType,
  metadata?: Record<string, unknown>
): Promise<void> {
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

/**
 * Get the current spendable credit balance for a user.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { creditBalance: true },
  });
  return sub?.creditBalance ?? 0;
}

/**
 * Grant the monthly free credit refill to all users who haven't received one
 * this calendar month. Call from your CronManager.
 */
export async function runMonthlyFreeRefill(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const subs = await prisma.userSubscription.findMany({
    where: {
      OR: [
        { lastFreeRefillAt: null },
        { lastFreeRefillAt: { lt: startOfMonth } },
      ],
    },
    select: { userId: true },
  });

  let refilled = 0;
  for (const sub of subs) {
    try {
      await prisma.$transaction([
        prisma.userSubscription.update({
          where: { userId: sub.userId },
          data: {
            creditBalance: { increment: FREE_MONTHLY_CREDITS },
            lifetimeCredits: { increment: FREE_MONTHLY_CREDITS },
            lastFreeRefillAt: now,
          },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: sub.userId,
            delta: FREE_MONTHLY_CREDITS,
            type: CreditTxType.FREE_MONTHLY_REFILL,
            metadata: {
              month: now.getMonth() + 1,
              year: now.getFullYear(),
            },
          },
        }),
      ]);
      refilled++;
    } catch (err) {
      console.error(`[credits] Monthly refill failed for ${sub.userId}:`, err);
    }
  }

  console.info(`[credits] Monthly refill complete — ${refilled} users refilled`);
  return refilled;
}