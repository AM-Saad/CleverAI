<template>
  <div class="w-full max-w-2xl mx-auto select-none">
    <!-- Front face (cloze blank) -->
    <div v-if="!showAnswer" class="space-y-4">
      <!-- Word + meta -->
      <div class="text-center space-y-1">
        <UiSubtitle size="2xl" weight="bold">{{ card.word }}</UiSubtitle>
        <UiParagraph size="sm" color="content-secondary" class="uppercase tracking-wide">
          {{ card.sourceLang }} — fill in the blank
        </UiParagraph>
      </div>

      <!-- Cloze sentence -->
      <div v-if="clozeSentence"
        class="p-5 rounded-[var(--radius-xl)] bg-surface-strong text-center text-lg leading-relaxed text-content-on-surface">
        {{ clozeSentence.text.replace(clozeSentence.clozeWord, clozeSentence.clozeBlank) }}
      </div>
      <div v-else class="p-5 rounded-[var(--radius-xl)] bg-surface-strong text-center text-content-secondary italic">
        No story generated yet.
      </div>

      <!-- Translation hint toggle -->
      <div class="flex justify-center">
        <button type="button"
          class="text-xs text-content-secondary hover:text-primary transition-colors flex items-center gap-1"
          @click="showHint = !showHint">
          <Icon name="i-lucide-eye" class="w-3 h-3" />
          {{ showHint ? 'Hide' : 'Show' }} translation hint
        </button>
      </div>
      <Transition name="fade">
        <div v-if="showHint" class="text-center text-primary font-medium">
          {{ card.translation }}
        </div>
      </Transition>

      <!-- Reveal -->
      <div class="flex justify-center pt-2">
        <u-button size="lg" class="px-8" @click="emit('reveal')">
          <Icon name="i-lucide-eye" class="w-4 h-4 mr-1" />
          Show Answer
        </u-button>
      </div>
    </div>

    <!-- Back face (full answer) -->
    <div v-else class="space-y-5">
      <!-- Word + translation -->
      <div class="text-center space-y-1">
        <UiSubtitle size="2xl" weight="bold">{{ card.word }}</UiSubtitle>
        <UiSubtitle size="xl" color="primary">{{ card.translation }}</UiSubtitle>
        <UiParagraph size="sm" color="content-secondary" class="uppercase tracking-wide">{{ card.sourceLang }}
        </UiParagraph>
      </div>

      <!-- Full story with highlighted cloze word -->
      <div v-if="clozeSentence" class="p-5 rounded-[var(--radius-xl)] bg-surface-strong text-lg leading-relaxed">
        <span v-html="highlightCloze(clozeSentence.text, clozeSentence.clozeWord)" />
      </div>

      <!-- Other sentences (dimmed context) -->
      <div v-if="otherSentences.length" class="space-y-2">
        <div v-for="(s, i) in otherSentences" :key="i"
          class="px-4 py-2 rounded-[var(--radius-md)] bg-surface border border-secondary">
          <UiParagraph size="sm" color="content-secondary">{{ s.text }}</UiParagraph>
        </div>
      </div>

      <!-- TTS -->
      <div class="flex justify-center">
        <u-button variant="ghost" color="neutral" size="sm" :loading="isSpeaking" @click="emit('speak', card.word)">
          <Icon name="i-lucide-volume-2" class="w-4 h-4 mr-1" />
          Hear it
        </u-button>
      </div>

      <!-- Grade buttons -->
      <div class="space-y-3">
        <!-- Star rating (visual only, maps to grade) -->
        <div class="flex justify-center gap-2">
          <button v-for="star in 3" :key="star" type="button" :class="[
            'transition-colors',
            hoverStar >= star ? 'text-yellow-400' : 'text-content-disabled',
          ]" @mouseenter="hoverStar = star" @mouseleave="hoverStar = 0" @click="gradeFromStar(star)">
            <Icon name="i-lucide-star" class="w-6 h-6" :class="hoverStar >= star ? 'fill-yellow-400' : ''" />
          </button>
        </div>

        <!-- Explicit grade buttons (SM-2: 0–5) -->
        <div class="grid grid-cols-3 gap-2">
          <u-button v-for="btn in gradeButtons" :key="btn.value" :variant="btn.variant" :color="btn.color" size="sm"
            class="text-xs" :loading="isGrading" @click="emit('grade', btn.value)">
            {{ btn.label }}
          </u-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LanguageQueueCard } from "~/shared/utils/language.contract";

const props = defineProps<{
  card: LanguageQueueCard;
  showAnswer: boolean;
  isGrading?: boolean;
  isSpeaking?: boolean;
}>();

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "grade", value: "0" | "1" | "2" | "3" | "4" | "5"): void;
  (e: "speak", word: string): void;
}>();

const showHint = ref(false);
const hoverStar = ref(0);

// Pick the first sentence (index 0) as the cloze sentence
const clozeSentence = computed(() => {
  const sents = props.card.sentences;
  if (!sents?.length) return null;
  return sents[0];
});

const otherSentences = computed(() => {
  const sents = props.card.sentences;
  if (!sents || sents.length <= 1) return [];
  return sents.slice(1);
});

const gradeButtons = [
  { value: "0" as const, label: "Blackout", variant: "soft" as const, color: "error" as const },
  { value: "1" as const, label: "Wrong", variant: "soft" as const, color: "error" as const },
  { value: "2" as const, label: "Hard recall", variant: "soft" as const, color: "warning" as const },
  { value: "3" as const, label: "Correct (effort)", variant: "soft" as const, color: "warning" as const },
  { value: "4" as const, label: "Correct", variant: "soft" as const, color: "success" as const },
  { value: "5" as const, label: "Easy", variant: "soft" as const, color: "success" as const },
];

const gradeFromStar = (star: number) => {
  // 1 star → grade 2, 2 stars → grade 3, 3 stars → grade 5
  const map: Record<number, "2" | "3" | "5"> = { 1: "2", 2: "3", 3: "5" };
  emit("grade", map[star]);
};

const highlightCloze = (text: string, clozeWord: string) => {
  const escaped = clozeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`\\b${escaped}\\b`, "gi"),
    `<mark class="bg-primary/20 text-primary rounded px-0.5 font-semibold">$&</mark>`
  );
};

// Reset hint when card changes
watch(() => props.card.cardId, () => {
  showHint.value = false;
  hoverStar.value = 0;
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
