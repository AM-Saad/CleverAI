import { z } from "zod";
import { success, Errors } from "@server/utils/error";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import { toSubscriptionSnapshot } from "@server/modules/subscription/infrastructure/http/quotaHttp";
import {
  llmRequestPipeline,
  throwMappedOpenRouterError,
} from "@server/utils/llm/llmRequestPipeline";

const BodySchema = z.object({
  imageDataUrl: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/(?:png|jpeg|webp);base64,/),
});

export default defineEventHandler(async (event) => {
  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success)
    throw Errors.badRequest("Invalid math image", body.error.issues);
  const ctx = await llmRequestPipeline(event, {
    quotaPort: new PrismaQuotaPort(),
    task: "math_recognition",
    inputText: `image:${body.data.imageDataUrl.length}`,
    rateLimitMax: 10,
  });
  try {
    const generation = await ctx.ai.recognizeMath(body.data.imageDataUrl);
    const finalized = await ctx.finalize({ generation });
    return success({
      latex: generation.value,
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
