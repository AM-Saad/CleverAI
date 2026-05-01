/**
 * usePredictionaryInput
 *
 * Thin wrapper around usePredictionary that manages a shared singleton
 * predictor instance and exposes reactive `suggestions` computed from
 * typed input.
 *
 * Usage:
 *   const { suggestions, onInput, onAccept } = usePredictionaryInput()
 *   // bind `suggestions` to <shared-autocomplete-input :suggestions>
 *   // call onInput(value) on every keystroke
 *   // call onAccept(word) when a suggestion is chosen
 */
import { usePredictionary } from '~/composables/usePredictionary'
import type { PredictionaryInstance } from '~/composables/usePredictionary'

// Singleton shared across all instances on the same page
let _predictor: PredictionaryInstance | null = null
let _initPromise: Promise<void> | null = null

export function usePredictionaryInput(options?: {
  maxSuggestions?: number
  /** Extra words to seed into the predictor (e.g. word bank vocabulary). */
  seedWords?: string[]
}) {
  const { getInstance, loadFrequencyDictionary } = usePredictionary()
  const maxSuggestions = options?.maxSuggestions ?? 6
  const suggestions = ref<string[]>([])
  const isReady = ref(false)

  // ── initialise once ──────────────────────────────────────────────────────
  const init = () => {
    if (_initPromise) return _initPromise
    _initPromise = (async () => {
      try {
        _predictor = await getInstance()
        if (!_predictor) return
        await loadFrequencyDictionary(_predictor)
        if (options?.seedWords?.length) {
          _predictor.addWords(options.seedWords)
        }
        isReady.value = true
      } catch (e) {
        // Non-fatal — autocomplete simply won't work if script blocked
        console.warn('[usePredictionaryInput] init failed', e)
      }
    })()
    return _initPromise
  }

  onMounted(() => init())

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Call on every input event.
   * Updates `suggestions` and learns from ongoing input.
   */
  function onInput(value: string) {
    if (!_predictor) return
    _predictor.learnFromInput(value)
    suggestions.value = _predictor.predict(value, { maxPredictions: maxSuggestions })
  }

  /**
   * Call when the user accepts a suggestion (Tab / click).
   * Reinforces the word-pair so it ranks higher next time.
   */
  function onAccept(word: string) {
    if (!_predictor) return
    const prev = _predictor.getWords().find(w => w !== word) ?? ''
    _predictor.learn(prev, word)
  }

  /**
   * Imperatively add vocabulary (e.g. the user's word bank).
   */
  function addWords(words: string[]) {
    if (_predictor) {
      _predictor.addWords(words)
    }
  }

  /**
   * Apply a chosen prediction back into a full input string.
   * Delegates to Predictionary's applyPrediction for correct word-boundary handling.
   */
  function applyToInput(currentInput: string, chosenWord: string): string {
    if (!_predictor) return currentInput
    return _predictor.applyPrediction(currentInput, chosenWord)
  }

  return {
    suggestions: computed(() => suggestions.value),
    isReady: readonly(isReady),
    onInput,
    onAccept,
    addWords,
    applyToInput,
  }
}
