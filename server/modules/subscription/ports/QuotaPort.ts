export interface QuotaStatus {
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

export interface ConsumedQuota {
  tier: string;
  generationsUsed: number;
  generationsQuota: number;
  remaining: number;
  creditBalance: number;
  creditSpent: boolean;
}

export interface QuotaPort {
  checkGenerationQuota(userId: string): Promise<QuotaStatus>;
  consumeGeneration(userId: string): Promise<ConsumedQuota>;
}
