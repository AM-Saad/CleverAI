/**
 * usePredictionary
 *
 * SSR-safe wrapper around the locally-hosted Predictionary library
 * (public/scripts/vendor/predictionary.js).
 *
 * The library injects `window.Predictionary` via a deferred <script> tag
 * registered in nuxt.config.ts. This composable waits for that global to be
 * available before resolving, so it is safe to call inside any component on
 * the client side.
 *
 * Usage:
 *   const { getInstance } = usePredictionary()
 *   const predictor = await getInstance()
 *   predictor.addWords(['hello', 'world'])
 *   const suggestions = predictor.predict('hel') // ['hello']
 */

declare global {
  interface Window {
    Predictionary: {
      instance(): PredictionaryInstance
    }
  }
}

export interface PredictionaryInstance {
  /** Add a single word to the default dictionary. */
  addWord(word: string, dictionaryKey?: string): void
  /** Add multiple words to the default dictionary. */
  addWords(words: string[], dictionaryKey?: string): void
  /** Predict completions / next words for the given input string. */
  predict(input: string, options?: PredictionaryOptions): string[]
  /** Only predict completions for the current (partial) word. */
  predictCompleteWord(input: string, options?: PredictionaryOptions): string[]
  /** Only predict the next word after a completed word. */
  predictNextWord(input: string, options?: PredictionaryOptions): string[]
  /** Apply a chosen prediction back into the input string. */
  applyPrediction(input: string, prediction: string, options?: { dontLearn?: boolean; addToDictionary?: string }): string
  /** Record that `word` followed `previousWord` (reinforces ranking). */
  learn(previousWord: string, word: string, dictionaryKey?: string): void
  /** Returns true if the instance learned from recent input (call on every keystroke). */
  learnFromInput(input: string, dictionaryKey?: string): boolean
  /** Bulk-train from a body of text. */
  learnFromText(text: string, dictionaryKey?: string): void
  /** Load a dictionary from a JSON string previously exported via dictionaryToJSON(). */
  loadDictionary(json: string, dictionaryKey?: string): void
  /** Export the current dictionary as a JSON string. */
  dictionaryToJSON(dictionaryKey?: string): string | null
  /** Return all known words. */
  getWords(dictionaryKey?: string): string[]
  /**
   * Bulk-import words from a delimited text file (e.g. Leeds frequency lists).
   * Use rankPosition/wordPosition to map columns; elementSeparator for line separator.
   */
  parseWords(text: string, options: {
    elementSeparator?: string
    rankSeparator?: string
    wordPosition?: number
    wordPosition2?: number
    rankPosition?: number
    addToDictionary?: string
  }): void
}

export interface PredictionaryOptions {
  maxPredictions?: number
  applyToInput?: boolean
}

/**
 * Poll for `window.Predictionary` up to `timeoutMs` milliseconds.
 * Resolves with the global as soon as it is available.
 */
function waitForPredictionary(timeoutMs = 10_000): Promise<Window['Predictionary']> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Predictionary) {
      return resolve(window.Predictionary)
    }

    const deadline = Date.now() + timeoutMs
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.Predictionary) {
        clearInterval(interval)
        resolve(window.Predictionary)
      } else if (Date.now() >= deadline) {
        clearInterval(interval)
        reject(new Error('[usePredictionary] window.Predictionary did not load within the timeout. Check that /scripts/vendor/predictionary.js is accessible.'))
      }
    }, 50)
  })
}

export function usePredictionary() {
  /**
   * Returns a ready-to-use Predictionary instance.
   * Waits for the script to finish loading if called early.
   * Always resolves to `null` on the server (SSR-safe).
   */
  async function getInstance(): Promise<PredictionaryInstance | null> {
    if (typeof window === 'undefined') {
      // Running on the server — return null, never execute.
      return null
    }

    const lib = await waitForPredictionary()
    return lib.instance()
  }

  /**
   * Fetch a word-frequency text file (Leeds/ngrams format) and load it into
   * the given predictor instance.
   *
   * File format (one entry per line):
   *   <rank> <frequency> <word>
   * e.g.  "1 43116.72 the"
   *
   * @param predictor  A live PredictionaryInstance (from getInstance()).
   * @param fileUrl    URL to the word-list file (default: built-in English list).
   * @param dictionaryKey  Key under which to register the dictionary.
   */
  async function loadFrequencyDictionary(
    predictor: PredictionaryInstance,
    fileUrl = '/scripts/vendor/words_en.txt',
    dictionaryKey = 'DICT_EN',
  ): Promise<void> {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`[usePredictionary] Failed to fetch dictionary: ${fileUrl} (${response.status})`)
    }
    const text = await response.text()
    predictor.parseWords(text, {
      elementSeparator: '\n',
      rankSeparator: ' ',
      wordPosition: 2,
      rankPosition: 0,
      addToDictionary: dictionaryKey,
    })
  }

  return { getInstance, loadFrequencyDictionary }
}
