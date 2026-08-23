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
  reservationKind: "quota" | "credit" | "unlimited";
}

export interface QuotaPort {
  checkGenerationQuota(userId: string): Promise<QuotaStatus>;
  consumeGeneration(userId: string): Promise<ConsumedQuota>;
  refundGeneration(userId: string, reservation: ConsumedQuota): Promise<void>;
}
