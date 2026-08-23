function encodeWavBase64(audio: Float32Array, sampleRate = 16_000) {
  const buffer = new ArrayBuffer(44 + audio.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + audio.length * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, audio.length * 2, true);
  for (let index = 0; index < audio.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, audio[index] ?? 0));
    view.setInt16(
      44 + index * 2,
      sample * (sample < 0 ? 0x8000 : 0x7fff),
      true,
    );
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function useSpeechToText() {
  const isTranscribing = ref(false);
  const currentTranscript = ref<string | null>(null);
  const transcriptionError = ref<Error | null>(null);

  async function transcribe(
    audioData: Float32Array,
    options?: { language?: string },
  ): Promise<string> {
    if (!audioData.length) throw new Error("No audio provided to transcribe");
    isTranscribing.value = true;
    transcriptionError.value = null;
    try {
      const response = await $fetch<{ data: { transcript: string } }>(
        "/api/ai/transcribe",
        {
          method: "POST",
          body: {
            base64: encodeWavBase64(audioData),
            format: "wav",
            language: options?.language,
          },
        },
      );
      currentTranscript.value = response.data.transcript;
      return response.data.transcript;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      transcriptionError.value = error;
      throw error;
    } finally {
      isTranscribing.value = false;
    }
  }

  return {
    transcribe,
    startTranscribing: (audio: Float32Array, options?: { language?: string }) =>
      void transcribe(audio, options),
    currentTranscript: readonly(currentTranscript),
    isTranscribing: readonly(isTranscribing),
    error: readonly(transcriptionError),
    transcriptionError: readonly(transcriptionError),
    retry: async () => undefined,
  };
}
