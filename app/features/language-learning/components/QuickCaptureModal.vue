<template>
  <Teleport to="body">
    <AnimatePresence>
      <!-- ── Backdrop ──────────────────────────────────────────────────────── -->
      <motion.div v-if="show" key="qcm-bd" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        class="fixed inset-0 z-48 bg-[var(--ds-backdrop-dim)] backdrop-blur-[2px]"
        :class="{ 'cursor-not-allowed': isLocked }" @click="onBackdropClick" />
      <!-- ── Panel ─────────────────────────────────────────────────────────── -->
      <motion.div v-if="show" ref="panelEl" key="qcm-panel" role="dialog" aria-modal="true" aria-labelledby="qcm-title"
        tabindex="-1" @keydown="onKeydown" :initial="{ opacity: 0, y: 24, scale: 0.96 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }" :exit="{ opacity: 0, y: 16, scale: 0.97 }"
        :transition="{ type: 'spring', stiffness: 480, damping: 38 }"
        class="fixed inset-x-0 bottom-4 z-50 mx-auto w-[92%] min-h-0 md:bottom-auto md:top-[12vh] md:w-[480px]">
        <UiOverlaySurface
          kind="modal"
          layer="modal"
          size="xs"
          class-name="relative flex max-h-[82svh] min-h-0 flex-col overflow-hidden rounded-[var(--radius-2xl)] px-5 pb-5 pt-0"
        >
        <!-- Gradient top stripe -->
        <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-teal via-accent-blue to-accent-purple" />

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
          <UiIconButton
            icon="i-lucide-x"
            label="Close quick translate"
            size="sm"
            variant="ghost"
            :disabled="isLocked"
            class="rounded-full active:scale-[0.98]"
            @click="handleClose"
          />
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
                <!-- Unified Input Row: Mic + Input + Send in one line -->
                <div class="flex items-center gap-2 bg-surface-strong rounded-full border p-1.5 transition-all duration-[var(--duration-fast)]"
                  :class="isInputFocused ? 'ring-2 ring-[var(--ds-focus-outline-color)] border-primary shadow-[var(--shadow-dropdown)]' : 'border-secondary'">
                  <!-- Mic Button (compact icon-only) -->
                  <UiButton
                    square
                    variant="ghost"
                    tone="neutral"
                    :disabled="isProcessing"
                    :aria-label="micLabel"
                    :title="micLabel"
                    class="h-9 w-9 rounded-full"
                    :class="[
                      !isListening && !isProcessing
                        ? 'text-content-secondary hover:bg-surface active:scale-[0.98]'
                        : isListening
                          ? 'bg-error text-white animate-pulse'
                          : 'cursor-not-allowed text-content-disabled opacity-60'
                    ]"
                    @click="handleMicClick"
                  >
                    <Icon :name="micIcon" class="h-4.5 w-4.5 shrink-0"
                      :class="isProcessing ? 'animate-spin text-primary' : ''" />
                  </UiButton>

                  <!-- Autocomplete Input -->
                  <div ref="inputContainerRef" class="flex-1 min-w-0" @focusin="isInputFocused = true" @focusout="isInputFocused = false">
                    <shared-autocomplete-input
                      v-model="wordInput"
                      variant="none"
                      size="md"
                      placeholder="Type a word or phrase…"
                      :suggestions="wordSuggestionsArr"
                      class="w-full border-0 bg-transparent p-0 focus:ring-0 shadow-none"
                      @query="handleWordQuery"
                      @accept="handleWordAccept"
                      @keyup.enter="handleCapture"
                    />
                  </div>

                  <!-- Translate/Send Button -->
                  <UiButton
                    square
                    tone="primary"
                    :disabled="!wordInput.trim() || isCapturing"
                    aria-label="Translate"
                    title="Translate"
                    class="h-9 w-9 rounded-full active:scale-[0.98]"
                    @click="handleCapture"
                  >
                    <Icon name="i-lucide-arrow-right" class="h-4.5 w-4.5" />
                  </UiButton>
                </div>

                <!-- Live interim speech transcript & Fallbacks -->
                <div class="space-y-1 text-center">
                  <Transition name="ctx">
                    <p v-if="isListening && !usingFallback && interimTranscript"
                      class="text-sm text-primary italic select-none animate-pulse">
                      “{{ interimTranscript }}”
                    </p>
                  </Transition>
                  <Transition name="ctx">
                    <span v-if="usingFallback && (isListening || isProcessing)"
                      class="text-[11px] text-content-secondary flex items-center justify-center gap-1">
                      <Icon name="i-lucide-cpu" class="h-3 w-3" />
                      Using local AI
                    </span>
                  </Transition>
                  <Transition name="ctx">
                    <p v-if="micError" class="text-xs text-error-text">
                      {{ micError }}
                    </p>
                  </Transition>
                </div>

                <!-- Optional Context Accordion and Target Language settings compacted -->
                <div class="flex flex-col gap-2 border-t border-secondary pt-3">
                  <div class="flex items-center justify-between gap-x-4">
                    <!-- Optional context toggle button -->
                    <UiButton type="button" tone="neutral" variant="link" size="xs"
                      class="text-xs text-content-secondary"
                      @click="showContext = !showContext">
                      <Icon :name="showContext ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="h-3 w-3" />
                      Add context (optional)
                    </UiButton>

                    <!-- Translate language check -->
                    <UiCheckbox v-model="includeTranslation" size="sm"
                      :label="`Translate to ${translationLanguage}`" />
                  </div>

                  <Transition name="ctx">
                    <div v-if="showContext" class="mt-2">
                      <ui-input v-model="contextInput" placeholder="Surrounding sentence context..." class="w-full" size="sm" />
                    </div>
                  </Transition>
                </div>
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
                <!-- Word card — uses primary glassmorphism gradient treatment -->
                <UiPanel variant="surface" size="lg" class-name="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/8 via-primary/[0.01] to-transparent">
                  <div class="relative flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-2xl font-semibold leading-tight text-content-on-surface" dir="auto">
                        {{ captureResult.word }}
                      </p>
                      <p v-if="captureResult.phonetic" class="mt-0.5 text-xs text-content-secondary">
                        {{ captureResult.phonetic }}
                      </p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <ui-badge v-if="captureResult.category" variant="soft" color="neutral" class="text-xs">
                          {{ captureResult.category }}
                        </ui-badge>
                        <ui-badge v-if="captureResult.difficulty" variant="soft" color="neutral" class="text-xs">
                          {{ captureResult.difficulty }}
                        </ui-badge>
                      </div>
                    </div>
                    <ui-badge variant="soft" color="neutral" class="mt-1 shrink-0 text-xs">
                      {{ captureResult.partOfSpeech }}
                    </ui-badge>
                  </div>
                  <div v-if="captureResult.translation" class="relative mt-4 border-t border-primary/15 pt-4">
                    <p class="text-xl font-semibold leading-snug text-primary" dir="auto">
                      {{ captureResult.translation }}
                    </p>
                    <div class="mt-1.5 flex flex-wrap items-center gap-2">
                      <span class="text-xs uppercase tracking-wide text-content-disabled">
                        {{ captureResult.detectedLang }} →
                        {{ translationLanguage }}
                      </span>
                      <ui-badge v-if="captureResult.cached" variant="soft" color="success" class="text-xs">
                        Already saved
                      </ui-badge>
                    </div>
                  </div>
                </UiPanel>

                <UiPanel v-if="captureResult.meanings?.length"
                  variant="subtle" size="md" content-class="space-y-3">
                  <div class="flex items-center gap-2">
                    <Icon name="i-lucide-list-tree" class="h-4 w-4 text-primary" />
                    <span class="text-sm font-semibold text-content-on-surface">
                      Meanings
                    </span>
                  </div>
                  <div class="space-y-2">
                    <div v-for="(meaning, index) in captureResult.meanings" :key="`${meaning.definition}-${index}`"
                      class="rounded-[var(--radius-lg)] bg-surface px-3 py-2">
                      <div class="flex items-start gap-2">
                        <span class="mt-0.5 text-xs text-content-disabled">
                          {{ index + 1 }}.
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="text-sm text-content-on-surface">
                            {{ meaning.definition }}
                          </p>
                          <p v-if="meaning.translation" class="mt-0.5 text-xs font-medium text-primary" dir="auto">
                            {{ meaning.translation }}
                          </p>
                          <p v-if="meaning.example" class="mt-1 text-xs italic text-content-secondary" dir="auto">
                            {{ meaning.example }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </UiPanel>

                <UiPanel v-if="captureResult.examples?.length"
                  variant="subtle" size="md">
                  <div class="mb-2 flex items-center gap-2">
                    <Icon name="i-lucide-message-square-quote" class="h-4 w-4 text-primary" />
                    <span class="text-sm font-semibold text-content-on-surface">
                      Example
                    </span>
                  </div>
                  <p class="text-sm leading-relaxed text-content-on-surface" dir="auto">
                    {{ captureResult.examples[0]?.text }}
                  </p>
                  <p v-if="captureResult.examples[0]?.translation" class="mt-1 text-xs text-content-secondary" dir="auto">
                    {{ captureResult.examples[0]?.translation }}
                  </p>
                </UiPanel>

                <div class="flex flex-col gap-2">
                  <ui-button v-if="!captureResult.saved" variant="soft" color="neutral" class="w-full"
                    :loading="isCapturing" @click="handleSaveOnly">
                    <Icon name="i-lucide-book-plus" class="mr-1.5 h-4 w-4" />
                    Save to Word Bank
                  </ui-button>
                  <ui-button class="w-full" :loading="isGeneratingStory" @click="handleGenerateStory">
                    <Icon name="i-lucide-sparkles" class="mr-1.5 h-4 w-4" />
                    {{
                      captureResult.saved
                        ? "Generate Story"
                        : "Save to Deck + Generate Story"
                    }}
                  </ui-button>
                  <ui-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                    <Icon name="i-lucide-rotate-ccw" class="mr-1.5 h-3.5 w-3.5" />
                    Translate another
                  </ui-button>
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
                <UiPanel variant="subtle" size="sm" class-name="border-success/20 bg-success/8" content-class="flex items-center gap-2.5">
                  <Icon name="i-lucide-check-circle-2" class="h-4 w-4 shrink-0 text-success-text" />
                  <UiParagraph size="sm" color="success">
                    Story generated — added to your language deck.
                  </UiParagraph>
                </UiPanel>

                <div class="space-y-2">
                  <div v-for="(sentence, i) in storyResult.sentences" :key="i"
                    class="rounded-[var(--radius-lg)] bg-surface-strong p-3 text-sm leading-relaxed text-content-on-surface">
                    <span class="mr-1.5 text-xs text-content-disabled">{{ i + 1 }}.</span>
                    <span v-html="highlightCloze(sentence.text, sentence.clozeWord)" />
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <ui-button class="w-full" to="/language/review" @click="handleClose">
                    <Icon name="i-lucide-play" class="mr-1.5 h-4 w-4" />
                    Start Reviewing
                  </ui-button>
                  <ui-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                    <Icon name="i-lucide-rotate-ccw" class="mr-1.5 h-3.5 w-3.5" />
                    Translate another
                  </ui-button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <!-- Error (always visible, below active state) -->
          <div v-if="captureError || storyError" class="mt-3">
            <shared-error-message :error="captureError || storyError" />
          </div>
        </div>
        </UiOverlaySurface>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <!-- Consent sheet — z-50, always above the modal -->
  <ConsentSheet :show="showConsentSheet" @confirm="confirmCapture" @decline="declineCapture" />
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from "motion-v";
import { useSanitize } from "~/composables/shared/useSanitize";
import { usePredictionaryInput } from "~/composables/usePredictionaryInput";
import { useSpeechCapture } from "../composables/useSpeechCapture";
import ConsentSheet from "~/features/language-learning/components/ConsentSheet.vue";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

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
const { sanitizeHtml } = useSanitize();

const internalState = computed(() => state.value);

// Map state order so transitions slide forward/backward correctly
const STATE_ORDER = [
  "idle",
  "loading",
  "result",
  "story-loading",
  "story-ready",
] as const;
type AppState = (typeof STATE_ORDER)[number];
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
    loading: "Translating",
    result: "Result",
    "story-loading": "Generating story",
    "story-ready": "Story ready",
  };
  return m[internalState.value] ?? "";
});
const translationLanguage = computed(
  () => preferences.value?.nativeLanguage ?? "en",
);

