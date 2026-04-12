<script setup lang="ts">
// This page is purely a smoke-test for the locally-hosted Predictionary library.
// Remove or keep it; it has zero side-effects on the rest of the app.

definePageMeta({ layout: false })

const { getInstance, loadFrequencyDictionary } = usePredictionary()

const input = ref('')
const suggestions = ref<string[]>([])
const status = ref('Initialising Predictionary…')

let predictor: Awaited<ReturnType<typeof getInstance>> = null

onMounted(async () => {
  predictor = await getInstance()

  if (!predictor) {
    status.value = 'ERROR: Predictionary failed to load.'
    return
  }

  status.value = 'Loading English dictionary (25k words)…'
  try {
    await loadFrequencyDictionary(predictor)
    status.value = 'Ready — start typing to see predictions.'
  } catch (e) {
    status.value = `Dictionary load failed: ${(e as Error).message}`
  }
})

function onInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  input.value = value

  if (!predictor) return

  // Automatically learn from ongoing input (reinforces word-pair frequencies).
  predictor.learnFromInput(value)

  // Predict up to 8 suggestions for the current input.
  suggestions.value = predictor.predict(value, { maxPredictions: 8 })

  // Mirror to console as required by the task spec.
  console.log('[Predictionary] suggestions:', suggestions.value)
}

function applySuggestion(word: string) {
  if (!predictor) return
  input.value = predictor.applyPrediction(input.value, word)
  suggestions.value = []
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-8 font-sans">
    <h1 class="text-2xl font-bold mb-2">Predictionary – Integration Test</h1>
    <p class="text-sm text-gray-500 mb-6">{{ status }}</p>

    <label class="block text-sm font-medium text-gray-700 mb-1">
      Type something:
    </label>
    <textarea :value="input" rows="4"
      class="w-full  border border-gray-300 rounded-md p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      placeholder="e.g. hel…" @input="onInput" />

    <div v-if="suggestions.length" class="mt-4 ">
      <p class="text-xs text-gray-500 mb-2 uppercase tracking-wide">Suggestions (also logged to console)</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="word in suggestions" :key="word" type="button"
          class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm rounded-full transition-colors"
          @click="applySuggestion(word)">
          {{ word }}
        </button>
      </div>
    </div>

    <p v-else-if="input.length > 0" class="mt-4 text-sm text-gray-400 italic">
      No suggestions yet — keep typing.
    </p>

    <details class="mt-8">
      <summary class="text-xs text-gray-400 cursor-pointer">Debug info</summary>
      <pre class="mt-2 text-xs bg-white border border-gray-200 rounded p-3 overflow-auto">input: {{ input }}
suggestions: {{ JSON.stringify(suggestions, null, 2) }}
predictor loaded: {{ predictor !== null }}</pre>
    </details>
  </div>
</template>
