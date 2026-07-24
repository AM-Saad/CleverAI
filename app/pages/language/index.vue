<template>
  <div class="language-page">
    <AppPageHeader title="Language" subtitle="Capture vocabulary and practice it" back-to="/learn" />

    <LanguageCapturePanel v-model:word="queryWord" v-model:translate="translateCapturedWord" :capturing="capturing"
      :result="result" :error="captureErrorMessage" :input-placeholder="inputPlaceholder"
      :direction-label="directionLabel" :native-language-label="getLanguageLabel(nativeLanguage)"
      :translation-label="translationLabel" :example-text="firstExample?.text"
      :example-translation="firstExample?.translation" :highlighted-example-html="highlightedExampleHtml"
      @submit="capture" @reset="resetCapture" @speak="speak" />

    <section class="language-bank" aria-labelledby="language-bank-title">
      <div class="language-bank__header">
        <div>
          <UiSubtitle id="language-bank-title" tag="h2" size="base">Word bank</UiSubtitle>
          <!-- <UiParagraph size="sm" color="content-secondary">
            Browse, enrich, and add saved words to review.
          </UiParagraph> -->
        </div>
        <NuxtLink v-if="dueCount" to="/language/review" class="language-bank__review">
          Review {{ dueCount }}
          <UiIcon name="i-lucide-arrow-right" class="h-4 w-4" />
        </NuxtLink>
      </div>

      <LanguageWordBankToolbar v-model:search="wordSearch" v-model:status="statusFilter" v-model:story-only="storyOnly"
        v-model:category="categoryFilter" :status-filters="statusFilters" :categories="categoryFilters" />

      <LanguageWordBankList :rows="wordRows" :loading="loadingWords" :loading-more="loadingMoreWords"
        :has-more="hasMoreWords" :error="wordBankError" :empty-message="wordBankEmptyMessage" :deleting-id="deletingId"
        @open="openWordDetails" @enroll="enrollWord" @delete="deleteWord" @load-more="loadMoreWords" />
    </section>

    <LanguageWordDetailModal v-model:open="detailOpen" :word="selectedWord"
      :generating-story="storyBusyId === selectedWord?.id" :enrolling="enrollingId === selectedWord?.id"
      @generate-story="generateStoryFor" @enroll="enrollWord" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import LanguageCapturePanel from "~/features/language-learning/components/LanguageCapturePanel.vue";
import LanguageWordBankList from "~/features/language-learning/components/LanguageWordBankList.vue";
import LanguageWordBankToolbar from "~/features/language-learning/components/LanguageWordBankToolbar.vue";
import LanguageWordDetailModal from "~/features/language-learning/components/LanguageWordDetailModal.vue";
import { createLanguageWordRowViewModel } from "~/features/language-learning/presentation/languageWordRowViewModel";
import { useLanguageCapture } from "~/features/language-learning/composables/useLanguageCapture";
import { useLanguageLearningRuntime } from "~/features/language-learning/composables/languageLearningRuntime";
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import { useSanitize } from "~/composables/shared/useSanitize";
import {
  getLanguageLabel,
  type LanguageWord,
  type SupportedLanguageCode,
} from "@shared/utils/language.contract";

definePageMeta({ middleware: "auth" });

type StatusFilter =
  | "all"
  | "captured"
  | "story_ready"
  | "enrolled"
  | "mastered";

const { sanitizeHtml } = useSanitize();
const toast = useToast();
const route = useRoute();
const languageRuntime = useLanguageLearningRuntime();
const ttsWorker = useTextToSpeechWorker();
const {
  state: captureState,
  captureResult: result,
  captureError,
  captureWord,
  generateStory,
  dismissResult,
} = useLanguageCapture();

const queryWord = ref("");
const translateCapturedWord = ref(true);
const capturing = computed(
  () => captureState.value === "loading" || captureState.value === "saving",
);
const captureErrorMessage = computed(() => captureError.value?.message ?? null);
const preferences = languageRuntime.preferences;
const words = computed(() => languageRuntime.words.value);
const loadingWords = languageRuntime.isFetchingWords;
const loadingMoreWords = languageRuntime.isLoadingMoreWords;
const wordBankError = computed(
  () => languageRuntime.wordBankError.value?.message ?? null,
);
const dueCount = computed(() => languageRuntime.stats.value?.due ?? 0);
const hasMoreWords = languageRuntime.hasMore;
const wordSearch = ref("");
const statusFilter = ref<StatusFilter>("all");
const storyOnly = ref(false);
const categoryFilter = ref("all");
const categories = languageRuntime.categories;
const statusCounts = languageRuntime.statusCounts;
const deletingId = ref<string | null>(null);
const enrollingId = ref<string | null>(null);

