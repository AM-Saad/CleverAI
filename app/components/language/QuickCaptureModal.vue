<template>
  <Teleport to="body">
    <AnimatePresence>
      <!-- ── Backdrop ──────────────────────────────────────────────────────── -->
      <motion.div v-if="show" key="qcm-bd" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }" class="fixed inset-0 z-48 bg-black/10 backdrop-blur-sm"
        :class="{ 'cursor-not-allowed': isLocked }" @click="onBackdropClick" />

      <!-- ── Panel ─────────────────────────────────────────────────────────── -->
      <motion.div v-if="show" key="qcm-panel" role="dialog" aria-modal="true" aria-labelledby="qcm-title"
        :initial="{ opacity: 0, y: 24, scale: 0.96 }" :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, y: 16, scale: 0.97 }" :transition="{ type: 'spring', stiffness: 480, damping: 38 }"
        class="fixed inset-x-0 bottom-[10vh] z-49 mx-auto flex w-[95%] lg:max-w-120 flex-col rounded-2xl bg-surface px-4"
        style="max-height: 82svh; box-shadow: 0 24px 64px -8px rgba(0,0,0,0.22), 0 4px 20px -4px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.06) inset;">
        <!-- Gradient top stripe -->
        <div
          class="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-linear-to-r from-transparent via-primary/90 to-transparent" />

        <!-- Header -->
        <div class="flex items-center justify-between pt-5 pb-4 shrink-0">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Icon name="i-lucide-languages" class="h-4 w-4 text-primary" />
            </div>
            <span id="qcm-title" class="text-base font-semibold tracking-tight text-content-on-surface">
              Quick Translate
            </span>
            <!-- State breadcrumb pill -->
            <AnimatePresence>
              <motion.span v-if="internalState !== 'idle'" key="qcm-pill" :initial="{ opacity: 0, scale: 0.8 }"
                :animate="{ opacity: 1, scale: 1 }" :exit="{ opacity: 0, scale: 0.8 }" :transition="{ duration: 0.15 }"
                class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {{ statePill }}
              </motion.span>
            </AnimatePresence>
          </div>
          <button type="button" aria-label="Close" :disabled="isLocked"
            class="flex h-8 w-8 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-surface-strong hover:text-content-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
            @click="handleClose">
            <Icon name="i-lucide-x" class="h-4 w-4" />
          </button>
        </div>

        <div class="h-px bg-secondary shrink-0" />

        <!-- Body — scrollable, state transitions inside -->
        <div class="flex-1 overflow-y-auto py-5 min-h-0">
          <AnimatePresence mode="wait">

            <!-- ── IDLE ───────────────────────────────────────────────────── -->
            <motion.div v-if="internalState === 'idle'" key="state-idle"
              :initial="{ opacity: 0, y: stateDirection * -20 }" :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: stateDirection * 20 }" :transition="{ duration: 0.18, ease: 'easeInOut' }">
              <div class="space-y-4">
                <div ref="inputContainerRef">
                  <shared-autocomplete-input v-model="wordInput" size="lg" placeholder="Type a word or phrase…"
                    :suggestions="wordSuggestionsArr" class="w-full" @query="handleWordQuery" @accept="handleWordAccept"
                    @keyup.enter="handleCapture" />
                  <!-- Live interim speech transcript -->
                  <Transition name="ctx">
                    <p v-if="isListening && !usingFallback && interimTranscript"
                      class="mt-2 text-sm text-primary text-center italic select-none animate-pulse">
                      “{{ interimTranscript }}”
                    </p>
                  </Transition>
                </div>

                <!-- Mic -->
                <div class="flex flex-col items-center gap-1.5">
                  <button type="button" :disabled="isProcessing" :class="[
                    'flex min-w-40 items-center justify-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-medium transition-all duration-200 select-none',
                    !isListening && !isProcessing
                      ? 'border-secondary bg-surface-strong text-content-secondary hover:border-primary/50 active:scale-95'
                      : isListening
                        ? 'border-error bg-error/10 text-error'
                        : 'cursor-not-allowed border-primary/20 bg-primary/10 opacity-60 text-content-secondary',
                  ]" @click="handleMicClick">
                    <Icon :name="micIcon" class="h-4 w-4 shrink-0"
                      :class="isProcessing ? 'animate-spin text-primary' : ''" />
                    {{ micLabel }}
                  </button>
                  <!-- Fallback indicator -->
                  <Transition name="ctx">
                    <span v-if="usingFallback && (isListening || isProcessing)"
                      class="text-[11px] text-content-secondary flex items-center gap-1">
                      <Icon name="i-lucide-cpu" class="h-3 w-3" />
                      Using local AI
                    </span>
                  </Transition>
                  <!-- Mic error -->
                  <Transition name="ctx">
                    <p v-if="micError" class="text-xs text-error text-center">{{ micError }}</p>
                  </Transition>
                </div>

                <!-- Optional context -->
                <div>
                  <button type="button"
                    class="flex items-center gap-1 text-xs text-content-secondary transition-colors hover:text-content-on-surface"
                    @click="showContext = !showContext">
                    <Icon :name="showContext ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-3 w-3" />
                    Add context (optional)
                  </button>
                  <Transition name="ctx">
                    <u-input v-if="showContext" v-model="contextInput" placeholder="Surrounding sentence…"
                      class="mt-2 w-full" />
                  </Transition>
                </div>

                <u-button :disabled="!wordInput.trim()" :loading="isCapturing" @click="handleCapture">
                  <Icon name="i-lucide-send" class="mr-1.5 h-4 w-4" />
                  Translate
                </u-button>
              </div>
            </motion.div>

            <!-- ── LOADING ─────────────────────────────────────────────────── -->
            <motion.div v-else-if="internalState === 'loading'" key="state-loading" :initial="{ opacity: 0 }"
              :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.15 }"
              class="flex flex-col items-center gap-4 py-12 text-center">
              <div class="relative flex h-14 w-14 items-center justify-center">
                <div class="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                <Icon name="i-lucide-loader-2" class="relative h-7 w-7 text-primary animate-spin" />
              </div>
              <UiParagraph size="sm" color="content-secondary">Translating…</UiParagraph>
            </motion.div>

            <!-- ── RESULT ──────────────────────────────────────────────────── -->
            <motion.div v-else-if="internalState === 'result' && captureResult" key="state-result"
              :initial="{ opacity: 0, x: stateDirection * -20 }" :animate="{ opacity: 1, x: 0 }"
              :exit="{ opacity: 0, x: stateDirection * 20 }" :transition="{ duration: 0.18, ease: 'easeInOut' }">
              <div class="space-y-4">
                <!-- Word card — uses primary gradient treatment -->
                <div
                  class="relative overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-primary/8 to-primary/2 p-5">
                  <div class="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/6 blur-2xl" />
                  <div class="relative flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-2xl font-semibold leading-tight text-content-on-surface">
                        {{ captureResult.word }}
                      </p>
                      <p v-if="captureResult.phonetic" class="mt-0.5 text-xs text-content-secondary">
                        {{ captureResult.phonetic }}
                      </p>
                    </div>
                    <u-badge variant="soft" color="neutral" class="mt-1 shrink-0 text-xs">
                      {{ captureResult.partOfSpeech }}
                    </u-badge>
                  </div>
                  <div class="relative mt-4 border-t border-primary/15 pt-4">
                    <p class="text-xl font-semibold leading-snug text-primary">
                      {{ captureResult.translation }}
                    </p>
                    <div class="mt-1.5 flex flex-wrap items-center gap-2">
                      <span class="text-xs uppercase tracking-wide text-content-disabled">
                        {{ captureResult.detectedLang }} → {{ preferences?.targetLanguage ?? 'en' }}
                      </span>
                      <u-badge v-if="captureResult.cached" variant="soft" color="success" class="text-xs">
                        Already saved
                      </u-badge>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <u-button class="w-full" :loading="isGeneratingStory" @click="handleGenerateStory">
                    <Icon name="i-lucide-sparkles" class="mr-1.5 h-4 w-4" />
                    Add to Deck + Generate Story
                  </u-button>
                  <u-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                    <Icon name="i-lucide-rotate-ccw" class="mr-1.5 h-3.5 w-3.5" />
                    Translate another
                  </u-button>
                </div>
              </div>
            </motion.div>

            <!-- ── STORY LOADING ───────────────────────────────────────────── -->
            <motion.div v-else-if="internalState === 'story-loading'" key="state-story-loading"
              :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }"
              :transition="{ duration: 0.15 }" class="flex flex-col items-center gap-5 py-12 text-center">
              <div class="relative flex h-14 w-14 items-center justify-center">
                <div class="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                <Icon name="i-lucide-sparkles" class="relative h-6 w-6 text-primary animate-spin" />
              </div>
              <div>
                <UiParagraph size="sm" color="content-secondary" class="mb-2">
                  Generating your story…
                </UiParagraph>
                <div class="flex justify-center gap-1.5">
                  <span v-for="d in [0, 150, 300]" :key="d"
                    class="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
                    :style="{ animationDelay: `${d}ms` }" />
                </div>
              </div>
            </motion.div>

            <!-- ── STORY READY ─────────────────────────────────────────────── -->
            <motion.div v-else-if="internalState === 'story-ready' && storyResult" key="state-story-ready"
              :initial="{ opacity: 0, x: stateDirection * -20 }" :animate="{ opacity: 1, x: 0 }"
              :exit="{ opacity: 0, x: stateDirection * 20 }" :transition="{ duration: 0.18, ease: 'easeInOut' }">
              <div class="space-y-4">
                <div class="flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/8 p-3.5">
                  <Icon name="i-lucide-check-circle-2" class="h-4 w-4 shrink-0 text-success" />
                  <UiParagraph size="sm" color="success">
                    Story generated — added to your language deck.
                  </UiParagraph>
                </div>

                <div class="space-y-2">
                  <div v-for="(sentence, i) in storyResult.sentences" :key="i"
                    class="rounded-lg bg-surface-strong p-3 text-sm leading-relaxed text-content-on-surface">
                    <span class="mr-1.5 text-xs text-content-disabled">{{ i + 1 }}.</span>
                    <span v-html="highlightCloze(sentence.text, sentence.clozeWord)" />
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <u-button class="w-full" to="/language/review" @click="handleClose">
                    <Icon name="i-lucide-play" class="mr-1.5 h-4 w-4" />
                    Start Reviewing
                  </u-button>
                  <u-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                    <Icon name="i-lucide-rotate-ccw" class="mr-1.5 h-3.5 w-3.5" />
                    Translate another
                  </u-button>
                </div>
              </div>
            </motion.div>

          </AnimatePresence>

          <!-- Error (always visible, below active state) -->
          <div v-if="captureError || storyError" class="mt-3">
            <shared-error-message :error="captureError || storyError" />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <!-- Consent sheet — z-50, always above the modal -->
  <language-consent-sheet :show="showConsentSheet" @confirm="confirmCapture" @decline="declineCapture" />
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { usePredictionaryInput } from '~/composables/usePredictionaryInput';
import { useSpeechCapture } from '~/composables/useSpeechCapture';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const {
  state,
  captureResult,
  storyResult,
  showConsentSheet,
  preferences,
  isCapturing,
  captureError,
  isGeneratingStory,
  storyError,
  captureWord,
  confirmCapture,
  declineCapture,
  generateStory,
  dismissResult,
  loadPreferences,
} = useLanguageCapture();

