import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CaptureWordDTO } from "@shared/utils/language.contract";
import { captureLanguageWord } from "@server/modules/language-learning/application/captureLanguageWord";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import {
  setQuotaHeaders,
  throwQuotaExceeded,
} from "@server/modules/subscription/infrastructure/http/quotaHttp";

const quotaPort = new PrismaQuotaPort();

async function billSharedTranslationHit(event: any, userId: string) {
  const quota = await quotaPort.checkGenerationQuota(userId);
  setQuotaHeaders(event, quota.subscription);
  if (!quota.canGenerate) {
    throwQuotaExceeded(
      event,
      quota.subscription,
      "Quota exceeded. Please upgrade to continue translating.",
    );
  }

  const updatedQuota = await quotaPort.consumeGeneration(userId);
  setQuotaHeaders(event, updatedQuota);
  return updatedQuota;
}

export default defineEventHandler(async (event) => {
  let data: CaptureWordDTO;
  try {
    data = CaptureWordDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const user = await requireRole(event, ["USER"]);
  return success(
    await captureLanguageWord({
      event,
      user,
      data,
      quotaPort,
      billSharedTranslationHit,
    }),
  );
});
