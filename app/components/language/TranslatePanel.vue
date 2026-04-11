<template>
  <Teleport to="body">
    <!-- Click-outside backdrop (no visual fill — panel shadow does the work) -->
    <AnimatePresence>
      <motion.div v-if="show" key="tp-backdrop" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }" :transition="{ duration: 0.15 }" class="fixed inset-0 z-44" @click="handleClose" />
    </AnimatePresence>

    <!-- Floating panel -->
    <AnimatePresence>
      <motion.div v-if="show" key="tp-panel" :initial="{ opacity: 0, scale: 0.9, y: 12 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }" :exit="{ opacity: 0, scale: 0.9, y: 12 }"
        :transition="{ type: 'spring', stiffness: 500, damping: 42 }" :style="{ transformOrigin: 'bottom right' }"
        class="fixed right-6 bottom-24 z-45 flex flex-col w-[calc(100vw-3rem)] max-w-sm max-h-[calc(100svh-8rem)] rounded-2xl bg-surface border border-secondary overflow-hidden"
        style="box-shadow: 0 20px 60px -10px rgba(0,0,0,0.18), 0 4px 16px -4px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.06) inset;">
        <!-- Premium gradient accent stripe -->
        <div class="h-0.5 bg-linear-to-r from-primary/40 via-primary to-primary/40 shrink-0" />

        <!-- Header -->
        <div class="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="i-lucide-languages" class="w-3.5 h-3.5 text-primary" />
            </div>
            <span class="text-base font-semibold text-content-on-surface tracking-tight">Quick Translate</span>
          </div>
          <button type="button" aria-label="Close translate panel"
            class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-strong text-content-secondary hover:text-content-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            @click="handleClose">
            <Icon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>

        <div class="h-px bg-secondary mx-4 shrink-0" />

        <!-- Scrollable body -->
        <div ref="bodyRef" class="flex-1 overflow-y-auto px-4 pt-4 pb-5 min-h-0">

          <!-- ── IDLE STATE ── -->
          <template v-if="internalState === 'idle'">
            <div class="space-y-3">
              <div ref="inputContainerRef">
                <u-input v-model="wordInput" placeholder="Type a word or phrase…" class="w-full" autofocus
                  @keyup.enter="handleCapture" />
              </div>

              <!-- Mic button -->
              <div class="flex justify-center">
                <button type="button" :disabled="recordingState === 'transcribing'" :class="[
                  'flex items-center gap-2 px-5 py-2.5 rounded-full border-2 min-w-36 justify-center transition-all duration-200 select-none text-sm font-medium',
                  recordingState === 'idle'
                    ? 'bg-surface-strong border-secondary hover:border-primary/50 active:scale-95 text-content-secondary'
                    : recordingState === 'recording'
                      ? 'bg-error/10 border-error text-error'
                      : 'bg-primary/10 border-primary/20 cursor-not-allowed opacity-70 text-content-secondary',
                ]" @click="handleMicClick">
                  <Icon :name="micIcon" class="w-4 h-4 shrink-0"
                    :class="recordingState === 'transcribing' ? 'animate-spin text-primary' : ''" />
                  {{ micLabel }}
                </button>
              </div>

              <!-- Context (collapsible) -->
              <div>
                <button type="button"
                  class="text-xs text-content-secondary hover:text-content-on-surface flex items-center gap-1 transition-colors"
                  @click="showContext = !showContext">
                  <Icon :name="showContext ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-3 h-3" />
                  Add context (optional)
                </button>
                <Transition name="slide">
                  <u-input v-if="showContext" v-model="contextInput" placeholder="Surrounding sentence or phrase…"
                    class="mt-2 w-full" />
                </Transition>
              </div>

              <u-button class="w-full" :disabled="!wordInput.trim()" :loading="isCapturing" @click="handleCapture">
                <Icon name="i-lucide-send" class="w-4 h-4 mr-1.5" />
                Translate
              </u-button>
            </div>
          </template>

          <!-- ── LOADING STATE ── -->
          <template v-else-if="internalState === 'loading'">
            <div class="flex flex-col items-center gap-4 py-10 text-center">
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="i-lucide-loader-2" class="w-6 h-6 text-primary animate-spin" />
              </div>
              <UiParagraph size="sm" color="content-secondary">Translating…</UiParagraph>
            </div>
          </template>

          <!-- ── RESULT STATE ── -->
          <template v-else-if="internalState === 'result' && captureResult">
            <div class="space-y-3">
              <!-- Word card — elevated premium treatment -->
              <div
                class="rounded-xl bg-linear-to-br from-primary/5 to-primary/2 border border-primary/15 p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-xl font-semibold text-content-on-surface truncate">{{ captureResult.word }}</p>
                    <p v-if="captureResult.phonetic" class="text-xs text-content-secondary mt-0.5">
                      {{ captureResult.phonetic }}
                    </p>
                  </div>
                  <u-badge variant="soft" color="neutral" class="text-xs shrink-0 mt-0.5">
                    {{ captureResult.partOfSpeech }}
                  </u-badge>
                </div>
                <div class="border-t border-primary/10 pt-3 space-y-1">
                  <p class="text-lg font-semibold text-primary leading-snug">{{ captureResult.translation }}</p>
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-xs text-content-disabled uppercase tracking-wide">
                      {{ captureResult.detectedLang }} → {{ preferences?.targetLanguage ?? 'en' }}
                    </p>
                    <u-badge v-if="captureResult.cached" variant="soft" color="success" class="text-xs">
                      Already saved
                    </u-badge>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col gap-2">
                <u-button class="w-full" :loading="isGeneratingStory" @click="handleGenerateStory">
                  <Icon name="i-lucide-sparkles" class="w-4 h-4 mr-1.5" />
                  Add to Deck + Generate Story
                </u-button>
                <u-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                  <Icon name="i-lucide-rotate-ccw" class="w-3.5 h-3.5 mr-1.5" />
                  Translate another
                </u-button>
              </div>
            </div>
          </template>

          <!-- ── STORY LOADING STATE ── -->
          <template v-else-if="internalState === 'story-loading'">
            <div class="flex flex-col items-center gap-4 py-10 text-center">
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="i-lucide-loader-2" class="w-6 h-6 text-primary animate-spin" />
              </div>
              <div>
                <UiParagraph size="sm" color="content-secondary" class="mb-2">Generating your story…</UiParagraph>
                <div class="flex gap-1.5 justify-center">
                  <span v-for="i in 3" :key="i" :class="['w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce',
                    i === 2 ? '[animation-delay:150ms]' : i === 3 ? '[animation-delay:300ms]' : '']" />
                </div>
              </div>
            </div>
          </template>

          <!-- ── STORY READY STATE ── -->
          <template v-else-if="internalState === 'story-ready' && storyResult">
            <div class="space-y-3">
              <div class="flex items-center gap-2 p-3 rounded-lg bg-success/10">
                <Icon name="i-lucide-check-circle" class="w-4 h-4 text-success shrink-0" />
                <UiParagraph size="sm" color="success">Added to your language deck.</UiParagraph>
              </div>

              <div class="space-y-1.5">
                <div v-for="(sentence, i) in storyResult.sentences" :key="i"
                  class="p-2.5 rounded-lg bg-surface-strong text-sm text-content-on-surface leading-relaxed">
                  <span class="text-content-disabled text-xs mr-1.5">{{ i + 1 }}.</span>
                  <span v-html="highlightCloze(sentence.text, sentence.clozeWord)" />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <u-button class="w-full" to="/language/review" @click="handleClose">
                  <Icon name="i-lucide-play" class="w-4 h-4 mr-1.5" />
                  Start Reviewing
                </u-button>
                <u-button variant="ghost" color="neutral" class="w-full" @click="resetToIdle">
                  <Icon name="i-lucide-rotate-ccw" class="w-3.5 h-3.5 mr-1.5" />
                  Translate another
                </u-button>
              </div>
            </div>
          </template>

          <!-- ── ERROR ── -->
          <div v-if="captureError || storyError" class="mt-1">
            <shared-error-message :error="captureError || storyError" />
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>

  <!-- Consent sheet — z-50 renders above panel (z-45) -->
  <language-consent-sheet :show="showConsentSheet" @confirm="confirmCapture" @decline="declineCapture" />
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { useSpeachToText } from '~/composables/ai/useSpeachToText';

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

