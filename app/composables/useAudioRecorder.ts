/**
 * useAudioRecorder
 *
 * Reusable composable for recording audio from the microphone.
 * Shared by SpeechRecorder (materials) and QuickCaptureModal (language capture).
 *
 * Features:
 *  - High-quality audio constraints (echo cancellation, noise suppression, AGC)
 *  - Best MIME-type detection across browsers (webm/opus → mp4 → ogg/opus → webm → default)
 *  - Optional max-duration timer with live second count
 *  - Exposes `startRecording`, `stopRecording`, `cleanup` (force-stop on modal close)
 *  - Calls `onRecorded(blob, mimeType)` once the recorder stops with audio data
 */

export interface UseAudioRecorderOptions {
  /** Max recording duration in seconds. 0 = no limit. Default: 60. */
  maxDuration?: number
  /** Called when recording stops and audio data is available. */
  onRecorded: (blob: Blob, mimeType: string) => void | Promise<void>
}

export function useAudioRecorder(options: UseAudioRecorderOptions) {
  const maxDuration = options.maxDuration ?? 60

  const isRecording = ref(false)
  const recordingSeconds = ref(0)
  const error = ref<string | null>(null)

  let _mediaRecorder: MediaRecorder | null = null
  let _chunks: Blob[] = []
  let _timer: ReturnType<typeof setInterval> | null = null

  // ── Best MIME-type detection (same as SpeechRecorder) ─────────────────────
  function _bestMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/webm',
      '',
    ]
    for (const type of candidates) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) return type
    }
    return ''
  }

  // ── Timer helpers ──────────────────────────────────────────────────────────
  function _clearTimer() {
    if (_timer !== null) {
      clearInterval(_timer)
      _timer = null
    }
  }

  function _startTimer() {
    recordingSeconds.value = 0
    if (maxDuration <= 0) return
    _timer = setInterval(() => {
      recordingSeconds.value++
      if (recordingSeconds.value >= maxDuration) stopRecording()
    }, 1000)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async function startRecording(): Promise<void> {
    if (isRecording.value) return
    error.value = null
    _chunks = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const mimeType = _bestMimeType()
      _mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      _mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) _chunks.push(e.data)
      }

      _mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        _clearTimer()
        isRecording.value = false

        if (_chunks.length === 0) {
          _mediaRecorder = null
          return
        }

        const blob = new Blob(_chunks, { type: mimeType || 'audio/webm' })
        _mediaRecorder = null
        try {
          await options.onRecorded(blob, mimeType || 'audio/webm')
        } catch (e) {
          console.warn('[useAudioRecorder] onRecorded error', e)
        }
      }

      _mediaRecorder.start()
      isRecording.value = true
      _startTimer()
    } catch (err: any) {
      isRecording.value = false
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        error.value = 'Microphone permission denied. Please allow microphone access to record.'
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        error.value = 'No microphone found on this device.'
      } else {
        error.value = `Could not start recording: ${err?.message ?? 'unknown error'}`
      }
    }
  }

  function stopRecording(): void {
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
      _mediaRecorder.stop()
    }
    _clearTimer()
    // isRecording is set to false inside onstop
  }

  /** Force-stop everything — call on component unmount or modal close. */
  function cleanup(): void {
    stopRecording()
    _chunks = []
    isRecording.value = false
    recordingSeconds.value = 0
    error.value = null
  }

  onBeforeUnmount(() => cleanup())

  return {
    isRecording: readonly(isRecording),
    recordingSeconds: readonly(recordingSeconds),
    error: readonly(error),
    startRecording,
    stopRecording,
    cleanup,
  }
}
