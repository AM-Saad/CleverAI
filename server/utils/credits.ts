// server/utils/credits.ts
//
// All credit mutations go through here. Nothing writes to UserSubscription.creditBalance
// or CreditTransaction directly — always use these functions so the audit log stays intact.

import { CreditTxType } from "@prisma/client";
import { prisma } from "./prisma";
import {
  CREDIT_PACKS,
  FREE_MONTHLY_CREDITS,
  getPackById,
  grossUpForStripe,
  spendCredit as spendCreditInModule,
  grantCredits as grantCreditsInModule,
  getCreditBalance as getCreditBalanceInModule,
  runMonthlyFreeRefill as runMonthlyFreeRefillInModule,
} from "../modules/subscription/application/creditLedger";

export type PackId = (typeof CREDIT_PACKS)[number]["id"];

// ─── Core Operations ───────────────────────────────────────────────────────────

/**
 * Attempt to deduct 1 credit from the user's balance atomically.
 * Returns true on success, false if the balance was 0.
 */
export async function spendCredit(userId: string): Promise<boolean> {
  return spendCreditInModule({ prisma, userId });
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
  return grantCreditsInModule({ prisma, userId, amount, type, metadata });
}

/**
 * Get the current spendable credit balance for a user.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  return getCreditBalanceInModule({ prisma, userId });
}

/**
 * Grant the monthly free credit refill to all users who haven't received one
 * this calendar month. Call from your CronManager.
 */
export async function runMonthlyFreeRefill(): Promise<number> {
  return runMonthlyFreeRefillInModule({ prisma });
}
