import type {
  CaptureWordResponse,
  GenerateStoryResponse,
  SupportedLanguageCode,
} from "@shared/utils/language.contract";
import { useLanguageLearningRuntime } from "./languageLearningRuntime";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

type CaptureState =
  | "idle"
  | "loading"
  | "saving"
  | "result"
  | "story-loading"
  | "story-ready";

type CaptureOptions = {
  sourceContext?: string;
  sourceLang?: string;
  targetLang?: string;
  includeTranslation?: boolean;
  translateOnly?: boolean;
  sourceType?: "note" | "material" | "external" | "manual";
  sourceRefId?: string;
  forceRetranslate?: boolean;
};

export function useLanguageCapture() {
  const { $api } = useNuxtApp();
  const creditsStore = useCreditsStore();
  const subscriptionStore = useSubscriptionStore();
  const runtime = useLanguageLearningRuntime();
  const offline = useOfflineRuntime();
  const toast = useToast();

  // State machine
  const state = ref<CaptureState>("idle");

  // Capture result
  const captureResult = ref<CaptureWordResponse | null>(null);
  const storyResult = ref<GenerateStoryResponse | null>(null);

  const preferences = runtime.preferences;

  // Operations
  const captureOperation = useOperation<CaptureWordResponse>();
  const saveOperation = useOperation<CaptureWordResponse>();
  const storyOperation = useOperation<GenerateStoryResponse>();
  const lastCaptureOptions = ref<CaptureOptions>();
  let capturePromise: Promise<CaptureWordResponse | null> | null = null;
  let savePromise: Promise<CaptureWordResponse | null> | null = null;

  // Load preferences once
  const loadPreferences = () => runtime.ensurePreferences();

  const captureWord = async (word: string, options?: CaptureOptions) => {
    if (!offline.isOnline.value) {
      toast.add({
        title: "Unavailable offline",
        description:
          "Capture and translation use AI and are not queued while offline.",
        color: "warning",
      });
      return null;
    }
    await loadPreferences();
    return _doCapture(word, options);
  };

  const _doCapture = async (word: string, options?: CaptureOptions) => {
    if (capturePromise) return capturePromise;
    if (!offline.isOnline.value) {
      toast.add({
        title: "Unavailable offline",
        description:
          "Capture and translation use AI and are not queued while offline.",
        color: "warning",
      });
      return null;
    }
    lastCaptureOptions.value = options;
    capturePromise = (async () => {
      state.value = "loading";
      captureResult.value = null;
      storyResult.value = null;

      const result = await captureOperation.execute(() =>
        $api.language.captureWord({
          word,
          sourceContext: options?.sourceContext,
          sourceLang: options?.sourceLang ?? "auto",
          targetLang: (options?.targetLang ??
            preferences.value?.nativeLanguage ??
            "en") as SupportedLanguageCode,
          includeTranslation: options?.includeTranslation ?? true,
          translateOnly: options?.translateOnly ?? false,
          forceRetranslate: options?.forceRetranslate ?? false,
          sourceType: options?.sourceType ?? "manual",
          sourceRefId: options?.sourceRefId,
        }),
      );

      if (result) {
        await runtime.applyServerProjection(result.projection);
        captureResult.value = result;
        runtime.setLatestCapture(result);
        state.value = "result";
        if (result.saved) runtime.invalidateWords();
      } else {
        state.value = "idle";
      }
      return result;
    })().finally(() => {
      capturePromise = null;
    });
    return capturePromise;
  };

  const saveCapture = async (
    result: CaptureWordResponse | null = captureResult.value,
  ) => {
    if (!result || result.saved) return result;
    if (savePromise) return savePromise;
    if (!result.translationId) {
      toast.add({
        title: "Translate again",
        description: "This result has no reusable translation identity.",
        color: "warning",
      });
      return null;
    }
    if (!offline.isOnline.value) {
      toast.add({
        title: "Unavailable offline",
        description: "New AI translations must be saved while online.",
        color: "warning",
      });
      return null;
    }

    savePromise = (async () => {
      state.value = "saving";
      const options = lastCaptureOptions.value;
      const saved = await saveOperation.execute(() =>
        $api.language.saveWord({
          translationId: result.translationId!,
          sourceContext: options?.sourceContext,
          sourceType: options?.sourceType ?? "manual",
          sourceRefId: options?.sourceRefId,
        }),
      );
      if (saved) {
        await runtime.applyServerProjection(saved.projection);
        captureResult.value = saved;
        runtime.setLatestCapture(saved);
        runtime.invalidateWords();
      }
      state.value = "result";
      return saved;
    })().finally(() => {
      savePromise = null;
    });
    return savePromise;
  };

  const generateStory = async (wordId: string, relatedWords: string[] = []) => {
    if (!wordId) return null;
    if (storyOperation.pending.value) return null;
    if (!offline.isOnline.value) {
      toast.add({
        title: "Unavailable offline",
        description:
          "Story generation uses AI and is not queued while offline.",
        color: "warning",
      });
      return null;
    }

    // Gate on local balance. Do NOT spend here — the server spends atomically
    // inside incrementGenerationCount. A frontend pre-spend double-bills.
    if (!creditsStore.hasCredits && subscriptionStore.isQuotaExceeded.value) {
      creditsStore.openWallet();
      return null;
    }

    state.value = "story-loading";

    const result = await storyOperation.execute(() =>
      $api.language.generateStory({ wordId, relatedWords }),
    );

    if (result) {
      await runtime.applyServerProjection(result.projection);
      storyResult.value = result;
      runtime.setLatestStory(result);
      state.value = "story-ready";
      runtime.invalidateWords();
      // Update the global subscription display if the server returned quota info
      if (result.subscription) {
        subscriptionStore.updateFromData({ subscription: result.subscription });
      }
    } else {
      const storyErrorValue = storyOperation.error.value;
      const storyDetails = storyErrorValue?.details as
        | {
            subscription?: {
              tier: string;
              generationsUsed: number;
              generationsQuota: number;
              remaining: number;
            };
            type?: string;
          }
        | undefined;

      if (storyDetails?.subscription) {
        subscriptionStore.updateFromData({
          subscription: storyDetails.subscription,
        });
      }
      if (
        storyDetails?.type === "QUOTA_EXCEEDED" ||
        storyErrorValue?.status === 402
      ) {
        creditsStore.openWallet();
      }
      state.value = "result"; // Fall back to result state on error
    }

    return result;
  };

  const dismissResult = () => {
    captureResult.value = null;
    storyResult.value = null;
    state.value = "idle";
  };

  return {
    // State machine
    state: readonly(state),

    // Results
    captureResult: readonly(captureResult),
    storyResult: readonly(storyResult),

    preferences: readonly(preferences),

    // Credits gate
    // (wallet opened globally via creditsStore.openWallet() — see useCreditsStore)

    // Operation state
    isCapturing: computed(
      () => captureOperation.pending.value || saveOperation.pending.value,
    ),
    captureError: computed(
      () => captureOperation.error.value ?? saveOperation.error.value,
    ),
    isGeneratingStory: storyOperation.pending,
    storyError: storyOperation.error,

    // Actions
    captureWord,
    saveCapture,
    generateStory,
    dismissResult,
    loadPreferences,
  };
}