// Backdrop dismiss locked during async ops
const isLocked = computed(
  () =>
    internalState.value === "loading" ||
    internalState.value === "story-loading",
);
const onBackdropClick = () => {
  if (!isLocked.value) handleClose();
};

const panelEl = ref<HTMLElement | null>(null);
const { onKeydown } = useFocusTrap(computed(() => props.show), panelEl, {
  initialFocus: "input",
  onEscape: () => {
    if (!isLocked.value) handleClose();
  },
});

// ── Input ──────────────────────────────────────────────────────────────────────
const wordInput = ref("");
const contextInput = ref("");
const includeTranslation = ref(true);
const isInputFocused = ref(false);

// ── Autocomplete ──────────────────────────────────────────────────────────────
const {
  suggestions: wordSuggestions,
  onInput: predInput,
  onAccept: predAccept,
} = usePredictionaryInput();
const wordSuggestionsArr = computed<string[]>(() =>
  wordSuggestions.value.slice(),
);
const handleWordQuery = (val: string) => predInput(val);
const handleWordAccept = (word: string) => {
  predAccept(word);
};
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
  onResult(transcript) {
    wordInput.value = transcript;
  },
});

const micIcon = computed(() => {
  if (isProcessing.value) return "i-lucide-loader-2";
  if (isListening.value) return "i-lucide-square";
  return "i-lucide-mic";
});
const micLabel = computed(() => {
  if (isListening.value && usingFallback.value)
    return `0:${String(recordingSeconds.value).padStart(2, "0")} — Stop`;
  if (isListening.value) return "Listening… — Stop";
  if (isProcessing.value) return "Processing…";
  return "Tap to speak";
});

