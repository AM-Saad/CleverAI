import type { CaptureWordResponse, GenerateStoryResponse, UserLanguagePreferences } from "@shared/utils/language.contract";

type CaptureState = "idle" | "loading" | "result" | "story-loading" | "story-ready";

export function useLanguageCapture() {
  const { $api } = useNuxtApp();

  // State machine
  const state = ref<CaptureState>("idle");

  // Capture result
  const captureResult = ref<CaptureWordResponse | null>(null);
  const storyResult = ref<GenerateStoryResponse | null>(null);

  // Consent flow
  const showConsentSheet = ref(false);
  const pendingCapture = ref<Parameters<typeof captureWord>[0] | null>(null);
  const preferences = ref<UserLanguagePreferences | null>(null);

  // Shown when user has no credits left and tries to generate a story — opens global wallet
  const creditsStore = useCreditsStore();

  // Operations
  const captureOperation = useOperation<CaptureWordResponse>();
  const storyOperation = useOperation<GenerateStoryResponse>();
  const prefsOperation = useOperation<UserLanguagePreferences>();

  // Load preferences once
  const loadPreferences = async () => {
    if (preferences.value) return preferences.value;
    const result = await prefsOperation.execute(() => $api.language.getPreferences());
    if (result) preferences.value = result;
    return result;
  };

  const captureWord = async (
    word: string,
    options?: {
      sourceContext?: string;
      sourceLang?: string;
      targetLang?: string;
      sourceType?: "note" | "material" | "external" | "manual";
      sourceRefId?: string;
    }
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
      sourceType?: "note" | "material" | "external" | "manual";
      sourceRefId?: string;
    }
  ) => {
    state.value = "loading";
    captureResult.value = null;
    storyResult.value = null;

    const result = await captureOperation.execute(() =>
      $api.language.captureWord({
        word,
        sourceContext: options?.sourceContext,
        sourceLang: options?.sourceLang ?? "auto",
        targetLang: options?.targetLang ?? preferences.value?.targetLanguage ?? "en",
        sourceType: options?.sourceType ?? "manual",
        sourceRefId: options?.sourceRefId,
      })
    );

    if (result) {
      captureResult.value = result;
      state.value = "result";
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
    if (preferences.value) preferences.value.showConsent = false;

    const pending = pendingCapture.value as any;
    pendingCapture.value = null;
    if (pending) {
      await _doCapture(pending[0], pending[1]);
    }
  };

  // Called from ConsentSheet "Just translate" — translates but does NOT save
  const declineCapture = async () => {
    showConsentSheet.value = false;

    // Still update prefs so consent doesn't show again
    await $api.language.updatePreferences({ showConsent: false });
    if (preferences.value) preferences.value.showConsent = false;

    const pending = pendingCapture.value as any;
    pendingCapture.value = null;
    if (pending) {
      // Capture with "external" type so word is saved but not enrolled
      await _doCapture(pending[0], pending[1]);
    }
    pendingCapture.value = null;
  };

  const generateStory = async (wordId: string, relatedWords: string[] = []) => {
    if (!wordId) return null;

    // Gate on local balance. Do NOT spend here — the server spends atomically
    // inside incrementGenerationCount. A frontend pre-spend double-bills.
    if (!creditsStore.hasCredits && useSubscriptionStore().isQuotaExceeded) {
      creditsStore.openWallet();
      return null;
    }

    state.value = "story-loading";

    const result = await storyOperation.execute(() =>
      $api.language.generateStory({ wordId, relatedWords })
    ).catch((err: any) => {
      // Server returns 402 when free quota and credits are both exhausted
      if (err?.statusCode === 402 || err?.data?.statusCode === 402) {
        creditsStore.openWallet();
        state.value = "result";
        return null;
      }
      throw err;
    });

    if (result) {
      storyResult.value = result;
      state.value = "story-ready";
      // Update the global subscription display if the server returned quota info
      if (result.subscription) {
        useSubscriptionStore().updateFromData({ subscription: result.subscription });
      }
    } else {
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
