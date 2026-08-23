import { z } from "zod";
import { success, Errors } from "@server/utils/error";
import { PrismaQuotaPort } from "@server/modules/subscription/infrastructure/PrismaQuotaPort";
import { toSubscriptionSnapshot } from "@server/modules/subscription/infrastructure/http/quotaHttp";
import {
  llmRequestPipeline,
  throwMappedOpenRouterError,
} from "@server/utils/llm/llmRequestPipeline";

const BodySchema = z.object({ text: z.string().trim().min(10).max(100_000) });

export default defineEventHandler(async (event) => {
  const body = BodySchema.safeParse(await readBody(event));
  if (!body.success) throw Errors.badRequest("Invalid text", body.error.issues);
  const ctx = await llmRequestPipeline(event, {
    quotaPort: new PrismaQuotaPort(),
    task: "summarize",
    inputText: body.data.text,
  });
  try {
    const generation = await ctx.ai.summarize(body.data.text);
    const finalized = await ctx.finalize({ generation });
    return success({
      summary: generation.value,
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
