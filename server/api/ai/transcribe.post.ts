import { z } from "zod";
import { success, Errors } from "@server/utils/error";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import { toSubscriptionSnapshot } from "@server/modules/subscription/infrastructure/http/quotaHttp";
import {
  llmRequestPipeline,
  throwMappedOpenRouterError,
} from "@server/utils/llm/llmRequestPipeline";

const BodySchema = z.object({
  base64: z.string().min(1).max(20_000_000),
  format: z.enum(["wav", "mp3"]),
  language: z.string().trim().max(40).optional(),
});

export default defineEventHandler(async (event) => {
  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success)
    throw Errors.badRequest("Invalid audio", body.error.issues);
  const ctx = await llmRequestPipeline(event, {
    quotaPort: new PrismaQuotaPort(),
    task: "transcription",
    inputText: `audio:${body.data.base64.length}`,
    rateLimitMax: 10,
  });
  try {
    const generation = await ctx.ai.transcribeAudio(body.data);
    const finalized = await ctx.finalize({ generation });
    return success({
      transcript: generation.value,
      model: finalized.actualModel,
      subscription: finalized.updatedQuota
        ? toSubscriptionSnapshot(finalized.updatedQuota)
        : undefined,
    });
  } catch (error) {
    await ctx.fail(error);
    throwMappedOpenRouterError(error);
  }
});
