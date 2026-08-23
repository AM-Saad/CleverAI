type SummaryOptions = { maxLength?: number; minLength?: number };

export function useTextSummarization(_options?: { immediate?: boolean }) {
  const isSummarizing = ref(false);
  const currentSummary = ref<string | null>(null);
  const summaryError = ref<Error | null>(null);

  async function summarize(
    text: string,
    _options?: SummaryOptions,
  ): Promise<string> {
    if (!text.trim()) throw new Error("No text provided to summarize");
    isSummarizing.value = true;
    currentSummary.value = null;
    summaryError.value = null;
    try {
      const response = await $fetch<{ data: { summary: string } }>(
        "/api/ai/summarize",
        { method: "POST", body: { text } },
      );
      currentSummary.value = response.data.summary;
      return response.data.summary;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      summaryError.value = error;
      throw error;
    } finally {
      isSummarizing.value = false;
    }
  }

  function startSummarization(text: string, options?: SummaryOptions) {
    void summarize(text, options);
  }

  return {
    summarize,
    startSummarization,
    currentSummary: readonly(currentSummary),
    isSummarizing: readonly(isSummarizing),
    error: readonly(summaryError),
    summaryError: readonly(summaryError),
    isDownloading: readonly(ref(false)),
    progress: readonly(ref(0)),
    isReady: readonly(ref(true)),
    retry: async () => undefined,
  };
}
