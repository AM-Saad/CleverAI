import { readBody } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { GatewayGenerateRequest } from "~/shared/utils/llm-generate.contract";
import {
  checkSemanticCache,
  setSemanticCache,
} from "@server/utils/llm/cache";
import { computeAdaptiveItemCount } from "@server/utils/llm/adaptiveCount";
import {
  injectNoteBlockMarkers,
  injectPdfPageMarkers,
  extractSourceRef,
} from "@server/utils/contextBridge";
import { llmRequestPipeline } from "@server/utils/llm/llmRequestPipeline";

type GenerationTask = "flashcards" | "quiz";

interface Flashcard {
  front: string;
  back: string;
  sourceMetadata?: {
    anchor: string;
    contextSnippet?: string;
  };
}
interface QuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
  sourceMetadata?: {
    anchor: string;
    contextSnippet?: string;
  };
}

export default defineEventHandler(async (event) => {
  const requestStartTime = Date.now();
  const prisma = event.context.prisma;

  // ─── 1. Auth ───────────────────────────────────────────────────────────
  // Auth early so material ownership checks have the user object.
  // The pipeline receives the pre-fetched user to skip a redundant DB call.
  const user = await requireRole(event, ["USER"]);

  // ─── 2. Request Parsing ────────────────────────────────────────────────
  const raw = await readBody(event);
  const parseResult = GatewayGenerateRequest.safeParse(raw);
  if (!parseResult.success) {
    throw Errors.badRequest(
      "Invalid request body",
      parseResult.error.flatten()
    );
  }
  const parsed = parseResult.data;
  const {
    task,
    workspaceId,
    materialId,
    save,
    replace,
    requiredCapability,
    text: originalText,
    generationConfig,
  } = parsed;

  // Load material content if materialId provided
  let text = originalText?.trim() || "";
  let loadedMaterial: any = null;

  if (materialId) {
    loadedMaterial = await prisma.material.findUnique({
      where: { id: materialId },
      include: { workspace: { select: { userId: true, id: true } } },
    });

    if (!loadedMaterial) {
      throw Errors.notFound("Material not found.");
    }
    if (loadedMaterial.workspace.userId !== user.id) {
      throw Errors.forbidden("You do not have access to this material.");
    }

    text = loadedMaterial.content || "";

    // Inject markers for Context Bridge based on material type
    if (loadedMaterial.type === "pdf" && loadedMaterial.metadata) {
      const pageCount = (loadedMaterial.metadata as any)?.pageCount;
      text = injectPdfPageMarkers(text, pageCount);
    } else if (loadedMaterial.type === "txt" || !loadedMaterial.type) {
      // Treat as note-like content
      text = injectNoteBlockMarkers(text);
    }
  }

  const MAX_CHARS = 100_000;
  if (text.length === 0) throw Errors.badRequest("Text is required");
  if (text.length > MAX_CHARS) throw Errors.badRequest("Text too large");

  // ==========================================
  // Workspace/Material Permission Check
  // ==========================================
  let canSave = false;
  let materialWorkspaceId: string | undefined;

  // If materialId is provided, verify ownership (already done above)
  if (save && loadedMaterial) {
    canSave = true;
    materialWorkspaceId = loadedMaterial.workspace.id;
  } else if (save && materialId) {
    const material = await prisma.material.findFirst({
      where: { id: materialId },
      include: { workspace: { select: { userId: true, id: true } } },
    });
    if (!material) {
      throw Errors.notFound("Material not found.");
    }
    if (material.workspace.userId !== user.id) {
      throw Errors.forbidden("You do not have access to this material.");
    }
    canSave = true;
    materialWorkspaceId = material.workspace.id;
  } else if (save && workspaceId) {
    const ownerWorkspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: user.id },
    });
    if (!ownerWorkspace) {
      throw Errors.forbidden("You do not have access to this workspace.");
    }
    canSave = true;
  }

  // ─── 5. Adaptive Item Count ────────────────────────────────────────────
  const tokenEstimate = estimateTokensFromText(text);
  const depth = generationConfig?.depth ?? "balanced";
  const maxItems = generationConfig?.maxItems;
  const itemCount = computeAdaptiveItemCount(tokenEstimate, depth, maxItems);

  console.info("[llm.gateway] Adaptive generation:", {
    tokenEstimate,
    depth,
    itemCount,
    textLength: text.length,
  });

  // ─── 6. Pipeline: auth + quota gate + rate-limit + model + strategy ────
  // Handles: quota enforcement, rate limiting, model selection + dev override,
  // strategy instantiation with onMeasure token capture, finalize/fail hooks.
  const ctx = await llmRequestPipeline(event, {
    task,
    inputText: text,
    estimatedOutputTokens: task === "flashcards" ? 500 : 800,
    requiredCapability,
    checkQuota: true,
    incrementQuota: true,
    user, // pre-fetched above — pipeline skips redundant requireRole call
  });

  // ─── 7. Semantic Cache Check ───────────────────────────────────────────
  const cacheCheck = await checkSemanticCache(text, task, itemCount);

  if (cacheCheck.hit && cacheCheck.value) {
    console.info("[llm.gateway] Cache hit:", {
      requestId: ctx.requestId,
      task,
      textLength: text.length,
    });

    const cached = cacheCheck.value as {
      task: GenerationTask;
      flashcards?: Flashcard[];
      quiz?: QuizQuestion[];
      modelId: string;
      provider: string;
    };

    // Pipeline checked quota but did not increment yet — do it now for this cache hit.
    const updatedQuota = await incrementGenerationCount(ctx.user.id);

    // Refresh subscription headers with post-increment values.
    event.node.res.setHeader("x-subscription-tier", updatedQuota.tier);
    event.node.res.setHeader("x-generations-used", String(updatedQuota.generationsUsed));
    event.node.res.setHeader("x-generations-quota", String(updatedQuota.generationsQuota));
    event.node.res.setHeader("x-generations-remaining", String(updatedQuota.remaining));

    return success({
      ...cached,
      savedCount: undefined,
      subscription: {
        tier: updatedQuota.tier,
        generationsUsed: updatedQuota.generationsUsed,
        generationsQuota: updatedQuota.generationsQuota,
        remaining: updatedQuota.remaining,
        creditBalance: updatedQuota.creditBalance,
      },
      requestId: ctx.requestId,
      selectedModelId: cached.modelId,
      provider: cached.provider,
      latencyMs: Date.now() - requestStartTime,
      cached: true,
      itemCount,
      tokenEstimate,
    });
  }

  // ─── 8. Generation ─────────────────────────────────────────────────────
  const effectiveWorkspaceId = materialWorkspaceId || workspaceId;
  let result: Flashcard[] | QuizQuestion[];

  try {
    if (task === "flashcards") {
      result = await ctx.strategy.generateFlashcards(text, { itemCount });
    } else {
      result = await ctx.strategy.generateQuiz(text, { itemCount });
    }

    console.info("[llm.gateway] Generation successful:", {
      requestId: ctx.requestId,
      modelId: ctx.selectedModel.modelId,
      task,
      count: result.length,
    });
  } catch (err) {
    await ctx.fail(err, effectiveWorkspaceId);
    console.error("[llm.gateway] Generation failed:", {
      requestId: ctx.requestId,
      modelId: ctx.selectedModel.modelId,
      task,
      error: err,
    });
    const message =
      err instanceof Error && /quota/i.test(err.message)
        ? "Quota exceeded. Please check your API plan/billing or try again later."
        : "Generation failed. Please try again.";
    if (/quota exceeded|rate limit|429/i.test(message)) {
      throw Errors.rateLimit(message);
    }
    throw Errors.server(message);
  }

  // ─── 9. Save to Database ────────────────────────────────────────────
  let savedCount: number | undefined;
  let deletedCount: number | undefined;
  let deletedReviewsCount: number | undefined;

  if (canSave && effectiveWorkspaceId) {
    try {
      if (task === "flashcards") {
        // Use transaction to ensure atomic delete + create
        await prisma.$transaction(async (tx) => {
          // If replacing for a specific material, delete old flashcards and their CardReviews
          if (replace && materialId) {
            // Get IDs of flashcards to be deleted for CardReview cleanup
            const oldFlashcards = await tx.flashcard.findMany({
              where: { materialId },
              select: { id: true },
            });
            const oldFlashcardIds = oldFlashcards.map((f) => f.id);

            // Delete CardReviews for these flashcards
            if (oldFlashcardIds.length > 0) {
              const reviewsDeleted = await tx.cardReview.deleteMany({
                where: {
                  cardId: { in: oldFlashcardIds },
                  resourceType: "flashcard",
                },
              });
              deletedReviewsCount = reviewsDeleted.count;
            }

            // Delete old flashcards
            const deleted = await tx.flashcard.deleteMany({
              where: { materialId },
            });
            deletedCount = deleted.count;
          }

          // Create new flashcards
          if (result.length) {
            const res = await tx.flashcard.createMany({
              data: (result as Flashcard[]).map((fc) => {
                // Extract sourceRef from sourceMetadata if available
                const sourceRef = materialId && fc.sourceMetadata
                  ? extractSourceRef(
                    fc.sourceMetadata,
                    loadedMaterial?.type === "pdf" ? "PDF" : "NOTE",
                    materialId
                  )
                  : null;

                return {
                  workspaceId: effectiveWorkspaceId,
                  materialId: materialId || null,
                  front: fc.front,
                  back: fc.back,
                  sourceRef: sourceRef as any, // JSON field
                  status: "DRAFT", // New items start as DRAFT
                };
              }),
            });
            savedCount = res.count;
          } else {
            savedCount = 0;
          }
        });
      } else {
        // Quiz/Questions
        await prisma.$transaction(async (tx) => {
          // If replacing for a specific material, delete old questions and their CardReviews
          if (replace && materialId) {
            // Get IDs of questions to be deleted for CardReview cleanup
            const oldQuestions = await tx.question.findMany({
              where: { materialId },
              select: { id: true },
            });
            const oldQuestionIds = oldQuestions.map((q) => q.id);

            // Delete CardReviews for these questions
            if (oldQuestionIds.length > 0) {
              const reviewsDeleted = await tx.cardReview.deleteMany({
                where: {
                  cardId: { in: oldQuestionIds },
                  resourceType: "question",
                },
              });
              deletedReviewsCount = reviewsDeleted.count;
            }

            // Delete old questions
            const deleted = await tx.question.deleteMany({
              where: { materialId },
            });
            deletedCount = deleted.count;
          }

          // Create new questions
          if (result.length) {
            const res = await tx.question.createMany({
              data: (result as QuizQuestion[]).map((q) => {
                // Extract sourceRef from sourceMetadata if available
                const sourceRef = materialId && q.sourceMetadata
                  ? extractSourceRef(
                    q.sourceMetadata,
                    loadedMaterial?.type === "pdf" ? "PDF" : "NOTE",
                    materialId
                  )
                  : null;

                return {
                  workspaceId: effectiveWorkspaceId,
                  materialId: materialId || null,
                  question: q.question,
                  choices: q.choices,
                  answerIndex: q.answerIndex,
                  sourceRef: sourceRef as any, // JSON field
                  status: "DRAFT", // New items start as DRAFT
                };
              }),
            });
            savedCount = res.count;
          } else {
            savedCount = 0;
          }
        });
      }
    } catch (err) {
      console.error("[llm.gateway] Failed to save to database:", {
        requestId: ctx.requestId,
        workspaceId: effectiveWorkspaceId,
        materialId,
        task,
        error: err,
      });
      // Don't throw — generation succeeded even if save failed
    }
  }

  // ─── 10. Cache Set ──────────────────────────────────────────────────────
  await setSemanticCache(
    text,
    task,
    {
      task,
      ...(task === "flashcards" ? { flashcards: result } : { quiz: result }),
      modelId: ctx.selectedModel.modelId,
      provider: ctx.selectedModel.provider,
    },
    7 * 24 * 60 * 60,
    itemCount
  );

  // ─── 11. Finalize: quota increment + latency update + LlmGatewayLog ────
  const { updatedQuota, totalLatencyMs } = await ctx.finalize({
    outputText: JSON.stringify(result),
    workspaceId: effectiveWorkspaceId,
    depth,
    itemCount,
  });

  // ─── 12. Response Headers ───────────────────────────────────────────────
  event.node.res.setHeader("x-llm-save-requested", String(!!save));
  event.node.res.setHeader("x-llm-can-save", String(canSave));
  event.node.res.setHeader("x-llm-generated-count", String(result.length));
  event.node.res.setHeader("x-llm-saved-count", String(savedCount ?? 0));
  event.node.res.setHeader("x-llm-task", task);
  event.node.res.setHeader("x-gateway-request-id", ctx.requestId);
  event.node.res.setHeader("x-gateway-model-id", ctx.selectedModel.modelId);
  event.node.res.setHeader("x-gateway-provider", ctx.selectedModel.provider);
  event.node.res.setHeader("x-gateway-latency-ms", String(totalLatencyMs));
  // Re-write subscription headers with post-increment values from finalize().
  if (updatedQuota) {
    event.node.res.setHeader("x-subscription-tier", updatedQuota.tier);
    event.node.res.setHeader("x-generations-used", String(updatedQuota.generationsUsed));
    event.node.res.setHeader("x-generations-quota", String(updatedQuota.generationsQuota));
    event.node.res.setHeader("x-generations-remaining", String(updatedQuota.remaining));
  }

  // ─── 13. Build Response ─────────────────────────────────────────────────
  const response = {
    task,
    ...(task === "flashcards" ? { flashcards: result } : { quiz: result }),
    savedCount,
    deletedCount,
    deletedReviewsCount,
    subscription: updatedQuota
      ? {
        tier: updatedQuota.tier,
        generationsUsed: updatedQuota.generationsUsed,
        generationsQuota: updatedQuota.generationsQuota,
        remaining: updatedQuota.remaining,
        creditBalance: updatedQuota.creditBalance,
      }
      : undefined,
    requestId: ctx.requestId,
    selectedModelId: ctx.selectedModel.modelId,
    provider: ctx.selectedModel.provider,
    latencyMs: totalLatencyMs,
    cached: false,
    itemCount,
    tokenEstimate,
  };

  console.info("[llm.gateway] Request completed", {
    requestId: ctx.requestId,
    modelId: ctx.selectedModel.modelId,
    task,
    generatedCount: result.length,
    savedCount,
    deletedCount,
    deletedReviewsCount,
    materialId,
    latencyMs: totalLatencyMs,
    subscription: updatedQuota,
  });

  return success(response);
});
