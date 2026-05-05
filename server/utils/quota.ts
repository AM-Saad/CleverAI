
import { prisma } from "./prisma";
import {
  checkGenerationQuota,
  consumeGenerationQuota,
} from "../modules/subscription/application/generationQuota";

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
  return checkGenerationQuota({ prisma, userId });
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
  return consumeGenerationQuota({ prisma, userId });
}