const internalState = computed(() => state.value);

// Map state order so transitions slide forward/backward correctly
const STATE_ORDER = ['idle', 'loading', 'result', 'story-loading', 'story-ready'] as const;
type AppState = typeof STATE_ORDER[number];
const prevStateIdx = ref(0);
const stateDirection = ref(1); // +1 = forward, -1 = back
watch(internalState, (next, prev) => {
  const ni = STATE_ORDER.indexOf(next as AppState);
  const pi = STATE_ORDER.indexOf(prev as AppState);
  stateDirection.value = ni >= pi ? 1 : -1;
  prevStateIdx.value = pi;
});

const statePill = computed(() => {
  const m: Record<string, string> = {
    loading: 'Translating',
    result: 'Result',
    'story-loading': 'Generating story',
    'story-ready': 'Story ready',
  };
  return m[internalState.value] ?? '';
});

// Backdrop dismiss locked during async ops
const isLocked = computed(() =>
  internalState.value === 'loading' || internalState.value === 'story-loading'
);
const onBackdropClick = () => { if (!isLocked.value) handleClose(); };

// ── Input ──────────────────────────────────────────────────────────────────────
const wordInput = ref('');
const contextInput = ref('');

// ── Autocomplete ──────────────────────────────────────────────────────────────
const { suggestions: wordSuggestions, onInput: predInput, onAccept: predAccept } = usePredictionaryInput();
const wordSuggestionsArr = computed<string[]>(() => wordSuggestions.value.slice());
const handleWordQuery = (val: string) => predInput(val);
const handleWordAccept = (word: string) => { predAccept(word); };
const showContext = ref(false);
const inputContainerRef = ref<HTMLElement | null>(null);

