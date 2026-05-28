import type {
  CaptureWordResponse,
  GenerateStoryResponse,
  SupportedLanguageCode,
  UserLanguagePreferences,
} from "@shared/utils/language.contract";
import { useLanguageLearningRuntime } from "./languageLearningRuntime";

type CaptureState =
  | "idle"
  | "loading"
  | "result"
  | "story-loading"
  | "story-ready";

export function useLanguageCapture() {
  const { $api } = useNuxtApp();
  const creditsStore = useCreditsStore();
  const subscriptionStore = useSubscriptionStore();
  const runtime = useLanguageLearningRuntime();

  // State machine
  const state = ref<CaptureState>("idle");

  // Capture result
  const captureResult = ref<CaptureWordResponse | null>(null);
  const storyResult = ref<GenerateStoryResponse | null>(null);

  // Consent flow
  const showConsentSheet = ref(false);
  const pendingCapture = ref<
    | [
        string,
        (
          | {
              sourceContext?: string;
              sourceLang?: string;
              targetLang?: string;
              includeTranslation?: boolean;
              translateOnly?: boolean;
              sourceType?: "note" | "material" | "external" | "manual";
              sourceRefId?: string;
              forceRetranslate?: boolean;
            }
          | undefined
        ),
      ]
    | null
  >(null);
  const preferences = runtime.preferences;

  // Operations
  const captureOperation = useOperation<CaptureWordResponse>();
  const storyOperation = useOperation<GenerateStoryResponse>();
  const prefsOperation = useOperation<UserLanguagePreferences>();

  // Load preferences once
  const loadPreferences = async () => {
    if (preferences.value) return preferences.value;
    const result = await prefsOperation.execute(() =>
      $api.language.getPreferences(),
    );
    if (result) runtime.setPreferences(result);
    return result;
  };

  const captureWord = async (
    word: string,
    options?: {
      sourceContext?: string;
      sourceLang?: string;
      targetLang?: string;
      includeTranslation?: boolean;
      translateOnly?: boolean;
      sourceType?: "note" | "material" | "external" | "manual";
      sourceRefId?: string;
      forceRetranslate?: boolean;
    },
  ) => {
    const prefs = await loadPreferences();

    // First time: show consent sheet
    if (prefs && prefs.showConsent) {
      pendingCapture.value = [word, options] as any;
      showConsentSheet.value = true;
      return null;
    }

    return _doCapture(word, options);
  };

  const _doCapture = async (
    word: string,
    options?: {
      sourceContext?: string;
      sourceLang?: string;
      targetLang?: string;
      includeTranslation?: boolean;
      translateOnly?: boolean;
      sourceType?: "note" | "material" | "external" | "manual";
      sourceRefId?: string;
      forceRetranslate?: boolean;
    },
  ) => {
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
      captureResult.value = result;
      runtime.setLatestCapture(result);
      state.value = "result";
      if (result.saved) runtime.invalidateWords();
    } else {
      state.value = "idle";
    }

    return result;
  };

  // Called from ConsentSheet "Add to Deck" — sets showConsent false then proceeds
  const confirmCapture = async () => {
    showConsentSheet.value = false;

    // Update preferences to hide consent next time
    await $api.language.updatePreferences({ showConsent: false });
    if (preferences.value) {
      runtime.setPreferences({ ...preferences.value, showConsent: false });
    }

    const pending = pendingCapture.value as any;
    pendingCapture.value = null;
    if (pending) {
      await _doCapture(pending[0], {
        ...(pending[1] ?? {}),
        translateOnly: false,
      });
    }
  };

  // Called from ConsentSheet "Just translate" — translates without saving a new word
  const declineCapture = async () => {
    showConsentSheet.value = false;

    // Still update prefs so consent doesn't show again
    await $api.language.updatePreferences({ showConsent: false });
    if (preferences.value) {
      runtime.setPreferences({ ...preferences.value, showConsent: false });
    }

    const pending = pendingCapture.value as any;
    pendingCapture.value = null;
    if (pending) {
      await _doCapture(pending[0], {
        ...(pending[1] ?? {}),
        translateOnly: true,
      });
    }
    pendingCapture.value = null;
  };

  const generateStory = async (wordId: string, relatedWords: string[] = []) => {
    if (!wordId) return null;

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

    // Consent
    showConsentSheet: readonly(showConsentSheet),
    preferences: readonly(preferences),

    // Credits gate
    // (wallet opened globally via creditsStore.openWallet() — see useCreditsStore)

    // Operation state
    isCapturing: captureOperation.pending,
    captureError: captureOperation.error,
    isGeneratingStory: storyOperation.pending,
    storyError: storyOperation.error,

    // Actions
    captureWord,
    confirmCapture,
    declineCapture,
    generateStory,
    dismissResult,
    loadPreferences,
  };
}