const wordInput = ref('');
const contextInput = ref('');
const showContext = ref(false);
const inputContainerRef = ref<HTMLElement | null>(null);
const bodyRef = ref<HTMLElement | null>(null);

// ── Recording ─────────────────────────────────────────────────────────────────
type RecordingState = 'idle' | 'recording' | 'transcribing';
const recordingState = ref<RecordingState>('idle');
const recordingSeconds = ref(0);
let recordingTimer: ReturnType<typeof setInterval> | null = null;
let activeRecorder: MediaRecorder | null = null;
const { transcribe: _transcribe } = useSpeachToText();

const micIcon = computed(() => {
  if (recordingState.value === 'transcribing') return 'i-lucide-loader-2';
  if (recordingState.value === 'recording') return 'i-lucide-square';
  return 'i-lucide-mic';
});
const micLabel = computed(() => {
  if (recordingState.value === 'recording') return `0:${String(recordingSeconds.value).padStart(2, '0')} — Stop`;
  if (recordingState.value === 'transcribing') return 'Processing…';
  return 'Tap to speak';
});

const handleMicClick = async () => {
  if (recordingState.value === 'recording') { activeRecorder?.stop(); return; }
  if (recordingState.value !== 'idle') return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    activeRecorder = rec;
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recordingTimer !== null) { clearInterval(recordingTimer); recordingTimer = null; }
      if (chunks.length === 0) { recordingState.value = 'idle'; activeRecorder = null; return; }
      recordingState.value = 'transcribing';
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        const floatData = decoded.getChannelData(0);
        const transcript = await _transcribe(floatData);
        if (transcript) wordInput.value = transcript;
      } catch { /* STT failure non-critical */ }
      recordingState.value = 'idle';
      activeRecorder = null;
    };
    rec.start();
    recordingState.value = 'recording';
    recordingSeconds.value = 0;
    recordingTimer = setInterval(() => {
      recordingSeconds.value++;
      if (recordingSeconds.value >= 15) rec.stop();
    }, 1000);
  } catch { recordingState.value = 'idle'; }
};

// ── Actions ───────────────────────────────────────────────────────────────────
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
  if (activeRecorder) { try { activeRecorder.stop(); } catch { } activeRecorder = null; }
  if (recordingTimer !== null) { clearInterval(recordingTimer); recordingTimer = null; }
  recordingState.value = 'idle';
  recordingSeconds.value = 0;
  dismissResult();
  wordInput.value = '';
  contextInput.value = '';
  showContext.value = false;
  emit('close');
};
const highlightCloze = (text: string, clozeWord: string) => {
  const escaped = clozeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`\\b${escaped}\\b`, 'gi'),
    `<mark class="bg-primary/20 text-primary rounded px-0.5">$&</mark>`
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
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
