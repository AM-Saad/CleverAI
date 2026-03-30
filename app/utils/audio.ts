/**
 * Utility functions for audio processing.
 */

/**
 * Resamples an audio Blob or File to a 16kHz Float32Array.
 * Required by Transformers.js Whisper models which expect 16000Hz mono audio.
 */
export async function resampleAudioTo16kHz(audioBlob: Blob): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  const audioContext = new AudioContextClass({
    sampleRate: 16000,
  });

  const arrayBuffer = await audioBlob.arrayBuffer();
  // decodeAudioData automatically resamples to the AudioContext's sampleRate (16000)
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // We only need the first channel (mono) for whisper
  const float32Array = audioBuffer.getChannelData(0);
  
  // Clean up
  if (audioContext.state !== "closed") {
    await audioContext.close().catch(console.error);
  }
  
  return float32Array;
}