// ── Recording ──────────────────────────────────────────────────────────────────
const {
  isListening,
  isProcessing,
  usingFallback,
  recordingSeconds,
  interimTranscript,
  error: micError,
  start: startSpeech,
  stop: stopSpeech,
  cleanup: cleanupSpeech,
} = useSpeechCapture({
  maxDuration: 15,
  onResult(transcript) { wordInput.value = transcript; },
});

const micIcon = computed(() => {
  if (isProcessing.value) return 'i-lucide-loader-2';
  if (isListening.value) return 'i-lucide-square';
  return 'i-lucide-mic';
});
const micLabel = computed(() => {
  if (isListening.value && usingFallback.value)
    return `0:${String(recordingSeconds.value).padStart(2, '0')} — Stop`;
  if (isListening.value) return 'Listening… — Stop';
  if (isProcessing.value) return 'Processing…';
  return 'Tap to speak';
});

const handleMicClick = () => {
  if (isListening.value) { stopSpeech(); return; }
  startSpeech();
};

// ── Actions ────────────────────────────────────────────────────────────────────
const handleCapture = async () => {
  const word = wordInput.value.trim();
  if (!word) return;
  await captureWord(word, {
    sourceContext: contextInput.value.trim() || undefined,
    sourceType: 'manual',
  });
};
const handleGenerateStory = async () => {
  if (!captureResult.value?.wordId) return;
  await generateStory(captureResult.value.wordId);
};
const resetToIdle = () => {
  dismissResult();
  wordInput.value = '';
  showContext.value = false;
  nextTick(() => inputContainerRef.value?.querySelector('input')?.focus());
};
const handleClose = () => {
  cleanupSpeech();
  dismissResult();
  wordInput.value = '';
  contextInput.value = '';
  showContext.value = false;
  emit('close');
};
const highlightCloze = (text: string, clozeWord: string) => {
  const esc = clozeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`\\b${esc}\\b`, 'gi'),
    `<mark class="bg-primary/20 text-primary rounded px-0.5">$&</mark>`,
  );
};

watch(() => props.show, (v) => {
  if (v) {
    loadPreferences();
    nextTick(() => inputContainerRef.value?.querySelector('input')?.focus());
  }
});
</script>

<style scoped>
.ctx-enter-active,
.ctx-leave-active {
  transition: all 0.18s ease;
  overflow: hidden;
}

.ctx-enter-from,
.ctx-leave-to {
  opacity: 0;
  max-height: 0;
}

.ctx-enter-to,
.ctx-leave-from {
  max-height: 80px;
}
</style>
