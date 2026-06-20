<template>
  <div class="w-full max-w-2xl mx-auto select-none">
    <!-- Front face (cloze blank) -->
    <div v-if="!showAnswer" class="space-y-4">
      <!-- Word + meta -->
      <div class="text-center space-y-1">
        <UiSubtitle size="2xl" weight="bold">{{ card.word }}</UiSubtitle>
        <UiParagraph
          size="sm"
          color="content-secondary"
          class="uppercase tracking-wide"
        >
          {{ card.sourceLang }} — fill in the blank
        </UiParagraph>
      </div>

      <!-- Cloze sentence -->
      <UiPanel
        v-if="clozeSentence"
        variant="subtle"
        size="lg"
        content-class="text-center text-lg leading-relaxed text-content-on-surface"
      >
        {{
          clozeSentence.text.replace(
            clozeSentence.clozeWord,
            clozeSentence.clozeBlank,
          )
        }}
      </UiPanel>
      <UiPanel
        v-else
        variant="subtle"
        size="lg"
        content-class="text-center text-content-secondary italic"
      >
        What does "{{ card.word }}" mean?
      </UiPanel>

      <!-- Translation hint toggle -->
      <div class="flex justify-center">
        <button
          type="button"
          class="text-xs text-content-secondary hover:text-primary transition-colors flex items-center gap-1"
          @click="showHint = !showHint"
        >
          <Icon name="i-lucide-eye" class="w-3 h-3" />
          {{ showHint ? "Hide" : "Show" }} translation hint
        </button>
      </div>
      <Transition name="fade">
        <div v-if="showHint" class="text-center text-primary font-medium">
          {{ card.translation }}
        </div>
      </Transition>
    </div>

    <!-- Back face (full answer) -->
    <div v-else class="space-y-5">
      <!-- Word + translation -->
      <div class="text-center space-y-1">
        <UiSubtitle size="2xl" weight="bold">{{ card.word }}</UiSubtitle>
        <UiSubtitle size="xl" color="primary">{{
          card.translation
        }}</UiSubtitle>
        <UiParagraph
          size="sm"
          color="content-secondary"
          class="uppercase tracking-wide"
          >{{ card.sourceLang }}
        </UiParagraph>
      </div>

      <!-- Full story with highlighted cloze word -->
      <UiPanel
        v-if="clozeSentence"
        variant="subtle"
        size="lg"
        content-class="text-lg leading-relaxed"
      >
        <span
          v-html="highlightCloze(clozeSentence.text, clozeSentence.clozeWord)"
        />
      </UiPanel>

      <!-- Other sentences (dimmed context) -->
      <div v-if="!clozeSentence" class="text-center">
        <UiParagraph size="sm" color="content-secondary">
          Review this word directly. Generate a story later for cloze practice.
        </UiParagraph>
      </div>

      <div v-if="otherSentences.length" class="space-y-2">
        <UiPanel
          v-for="(s, i) in otherSentences"
          :key="i"
          variant="surface"
          size="xs"
        >
          <UiParagraph size="sm" color="content-secondary">{{
            s.text
          }}</UiParagraph>
        </UiPanel>
      </div>

      <!-- TTS -->
      <div class="flex flex-wrap justify-center gap-2">
        <ui-button
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="isSpeaking"
          @click="emit('speak', card.word)"
        >
          <Icon name="i-lucide-volume-2" class="w-4 h-4 mr-1" />
          Hear it
        </ui-button>
        <ui-button
          v-if="card.storyText"
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="isSpeaking"
          @click="emit('speak', card.storyText)"
        >
          <Icon name="i-lucide-book-audio" class="w-4 h-4 mr-1" />
          Hear story
        </ui-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LanguageQueueCard } from "~/shared/utils/language.contract";
import { useSanitize } from "~/composables/shared/useSanitize";

const props = defineProps<{
  card: LanguageQueueCard;
  showAnswer: boolean;
  isSpeaking?: boolean;
}>();

const emit = defineEmits<{
  (e: "speak", word: string): void;
}>();

const showHint = ref(false);
const { sanitizeHtml } = useSanitize();

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

const highlightCloze = (text: string, clozeWord: string) => {
  const escaped = clozeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sanitizeHtml(
    text.replace(
      new RegExp(`\\b${escaped}\\b`, "gi"),
      `<mark class="bg-primary/20 text-primary rounded-[var(--radius-md)] px-0.5 font-semibold">$&</mark>`,
    ),
  );
};

// Reset hint when card changes
watch(
  () => props.card.cardId,
  () => {
    showHint.value = false;
  },
);
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
