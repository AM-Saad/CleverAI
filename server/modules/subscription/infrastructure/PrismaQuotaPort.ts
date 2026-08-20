import { prisma } from "../../../utils/prisma";
import {
  checkGenerationQuota,
  consumeGenerationQuota,
  refundGenerationQuota,
} from "../application/generationQuota";
import type { ConsumedQuota, QuotaPort, QuotaStatus } from "../ports/QuotaPort";

export class PrismaQuotaPort implements QuotaPort {
  checkGenerationQuota(userId: string): Promise<QuotaStatus> {
    return checkGenerationQuota({ prisma, userId });
  }

  consumeGeneration(userId: string): Promise<ConsumedQuota> {
    return consumeGenerationQuota({ prisma, userId });
  }

  refundGeneration(userId: string, reservation: ConsumedQuota): Promise<void> {
    return refundGenerationQuota({ prisma, userId, reservation });
  }
}
