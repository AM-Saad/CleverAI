// app/features/materials/composables/useGenerateFromMaterial.ts
import { ref, computed, type Ref, type ComputedRef } from "vue";
import { APIError } from "~/services/FetchFactory";
import type {
  FlashcardDTO,
  GatewayGenerateResponse,
  GenerationConfig,
  MaterialGenerationCommitMode,
  QuizQuestionDTO,
} from "~/shared/utils/llm-generate.contract";

export type GenerationType = "flashcards" | "quiz";

export interface GenerationResult {
  type: GenerationType;
  flashcards?: FlashcardDTO[];
  quiz?: QuizQuestionDTO[];
}

export interface MaterialGenerationState {
  hasFlashcards: boolean;
  hasQuestions: boolean;
  flashcardsCount: number;
  questionsCount: number;
}

/**
 * Composable for generating flashcards or questions from a specific material.
 * Supports regeneration with confirmation dialog.
 */
export function useGenerateFromMaterial(
  materialId: Ref<string> | ComputedRef<string>,
) {
  const { $api } = useNuxtApp();
  const toast = useToast();

  // Generation state
  const generating = ref(false);
  const preparing = ref(false);
  const generationType = ref<GenerationType | null>(null);
  const genError = ref<string | null>(null);
  const lastResult = ref<GenerationResult | null>(null);
  const generationMode = ref<MaterialGenerationCommitMode>("append");

  // Confirmation dialog state
  const showConfirmDialog = ref(false);
  const pendingGenerationType = ref<GenerationType | null>(null);
  const pendingGenerationConfig = ref<GenerationConfig | undefined>();
  const existingCounts = ref<MaterialGenerationState>({
    hasFlashcards: false,
    hasQuestions: false,
    flashcardsCount: 0,
    questionsCount: 0,
  });

  // Subscription info
  const { subscriptionInfo, isQuotaExceeded, updateFromData, handleApiError } =
    useSubscriptionStore();

  const creditsStore = useCreditsStore();

  /**
   * Check if material already has generated content
   */
  async function checkExistingContent(): Promise<MaterialGenerationState> {
    const response = await $api.materials.getGeneratedContent(materialId.value);
    if (!response.success) {
      throw response.error;
    }

    const state: MaterialGenerationState = {
      hasFlashcards: response.data.flashcardsCount > 0,
      hasQuestions: response.data.questionsCount > 0,
      flashcardsCount: response.data.flashcardsCount,
      questionsCount: response.data.questionsCount,
    };
    existingCounts.value = state;
    return state;
  }

  /**
   * Start generation - checks for existing content and shows confirmation if needed
   */
  async function startGenerate(
    type: GenerationType,
    config?: GenerationConfig,
  ) {
    genError.value = null;
    pendingGenerationType.value = type;
    pendingGenerationConfig.value = config;

    // Gate on local balance (server is authoritative — it will also block and spend).
    // We do NOT call the spend endpoint here; that would double-deduct credits
    // because the server's incrementGenerationCount already spends when needed.
    if (!creditsStore.hasCredits && isQuotaExceeded.value) {
      creditsStore.openWallet();
      pendingGenerationType.value = null;
      return;
    }

    preparing.value = true;
    try {
      const existing = await checkExistingContent();
      const hasExisting =
        type === "flashcards" ? existing.hasFlashcards : existing.hasQuestions;

      if (hasExisting) {
        showConfirmDialog.value = true;
        return;
      }

      generationMode.value = "append";
      await executeGeneration(type, config);
    } catch (err) {
      genError.value =
        err instanceof APIError
          ? err.message
          : "Couldn't check existing study items. Please try again.";
      pendingGenerationType.value = null;
    } finally {
      preparing.value = false;
    }
  }

  /**
   * Confirm regeneration from dialog
   */
  async function confirmRegenerate(replace: boolean) {
    showConfirmDialog.value = false;
    if (pendingGenerationType.value) {
      generationMode.value = replace ? "replace" : "append";
      await executeGeneration(
        pendingGenerationType.value,
        pendingGenerationConfig.value,
      );
    }
  }

  /**
   * Cancel regeneration from dialog
   */
  function cancelRegenerate() {
    showConfirmDialog.value = false;
    pendingGenerationType.value = null;
    pendingGenerationConfig.value = undefined;
  }

  /**
   * Execute the actual generation
   */
  async function executeGeneration(
    type: GenerationType,
    config?: GenerationConfig,
  ) {
    genError.value = null;
    generating.value = true;
    generationType.value = type;

    try {
      // For generating with just materialId (if text is not available yet)
      let text = "";
      try {
        const materialResponse = await $api.materials.getMaterial(
          materialId.value,
        );
        if (materialResponse.success && materialResponse.data) {
          text = materialResponse.data.content?.trim() || "";
        }
      } catch (e) {
        // Fallback or allowed failure for large/deferred reads
      }

      // Call generation API
      let result: GatewayGenerateResponse;

      try {
        if (type === "flashcards") {
          result = await $api.gateway.generateFlashcards(text, {
            materialId: materialId.value,
            save: false,
            generationConfig: config,
          });
        } else {
          result = await $api.gateway.generateQuiz(text, {
            materialId: materialId.value,
            save: false,
            generationConfig: config,
          });
        }
      } catch (apiErr: any) {
        // Server returns 402 when free quota is exhausted AND creditBalance = 0
        if (
          apiErr?.status === 402 ||
          apiErr?.statusCode === 402 ||
          apiErr?.data?.statusCode === 402
        ) {
          creditsStore.openWallet();
          return;
        }
        throw apiErr;
      }

      // Update subscription info from response
      if (result.subscription) {
        updateFromData({ subscription: result.subscription });
      }

      // Build result
      lastResult.value = {
        type,
        ...(type === "flashcards" && "flashcards" in result
          ? { flashcards: result.flashcards }
          : {}),
        ...(type === "quiz" && "quiz" in result ? { quiz: result.quiz } : {}),
      };

      const count =
        type === "flashcards" && "flashcards" in result
          ? result.flashcards.length
          : type === "quiz" && "quiz" in result
            ? result.quiz.length
            : 0;
      const itemType = type === "flashcards" ? "flashcards" : "questions";

      toast.add({
        title: "Draft ready",
        description: `Review ${count} ${itemType} before adding them.`,
        color: "success",
      });

      // Show low quota warning if needed
      if (
        subscriptionInfo.value.tier === "FREE" &&
        subscriptionInfo.value.remaining <= 3
      ) {
        toast.add({
          title: "Free Tier Limit",
          description: `You have ${subscriptionInfo.value.remaining} generations left.`,
          color: "warning",
        });
      }
    } catch (err) {
      handleApiError(err);
      genError.value =
        err instanceof APIError
          ? err.message
          : "Generation failed. Please try again.";
      lastResult.value = null;
    } finally {
      generating.value = false;
      generationType.value = null;
      pendingGenerationType.value = null;
      pendingGenerationConfig.value = undefined;
    }
  }

  // Computed helpers
  const isGeneratingFlashcards = computed(
    () => generating.value && generationType.value === "flashcards",
  );

  const isGeneratingQuiz = computed(
    () => generating.value && generationType.value === "quiz",
  );

  const rateLimitRemaining = computed(() => subscriptionInfo.value.remaining);

  return {
    // State
    generating,
    preparing,
    generationType,
    genError,
    lastResult,
    generationMode,

    // Confirmation dialog
    showConfirmDialog,
    pendingGenerationType,
    existingCounts,

    // Methods
    startGenerate,
    confirmRegenerate,
    cancelRegenerate,
    checkExistingContent,

    // Computed
    isGeneratingFlashcards,
    isGeneratingQuiz,
    rateLimitRemaining,

    // Subscription
    subscriptionInfo,
    isQuotaExceeded,
  };
}
