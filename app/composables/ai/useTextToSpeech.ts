export function useTextToSpeech() {
  const isSynthesizing = ref(false);
  const synthesisError = ref<Error | null>(null);

  async function synthesize(text: string, lang = "en"): Promise<string> {
    if (!text.trim()) throw new Error("No text provided to synthesize");
    if (!import.meta.client || !("speechSynthesis" in window)) {
      throw new Error("Browser speech synthesis is not available");
    }
    isSynthesizing.value = true;
    synthesisError.value = null;
    try {
      await new Promise<void>((resolve, reject) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === "auto" ? "en" : lang;
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error("Speech synthesis failed"));
        window.speechSynthesis.speak(utterance);
      });
      return "";
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      synthesisError.value = error;
      throw error;
    } finally {
      isSynthesizing.value = false;
    }
  }

  return {
    synthesize,
    isSynthesizing: readonly(isSynthesizing),
    synthesisError: readonly(synthesisError),
    error: readonly(synthesisError),
    audioUrl: readonly(ref<string | null>(null)),
  };
}