const handleMicClick = () => {
  if (isListening.value) {
    stopSpeech();
    return;
  }
  startSpeech();
};

// ── Actions ────────────────────────────────────────────────────────────────────
const handleCapture = async () => {
  const word = wordInput.value.trim();
  if (!word) return;
  await captureWord(word, {
    sourceContext: contextInput.value.trim() || undefined,
    includeTranslation: includeTranslation.value,
    translateOnly: true,
    sourceType: "manual",
  });
};
const handleSaveOnly = async () => {
  const word = wordInput.value.trim();
  if (!word) return;
  await captureWord(word, {
    sourceContext: contextInput.value.trim() || undefined,
    includeTranslation: includeTranslation.value,
    translateOnly: false,
    sourceType: "manual",
  });
};
const handleGenerateStory = async () => {
  let wordId = captureResult.value?.wordId;
  if (!wordId) {
    const savedWord = await captureWord(wordInput.value.trim(), {
      sourceContext: contextInput.value.trim() || undefined,
      includeTranslation: includeTranslation.value,
      sourceType: "manual",
      translateOnly: false,
    });
    wordId = savedWord?.wordId;
  }
  if (!wordId) return;
  await generateStory(wordId);
};
const resetToIdle = () => {
  dismissResult();
  wordInput.value = "";
  showContext.value = false;
  includeTranslation.value = true;
  nextTick(() => inputContainerRef.value?.querySelector("input")?.focus());
};
const handleClose = () => {
  cleanupSpeech();
  dismissResult();
  wordInput.value = "";
  contextInput.value = "";
  showContext.value = false;
  includeTranslation.value = true;
  emit("close");
};
const highlightCloze = (text: string, clozeWord: string) => {
  const esc = clozeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sanitizeHtml(
    text.replace(
      new RegExp(`\\b${esc}\\b`, "gi"),
      `<mark class="bg-primary/20 text-primary rounded-[var(--radius-md)] px-0.5">$&</mark>`,
    ),
  );
};

watch(
  () => props.show,
  (v) => {
    if (v) {
      document.body.style.overflow = "hidden";
      loadPreferences();
      nextTick(() => inputContainerRef.value?.querySelector("input")?.focus());
    } else {
      document.body.style.overflow = "";
    }
  },
);

onBeforeUnmount(() => {
  document.body.style.overflow = "";
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
