/** Records microphone audio and sends it to the authenticated OpenRouter path. */
import { useAudioRecorder } from "~/composables/useAudioRecorder";
import { useSpeechToText } from "~/composables/ai/useSpeechToText";

export interface UseSpeechCaptureOptions {
  /** Optional BCP-47 hint for transcription. Default: browser language. */
  lang?: string;
  /** Maximum recording duration in seconds. Default: 15. */
  maxDuration?: number;
  onResult: (transcript: string) => void;
}

export function useSpeechCapture(options: UseSpeechCaptureOptions) {
  const language =
    options.lang ??
    (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const isProcessing = ref(false);
  const error = ref<string | null>(null);
  const { transcribe } = useSpeechToText();

  const {
    isRecording,
    recordingSeconds,
    error: recorderError,
    startRecording,
    stopRecording,
    cleanup: cleanupRecorder,
  } = useAudioRecorder({
    maxDuration: options.maxDuration ?? 15,
    async onRecorded(blob) {
      isProcessing.value = true;
      let audioContext: AudioContext | undefined;
      try {
        audioContext = new AudioContext({ sampleRate: 16_000 });
        const decoded = await audioContext.decodeAudioData(
          await blob.arrayBuffer(),
        );
        const transcript = await transcribe(decoded.getChannelData(0), {
          language,
        });
        if (transcript.trim()) options.onResult(transcript.trim());
      } catch (cause) {
        error.value =
          cause instanceof Error ? cause.message : "Transcription failed";
      } finally {
        await audioContext?.close();
        isProcessing.value = false;
      }
    },
  });

  watch(recorderError, (value) => {
    if (value) error.value = value;
  });

  function start() {
    if (isRecording.value || isProcessing.value) return;
    error.value = null;
    void startRecording();
  }

  function stop() {
    stopRecording();
  }

  function cleanup() {
    cleanupRecorder();
    isProcessing.value = false;
    error.value = null;
  }

  onBeforeUnmount(cleanup);

  return {
    isListening: isRecording,
    isProcessing: readonly(isProcessing),
    // Compatibility flags: recorded OpenRouter transcription is now the only path.
    usingFallback: readonly(ref(true)),
    interimTranscript: readonly(ref("")),
    recordingSeconds,
    error: readonly(error),
    start,
    stop,
    cleanup,
  };
}