const nativeLanguage = computed(
  () => (preferences.value?.nativeLanguage ?? "en") as SupportedLanguageCode,
);
const targetLanguage = computed(
  () =>
    (preferences.value?.targetLanguage ??
      nativeLanguage.value) as SupportedLanguageCode,
);
const directionLabel = computed(() =>
  targetLanguage.value === nativeLanguage.value
    ? `Auto→${getLanguageLabel(nativeLanguage.value)}`
    : `${getLanguageLabel(targetLanguage.value)}→${getLanguageLabel(nativeLanguage.value)}`,
);
const translationLabel = computed(() =>
  getLanguageLabel(nativeLanguage.value).toUpperCase(),
);
const inputPlaceholder = computed(() =>
  targetLanguage.value === "es"
    ? "aprender"
    : targetLanguage.value === "fr"
      ? "apprendre"
      : targetLanguage.value === "de"
        ? "lernen"
        : targetLanguage.value === "it"
          ? "imparare"
          : targetLanguage.value === "ar"
            ? "تعلم"
            : "Type a word or phrase",
);

const statusFilters = computed(() => [
  {
    value: "all" as const,
    label: "All",
    count:
      Object.values(statusCounts.value).reduce(
        (sum, count) => sum + count,
        0,
      ) || words.value.length,
  },
  {
    value: "captured" as const,
    label: "Saved",
    count: statusCounts.value.captured ?? 0,
  },
  {
    value: "story_ready" as const,
    label: "Stories",
    count: statusCounts.value.story_ready ?? 0,
  },
  {
    value: "enrolled" as const,
    label: "Review",
    count: statusCounts.value.enrolled ?? 0,
  },
  {
    value: "mastered" as const,
    label: "Mastered",
    count: statusCounts.value.mastered ?? 0,
  },
]);
const categoryFilters = computed(() => [
  { value: "all", label: "All categories" },
  ...categories.value.map((category) => ({
    value: category,
    label: category,
  })),
]);
const hasActiveWordFilters = computed(
  () =>
    Boolean(wordSearch.value.trim()) ||
    statusFilter.value !== "all" ||
    storyOnly.value ||
    categoryFilter.value !== "all",
);
const wordBankEmptyMessage = computed(() =>
  hasActiveWordFilters.value
    ? "No saved words match these filters."
    : "No saved words yet. Capture one to start.",
);
const wordRows = computed(() =>
  words.value.map((word) =>
    createLanguageWordRowViewModel(word, enrollingId.value),
  ),
);

const firstExample = computed(() => result.value?.examples?.[0] ?? null);
const highlightedExampleHtml = computed(() =>
  result.value && firstExample.value
    ? highlightWord(firstExample.value.text, result.value.word)
    : "",
);

function capturePayload(word: string) {
  return {
    sourceLang: targetLanguage.value,
    targetLang: nativeLanguage.value,
    includeTranslation: translateCapturedWord.value,
    forceRetranslate: false,
    sourceType: "manual" as const,
    word,
    translateOnly: false,
  };
}

async function capture() {
  const word = queryWord.value.trim();
  if (word) await captureWord(word, capturePayload(word));
}

function resetCapture() {
  dismissResult();
  queryWord.value = "";
  focusCaptureInput();
}

async function loadWords(append = false) {
  languageRuntime.setWordFilters({
    search: wordSearch.value,
    status: statusFilter.value,
    hasStory: storyOnly.value,
    category: categoryFilter.value,
  });
  return append
    ? languageRuntime.loadMoreWords()
    : languageRuntime.fetchWords();
}

async function loadMoreWords() {
  if (!hasMoreWords.value || loadingMoreWords.value) return;
  await loadWords(true);
}

function highlightWord(text: string, word: string) {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sanitizeHtml(
    text.replace(
      new RegExp(`(${safe})`, "gi"),
      '<span class="language-capture__highlight">$1</span>',
    ),
  );
}

let activeAudio: HTMLAudioElement | null = null;
async function speak(text: string) {
  try {
    const audioUrl = await ttsWorker.synthesize(text, targetLanguage.value);
    if (!audioUrl) return;
    activeAudio?.pause();
    activeAudio = new Audio(audioUrl);
    await activeAudio.play();
  } catch (error) {
    console.warn("[language] Text to speech failed", error);
  }
}

