<template>
  <UiModal v-model:open="open" :title="word?.word ?? 'Word details'" :description="word ? detailSubtitle : undefined"
    icon="document">
    <div v-if="word" class="word-detail">
      <div class="word-detail__hero">
        <div>
          <div class="word-detail__word-row">
            <UiTitle tag="h3" size="lg" dir="auto">{{ word.word }}</UiTitle>
            <UiPill :label="statusLabel" :color="statusColor" size="sm" variant="outline" active max-width="120px" />
          </div>
          <UiParagraph v-if="word.phonetic" size="sm" color="content-secondary">
            {{ word.phonetic }}
          </UiParagraph>
        </div>
        <UiIconButton icon="i-lucide-volume-2" :label="`Hear ${word.word}`" :loading="speakingWord" @click="hearWord" />
      </div>

      <UiPanel v-if="word.translation" variant="subtle" size="sm">
        <UiLabel>Translation · {{ translationLanguage }}</UiLabel>
        <UiTitle tag="div" size="lg" dir="auto">{{ word.translation }}</UiTitle>
      </UiPanel>

      <section class="word-detail__section">
        <UiSubtitle tag="h4" size="sm">Definition</UiSubtitle>
        <div v-if="word.meanings?.length" class="word-detail__stack">
          <UiPanel v-for="(meaning, index) in word.meanings" :key="`${word.id}:meaning:${index}`" variant="surface"
            size="sm">
            <div class="word-detail__meaning-head">
              <span>{{ index + 1 }}</span>
              <UiPill v-if="meaning.partOfSpeech" :label="meaning.partOfSpeech" size="sm" max-width="120px" />
            </div>
            <UiParagraph dir="auto">{{ meaning.definition }}</UiParagraph>
            <UiParagraph v-if="meaning.translation" size="sm" color="primary" dir="auto">
              {{ meaning.translation }}
            </UiParagraph>
            <UiParagraph v-if="meaning.example" size="sm" color="content-secondary" dir="auto">
              “{{ meaning.example }}”
            </UiParagraph>
          </UiPanel>
        </div>
        <UiAlert v-else tone="neutral" title="No generated definition"
          description="Capture this word again with translation enabled to enrich its lexical details." />
      </section>

      <section v-if="word.examples?.length" class="word-detail__section">
        <UiSubtitle tag="h4" size="sm">Examples</UiSubtitle>
        <UiPanel v-for="(example, index) in word.examples" :key="`${word.id}:example:${index}`" variant="subtle"
          size="sm">
          <UiParagraph dir="auto">{{ example.text }}</UiParagraph>
          <UiParagraph v-if="example.translation" size="sm" color="content-secondary" dir="auto">
            {{ example.translation }}
          </UiParagraph>
        </UiPanel>
      </section>

      <section class="word-detail__section">
        <div class="word-detail__section-head">
          <div>
            <UiSubtitle tag="h4" size="sm">Story</UiSubtitle>
            <UiParagraph size="xs" color="content-secondary">
              Written in {{ learnedLanguage }}
            </UiParagraph>
          </div>
          <UiButton size="sm" variant="soft" tone="primary" leading-icon="i-lucide-sparkles" :loading="generatingStory"
            @click="emit('generate-story', word)">
            {{ story ? "Regenerate story" : "Generate story" }}
          </UiButton>
        </div>

        <UiPanel v-if="story" variant="surface" size="sm">
          <div class="word-detail__story-head">
            <UiPill label="Learning story" color="var(--color-primary)" size="sm" max-width="140px" />
            <UiIconButton icon="i-lucide-book-audio" label="Hear story" size="sm" :loading="speakingStory"
              @click="hearStory" />
          </div>
          <UiParagraph class="word-detail__story" dir="auto">
            {{ cleanStoryText(story.storyText) }}
          </UiParagraph>
        </UiPanel>
        <UiParagraph v-else size="sm" color="content-secondary">
          No story yet. Generate one when you deliberately want a learning
          context for this word.
        </UiParagraph>
      </section>

      <section class="word-detail__section">
        <UiSubtitle tag="h4" size="sm">Word information</UiSubtitle>
        <dl class="word-detail__metadata">
          <template v-for="item in metadataItems" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd dir="auto">{{ item.value }}</dd>
          </template>
        </dl>
        <UiPanel v-if="word.sourceContext" variant="subtle" size="sm">
          <UiLabel>Captured context</UiLabel>
          <UiParagraph size="sm" dir="auto">
            {{ word.sourceContext }}
          </UiParagraph>
        </UiPanel>
      </section>
    </div>

    <template #footer>
      <div v-if="word" class="word-detail__footer">
        <UiButton variant="ghost" tone="neutral" @click="open = false">
          Close
        </UiButton>
        <UiButton v-if="canEnroll" tone="primary" leading-icon="i-lucide-book-plus" :loading="enrolling"
          @click="emit('enroll', word)">
          Add to review
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { LanguageWord } from "@shared/utils/language.contract";
import {
  getLanguageLabel,
  type LanguageStoryPreview,
} from "@shared/utils/language.contract";
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";

