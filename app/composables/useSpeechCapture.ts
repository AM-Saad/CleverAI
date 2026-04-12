/**
 * useSpeechCapture
 *
 * Primary: Web Speech API (SpeechRecognition) — instant, streaming, online-only.
 * Fallback: useAudioRecorder + Whisper ONNX worker — private, offline-capable.
 *
 * Fallback is triggered when:
 *  1. Browser doesn't expose SpeechRecognition / webkitSpeechRecognition (Firefox, etc.)
 *  2. navigator.onLine === false at the moment start() is called
 *  3. SpeechRecognition fires a fatal error:
 *     - 'not-allowed'       → mic permission denied
 *     - 'service-not-allowed' → blocked by browser/device policy (e.g. HTTP page, managed device)
 *     - 'network'           → vendor server unreachable mid-stream
 *     - 'audio-capture'     → no microphone hardware found
 *
 * Non-fatal errors ('no-speech', 'aborted') simply reset the listening state —
 * the user can tap mic again; they do NOT trigger fallback.
 *
 * Once the fallback is triggered it stays active for the lifetime of the
 * composable instance (single modal open). A fresh mount re-probes SpeechRecognition.
 */
import { useAudioRecorder } from '~/composables/useAudioRecorder'
import { useSpeachToText } from '~/composables/ai/useSpeachToText'

export interface UseSpeechCaptureOptions {
  /** BCP-47 language tag passed to SpeechRecognition. Default: navigator.language */
  lang?: string
  /** Max recording duration (seconds) used only in Whisper fallback. Default: 15 */
  maxDuration?: number
  /** Called with the final recognised transcript from either path. */
  onResult: (transcript: string) => void
}

export function useSpeechCapture(options: UseSpeechCaptureOptions) {
  const lang = options.lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  const maxDuration = options.maxDuration ?? 15

  const isListening = ref(false)   // mic is open (streaming or recording)
  const isProcessing = ref(false)  // Whisper inference in-flight (fallback only)
  const usingFallback = ref(false) // whether this session uses the Whisper path
  const interimTranscript = ref('') // live partial text (Web Speech only)
  const error = ref<string | null>(null)
  const recordingSeconds = ref(0)

  // Once set true, stays true for this composable instance
  let _forceFallback = false
  let _recognition: SpeechRecognition | null = null

  // ── Fallback path ──────────────────────────────────────────────────────────
  const { transcribe: _transcribe } = useSpeachToText()

  const {
    isRecording,
    recordingSeconds: _recSeconds,
    error: recorderError,
    startRecording,
    stopRecording,
    cleanup: _cleanupRecorder,
  } = useAudioRecorder({
    maxDuration,
    async onRecorded(blob) {
      isListening.value = false
      isProcessing.value = true
      try {
        const ab = await blob.arrayBuffer()
        const ctx = new AudioContext({ sampleRate: 16000 })
        const decoded = await ctx.decodeAudioData(ab)
        const transcript = await _transcribe(decoded.getChannelData(0))
        if (transcript) options.onResult(transcript.trim())
      } catch { /* non-critical — Whisper failure is silent */ }
      isProcessing.value = false
    },
  })

  // Keep public recordingSeconds in sync with the fallback recorder
  watch(_recSeconds, (v) => { recordingSeconds.value = v })
  watch(isRecording, (v) => { if (usingFallback.value) isListening.value = v })
  watch(recorderError, (v) => { if (v) error.value = v })

  // ── Capability check ───────────────────────────────────────────────────────
  function _speechRecognitionAvailable() {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }

  function _shouldUseFallback(): boolean {
    if (_forceFallback) return true
    if (!_speechRecognitionAvailable()) return true
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true
    return false
  }

  // ── Web Speech API path ────────────────────────────────────────────────────
  function _startWebSpeech() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: typeof SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

    console.log("Starting Web Speech API with lang =", lang)
    _recognition = new SR()
    console.log("SpeechRecognition instance created:", _recognition)
    _recognition.lang = lang
    _recognition.continuous = false
    _recognition.interimResults = true
    _recognition.maxAlternatives = 1

    _recognition.onstart = () => {
      isListening.value = true
      error.value = null
    }

    _recognition.onresult = (e) => {
      let interim = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (!result) continue
        if (result.isFinal) {
          finalText += result[0]?.transcript ?? ''
        } else {
          interim += result[0]?.transcript ?? ''
        }
      }
      if (interim) interimTranscript.value = interim.trim()
      if (finalText) {
        interimTranscript.value = ''
        options.onResult(finalText.trim())
      }
    }

    _recognition.onerror = (e) => {
      isListening.value = false
      _recognition = null

      const FATAL_ERRORS = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture'] as const
      type FatalError = typeof FATAL_ERRORS[number]

      if ((FATAL_ERRORS as ReadonlyArray<string>).includes(e.error)) {
        _forceFallback = true
        usingFallback.value = true

        if (e.error === 'not-allowed') {
          error.value = 'Microphone permission denied.'
        } else if (e.error === 'audio-capture') {
          error.value = 'No microphone found on this device.'
        } else if (e.error === 'network') {
          error.value = 'Network unavailable — switched to local AI.'
        } else if (e.error === 'service-not-allowed') {
          error.value = 'Speech service blocked — switched to local AI.'
        }
      }
      // 'no-speech' / 'aborted' are non-fatal — just reset, user can tap again
    }

    _recognition.onend = () => {
      isListening.value = false
      interimTranscript.value = ''
      _recognition = null
    }

    try {
      _recognition.start()
    } catch (err: any) {
      // InvalidStateError if already started — safe to ignore
      isListening.value = false
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function start() {
    if (isListening.value || isProcessing.value) return
    error.value = null

    if (_shouldUseFallback()) {
      usingFallback.value = true
      startRecording()
    } else {
      usingFallback.value = false
      _startWebSpeech()
    }
  }

  function stop() {
    if (_recognition) {
      try { _recognition.stop() } catch { }
      _recognition = null
    }
    interimTranscript.value = ''
    stopRecording()
    isListening.value = false
  }

  function cleanup() {
    stop()
    _cleanupRecorder()
    isProcessing.value = false
    error.value = null
  }

  onBeforeUnmount(() => cleanup())

  return {
    /** Mic is actively open (streaming speech or recording audio) */
    isListening: readonly(isListening),
    /** Whisper model is running inference (fallback path only) */
    isProcessing: readonly(isProcessing),
    /** True when Whisper fallback is in use instead of Web Speech API */
    usingFallback: readonly(usingFallback),
    /** Live partial transcript while speaking (Web Speech only, empty string in fallback) */
    interimTranscript: readonly(interimTranscript),
    /** Elapsed recording seconds — only meaningful in fallback path */
    recordingSeconds: readonly(recordingSeconds),
    /** Human-readable error from either path */
    error: readonly(error),
    start,
    stop,
    cleanup,
  }
}