const detailOpen = ref(false);
const selectedWord = ref<LanguageWord | null>(null);
function openWordDetails(word: LanguageWord) {
  selectedWord.value = word;
  detailOpen.value = true;
}

const storyBusyId = ref<string | null>(null);
async function generateStoryFor(word: LanguageWord) {
  if (storyBusyId.value) return;
  storyBusyId.value = word.id;
  try {
    const story = await generateStory(word.id, []);
    if (story) {
      selectedWord.value = {
        ...word,
        status: word.status === "mastered" ? "mastered" : "story_ready",
        stories: [
          {
            id: story.storyId,
            storyText: story.storyText,
            sentences: story.sentences,
          },
        ],
      };
    }
  } finally {
    storyBusyId.value = null;
  }
}

async function deleteWord(word: LanguageWord) {
  if (deletingId.value) return;
  deletingId.value = word.id;
  try {
    const deleted = await languageRuntime.deleteWord(word.id);
    if (!deleted && languageRuntime.wordBankError.value) {
      toast.add({
        title: "Could not delete word",
        description: languageRuntime.wordBankError.value.message,
        color: "error",
      });
    }
  } finally {
    deletingId.value = null;
  }
}

async function enrollWord(word: LanguageWord) {
  if (
    enrollingId.value ||
    word.status === "mastered" ||
    word.status === "enrolled"
  )
    return;
  enrollingId.value = word.id;
  try {
    const enrolled = await languageRuntime.enrollWord(word.id);
    if (!enrolled && languageRuntime.wordBankError.value) {
      toast.add({
        title: "Could not add word to review",
        description: languageRuntime.wordBankError.value.message,
        color: "error",
      });
    }
    selectedWord.value =
      words.value.find((item) => item.id === word.id) ??
      (selectedWord.value?.id === word.id
        ? { ...selectedWord.value, status: "enrolled" }
        : selectedWord.value);
  } finally {
    enrollingId.value = null;
  }
}

let wordFilterTimer: ReturnType<typeof setTimeout> | null = null;
watch([wordSearch, statusFilter, storyOnly, categoryFilter], () => {
  if (wordFilterTimer) clearTimeout(wordFilterTimer);
  wordFilterTimer = setTimeout(() => void loadWords(), 250);
});

const lastComposeToken = ref("");
function focusCaptureInput() {
  if (import.meta.client && window.matchMedia("(pointer: coarse)").matches)
    return;
  nextTick(() => {
    (
      document.querySelector(
        ".language-capture__search-input input",
      ) as HTMLInputElement | null
    )?.focus();
  });
}

function consumeComposeRoute(value: typeof route.query.compose) {
  const compose = Array.isArray(value) ? value[0] : value;
  if (!compose) return;
  const token = `${compose}:${route.query.capture ?? ""}`;
  if (lastComposeToken.value === token) return;
  lastComposeToken.value = token;
  focusCaptureInput();
}

watch([() => route.query.compose, () => route.query.capture], ([compose]) =>
  consumeComposeRoute(compose),
);
watch(languageRuntime.wordBankRevision, () => {
  void Promise.all([loadWords(), languageRuntime.refreshStats()]);
});
watch(words, (currentWords) => {
  if (!selectedWord.value) return;
  selectedWord.value =
    currentWords.find((word) => word.id === selectedWord.value?.id) ??
    selectedWord.value;
});

onMounted(async () => {
  await languageRuntime.ensurePreferences();
  translateCapturedWord.value = preferences.value?.translateOnCapture ?? true;
  await Promise.all([loadWords(), languageRuntime.refreshStats()]);
  consumeComposeRoute(route.query.compose);
});

onBeforeUnmount(() => {
  if (wordFilterTimer) clearTimeout(wordFilterTimer);
  activeAudio?.pause();
  if (import.meta.client && "speechSynthesis" in window)
    window.speechSynthesis.cancel();
});
</script>

<style scoped>
.language-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-6);
}

.language-bank {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-2);
}

.language-bank__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.language-bank__review {
  display: inline-flex;
  min-height: var(--target-touch);
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--text-xs);
  font-weight: 800;
}

@media (max-width: 639px) {
  .language-bank__header {
    align-items: flex-start;
  }
}
</style>