const open = defineModel<boolean>("open", { default: false });
const props = withDefaults(
  defineProps<{
    word: LanguageWord | null;
    generatingStory?: boolean;
    enrolling?: boolean;
  }>(),
  {
    generatingStory: false,
    enrolling: false,
  },
);
const emit = defineEmits<{
  (event: "generate-story", word: LanguageWord): void;
  (event: "enroll", word: LanguageWord): void;
}>();

const ttsWorker = useTextToSpeechWorker();
const speakingWord = ref(false);
const speakingStory = ref(false);
let activeAudio: HTMLAudioElement | null = null;

const word = computed(() => props.word);
const story = computed<LanguageStoryPreview | null>(
  () => word.value?.stories?.[0] ?? null,
);
const canEnroll = computed(
  () =>
    Boolean(word.value) &&
    word.value?.status !== "enrolled" &&
    word.value?.status !== "mastered",
);
const learnedLanguage = computed(() =>
  getLanguageLabel(word.value?.sourceLang ?? "auto"),
);
const translationLanguage = computed(() =>
  getLanguageLabel(word.value?.translationLang ?? "en"),
);
const detailSubtitle = computed(
  () =>
    `${learnedLanguage.value} vocabulary · captured ${formatDate(
      word.value?.createdAt,
    )}`,
);
const statusLabel = computed(() =>
  (word.value?.status ?? "captured").replace(/_/g, " "),
);
const statusColor = computed(() => {
  if (word.value?.status === "mastered") return "var(--color-success)";
  if (word.value?.status === "enrolled") return "var(--color-primary)";
  if (word.value?.status === "story_ready") return "var(--color-warning)";
  return "var(--color-content-secondary)";
});
const metadataItems = computed(() => {
  if (!word.value) return [];
  const base = [
    { label: "Part of speech", value: word.value.partOfSpeech },
    { label: "Category", value: word.value.category },
    { label: "Difficulty", value: word.value.difficulty },
    { label: "Source", value: word.value.sourceType },
    {
      label: "Entry type",
      value: word.value.isPhrase ? "Phrase" : "Word",
    },
  ];
  const metadata = Object.entries(word.value.metadata ?? {})
    .filter(
      ([key, value]) =>
        !key.toLowerCase().endsWith("id") &&
        ["string", "number", "boolean"].includes(typeof value),
    )
    .map(([key, value]) => ({
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase()),
      value: String(value),
    }));
  return [...base, ...metadata].filter(
    (item): item is { label: string; value: string } =>
      typeof item.value === "string" && item.value.length > 0,
  );
});

function formatDate(value?: Date | string) {
  if (!value) return "recently";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "recently"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

const cleanStoryText = (text: string) =>
  text.replace(/\[\[CLOZE:([^\]]+)\]\]/g, "$1");

async function play(text: string, language: string, storyAudio = false) {
  if (storyAudio) speakingStory.value = true;
  else speakingWord.value = true;
  try {
    const audioUrl = await ttsWorker.synthesize(text, language);
    if (!audioUrl) return;
    activeAudio?.pause();
    activeAudio = new Audio(audioUrl);
    await activeAudio.play();
  } catch (error) {
    console.warn("[language] Detail audio failed", error);
  } finally {
    speakingWord.value = false;
    speakingStory.value = false;
  }
}

function hearWord() {
  if (!word.value) return;
  void play(word.value.word, word.value.sourceLang);
}

function hearStory() {
  if (!word.value || !story.value) return;
  void play(cleanStoryText(story.value.storyText), word.value.sourceLang, true);
}

watch(open, (isOpen) => {
  if (!isOpen) activeAudio?.pause();
});
onBeforeUnmount(() => activeAudio?.pause());
</script>

<style scoped>
.word-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.word-detail__hero,
.word-detail__word-row,
.word-detail__section-head,
.word-detail__story-head,
.word-detail__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.word-detail__word-row {
  justify-content: flex-start;
}

.word-detail__section,
.word-detail__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--ds-surface-card);
  gap: var(--space-4);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  margin: var(--space-2);
}

.word-detail__meaning-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-content-disabled);
  font-size: 12px;
  font-weight: 800;
}

.word-detail__story {
  margin-top: var(--space-2);
  line-height: 1.8;
}

.word-detail__metadata {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
}

.word-detail__metadata dt {
  color: var(--color-content-secondary);
  font-size: 12px;
}

.word-detail__metadata dd {
  color: var(--color-content-on-surface);
  font-size: 13px;
  font-weight: 700;
}

.word-detail__footer {
  justify-content: flex-end;
  width: 100%;
}
</style>
