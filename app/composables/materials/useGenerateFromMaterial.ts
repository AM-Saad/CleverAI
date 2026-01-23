// app/composables/materials/useGenerateFromMaterial.ts
import { ref, computed, watch, type Ref, type ComputedRef } from "vue";
import { APIError } from "~/services/FetchFactory";
import type { GatewayGenerateResponse } from "~/shared/utils/llm-generate.contract";

export type GenerationType = "flashcards" | "quiz";

export interface GenerationResult {
  type: GenerationType;
  savedCount?: number;
  deletedCount?: number;
  deletedReviewsCount?: number;
  flashcards?: Array<{ front: string; back: string }>;
  quiz?: Array<{ question: string; choices: string[]; answerIndex: number }>;
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
  materialId: Ref<string> | ComputedRef<string>
) {
  const { $api } = useNuxtApp();
  const toast = useToast();

  // Generation state
  const generating = ref(false);
  const generationType = ref<GenerationType | null>(null);
  const genError = ref<string | null>(null);
  const lastResult = ref<GenerationResult | null>(null);

  // Confirmation dialog state
  const showConfirmDialog = ref(false);
  const pendingGenerationType = ref<GenerationType | null>(null);
  const existingCounts = ref<MaterialGenerationState>({
    hasFlashcards: false,
    hasQuestions: false,
    flashcardsCount: 0,
    questionsCount: 0,
  });

  // Subscription info
  const { subscriptionInfo, isQuotaExceeded, updateFromData, handleApiError } =
    useSubscriptionStore();

  /**
   * Check if material already has generated content
   */
  async function checkExistingContent(): Promise<MaterialGenerationState> {
    try {
      const response = await $api.materials.getGeneratedContent(
        materialId.value
      );

      if (response.success && response.data) {
        const state: MaterialGenerationState = {
          hasFlashcards: (response.data.flashcardsCount || 0) > 0,
          hasQuestions: (response.data.questionsCount || 0) > 0,
          flashcardsCount: response.data.flashcardsCount || 0,
          questionsCount: response.data.questionsCount || 0,
        };
        existingCounts.value = state;
        return state;
      }
    } catch (err) {
      console.error("Failed to check existing content:", err);
    }

    return {
      hasFlashcards: false,
      hasQuestions: false,
      flashcardsCount: 0,
      questionsCount: 0,
    };
  }

  /**
   * Start generation - checks for existing content and shows confirmation if needed
   */
  async function startGenerate(type: GenerationType) {
    genError.value = null;
    pendingGenerationType.value = type;

    // Check for existing content
    const existing = await checkExistingContent();

    const hasExisting =
      type === "flashcards" ? existing.hasFlashcards : existing.hasQuestions;

    if (hasExisting) {
      // Show confirmation dialog
      showConfirmDialog.value = true;
    } else {
      // No existing content, proceed directly
      await executeGeneration(type);
    }
  }

  /**
   * Confirm regeneration from dialog
   */
  async function confirmRegenerate(replace: boolean) {
    showConfirmDialog.value = false;
    if (pendingGenerationType.value) {
      await executeGeneration(pendingGenerationType.value, replace);
    }
  }

  /**
   * Cancel regeneration from dialog
   */
  function cancelRegenerate() {
    showConfirmDialog.value = false;
    pendingGenerationType.value = null;
  }

  /**
   * Execute the actual generation
   */
  async function executeGeneration(type: GenerationType, replace = false) {
    genError.value = null;
    generating.value = true;
    generationType.value = type;

    try {
      // Fetch material content
      const materialResponse = await $api.materials.getMaterial(
        materialId.value
      );

      if (!materialResponse.success || !materialResponse.data) {
        throw new Error("Failed to load material content");
      }

      const material = materialResponse.data;
      const text = material.content?.trim();

      if (!text) {
        genError.value =
          "This material has no content. Please add content first.";
        return;
      }

      // Call generation API
      let result: GatewayGenerateResponse;

      if (type === "flashcards") {
        result = await $api.gateway.generateFlashcards(text, {
          materialId: materialId.value,
          save: true,
          replace,
        });
      } else {
        result = await $api.gateway.generateQuiz(text, {
          materialId: materialId.value,
          save: true,
          replace,
        });
      }

      // Update subscription info from response
      if (result.subscription) {
        updateFromData({ subscription: result.subscription });
      }

      // Build result
      lastResult.value = {
        type,
        savedCount: result.savedCount,
        deletedCount: result.deletedCount,
        deletedReviewsCount: result.deletedReviewsCount,
        ...(type === "flashcards" && "flashcards" in result
          ? { flashcards: result.flashcards }
          : {}),
        ...(type === "quiz" && "quiz" in result ? { quiz: result.quiz } : {}),
      };

      // Show success toast
      const itemType = type === "flashcards" ? "flashcards" : "questions";
      let message = `Generated ${result.savedCount || 0} ${itemType}`;

      if (result.deletedCount && result.deletedCount > 0) {
        message += ` (replaced ${result.deletedCount} old ${itemType}`;
        if (result.deletedReviewsCount && result.deletedReviewsCount > 0) {
          message += `, ${result.deletedReviewsCount} review${result.deletedReviewsCount > 1 ? "s" : ""} removed`;
        }
        message += ")";
      }

      toast.add({
        title: "Generation Complete",
        description: message,
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
    }
  }

  // Computed helpers
  const isGeneratingFlashcards = computed(
    () => generating.value && generationType.value === "flashcards"
  );

  const isGeneratingQuiz = computed(
    () => generating.value && generationType.value === "quiz"
  );

  const rateLimitRemaining = computed(() => subscriptionInfo.value.remaining);

  return {
    // State
    generating,
    generationType,
    genError,
    lastResult,

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
