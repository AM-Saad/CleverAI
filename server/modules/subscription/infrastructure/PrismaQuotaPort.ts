import { prisma } from "../../../utils/prisma";
import {
  checkGenerationQuota,
  consumeGenerationQuota,
} from "../application/generationQuota";
import type { ConsumedQuota, QuotaPort, QuotaStatus } from "../ports/QuotaPort";

export class PrismaQuotaPort implements QuotaPort {
  checkGenerationQuota(userId: string): Promise<QuotaStatus> {
    return checkGenerationQuota({ prisma, userId });
  }

  consumeGeneration(userId: string): Promise<ConsumedQuota> {
    return consumeGenerationQuota({ prisma, userId });
  }
}
