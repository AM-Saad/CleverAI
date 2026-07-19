<template>
  <div class="lang">
    <header class="lang__header">
      <ui-title tag="h1" class="lang__title">Language</ui-title>
    </header>

    <section class="lang__capture" aria-labelledby="language-capture-title">
      <div class="lang__section-head">
        <div>
          <UiSubtitle id="language-capture-title" tag="h2" size="base">
            Capture a word
          </UiSubtitle>
          <UiParagraph size="sm" color="content-secondary">
            Save new vocabulary now; translation is optional.
          </UiParagraph>
        </div>
        <span class="lang__capture-icon" aria-hidden="true">
          <UiIcon name="i-lucide-bookmark-plus" class="h-5 w-5" />
        </span>
      </div>

      <form class="lang__capture-form" @submit.prevent="capture">
        <div class="lang__search">
          <UiInput
            v-model="queryWord"
            :placeholder="inputPlaceholder"
            icon="i-lucide-bookmark-plus"
            class="lang__search-input"
            aria-label="Word or phrase to capture"
          />
          <span class="lang__dir">{{ directionLabel }}</span>
        </div>
        <div class="lang__capture-options">
          <UiCheckbox
            v-model="translateCapturedWord"
            :label="`Translate into ${getLanguageLabel(nativeLanguage)}`"
            description="Capture always adds the word to your word bank"
            :disabled="capturing"
          />
          <UiButton
            pill
            tone="primary"
            type="submit"
            leading-icon="i-lucide-bookmark-plus"
            :loading="capturing"
            :disabled="!queryWord.trim()"
          >
            Capture word
          </UiButton>
        </div>
      </form>

      <div v-if="capturing" class="lang__loading">
        <AiShimmer :lines="2" />
      </div>

      <UiCard
        v-else-if="result"
        variant="default"
        shadow="sm"
        class-name="lang__result"
      >
        <div class="lang__word-row">
          <ui-title tag="h2" class="lang__word" dir="auto">{{
            result.word
          }}</ui-title>
          <span v-if="result.partOfSpeech" class="lang__pos">{{
            result.partOfSpeech
          }}</span>
        </div>
        <div v-if="result.phonetic" class="lang__ipa">
          {{ result.phonetic }}
          <button
            type="button"
            class="lang__play"
            aria-label="Play pronunciation"
            @click="speak(result.word)"
          >
            <!-- design-allow: native audio control -->
            <UiIcon name="i-lucide-volume-2" class="h-4 w-4" />
          </button>
        </div>

        <!-- brand-gradient reward reveal (vivid full band, white text) -->
        <RewardGradient v-if="result.translation" class="lang__reveal">
          <span class="lang__reveal-label">{{ translationLabel }}</span>
          <p class="lang__reveal-text" dir="auto">{{ result.translation }}</p>
        </RewardGradient>

        <div v-if="firstExample" class="lang__example">
          <span class="lang__example-label">EXAMPLE</span>
          <p
            class="lang__example-src"
            dir="auto"
            v-html="highlightWord(firstExample.text, result.word)"
          />
          <p
            v-if="firstExample.translation"
            class="lang__example-tr"
            dir="auto"
          >
            {{ firstExample.translation }}
          </p>
        </div>

        <div class="lang__save">
          <UiPill
            label="Saved to word bank"
            color="var(--color-success)"
            variant="soft"
            active
            max-width="180px"
          />
          <UiButton
            pill
            tone="neutral"
            variant="ghost"
            leading-icon="i-lucide-rotate-ccw"
            @click="resetCapture"
          >
            Capture another
          </UiButton>
        </div>
      </UiCard>

      <p v-else-if="captureErrorMessage" class="lang__err">
        {{ captureErrorMessage }}
      </p>
    </section>

    <section class="lang__bank" aria-labelledby="language-bank-title">
      <div class="lang__section-head">
        <div>
          <UiSubtitle id="language-bank-title" tag="h2" size="base">
            Word bank
          </UiSubtitle>
          <UiParagraph size="sm" color="content-secondary">
            Browse, enrich, and add saved words to review.
          </UiParagraph>
        </div>
        <NuxtLink
          v-if="dueCount"
          to="/language/review"
          class="lang__review-link"
        >
          Review {{ dueCount }}
          <UiIcon name="i-lucide-arrow-right" class="h-4 w-4" />
        </NuxtLink>
      </div>

      <section class="lang__bank-tools" aria-label="Word bank filters">
        <UiInput
          v-model="wordSearch"
          type="search"
          icon="i-lucide-search"
          placeholder="Search saved words…"
        />
        <div class="lang__filter-row" role="tablist" aria-label="Word status">
          <UiPill
            v-for="filter in statusFilters"
            :key="filter.value"
            clickable
            role="tab"
            :aria-selected="statusFilter === filter.value"
            :active="statusFilter === filter.value"
            :label="filter.label"
            color="var(--color-primary)"
            variant="outline"
            size="sm"
            max-width="140px"
            @click="statusFilter = filter.value"
          >
            <template #icon>
              <span class="lang__filter-count">{{ filter.count }}</span>
            </template>
          </UiPill>
        </div>
        <div
          class="lang__filter-row lang__filter-row--compact"
          aria-label="Additional filters"
        >
          <UiPill
            clickable
            selectable
            :active="storyOnly"
            label="Stories"
            color="var(--color-primary)"
            variant="outline"
            size="sm"
            max-width="100px"
            @click="storyOnly = !storyOnly"
          />
          <UiPill
            v-for="category in categoryFilters"
            :key="category"
            clickable
            selectable
            :active="categoryFilter === category"
            :label="category === 'all' ? 'All categories' : category"
            color="var(--color-primary)"
            variant="outline"
            size="sm"
            max-width="140px"
            @click="categoryFilter = category"
          />
        </div>
      </section>

      <div v-if="loadingWords && !words.length" class="lang__list">
        <UiSkeleton
          v-for="i in 5"
          :key="i"
          class="h-14 w-full rounded-[var(--radius-2xl)]"
        />
      </div>
      <p v-else-if="wordBankError" class="lang__err">{{ wordBankError }}</p>
      <div v-else-if="!words.length" class="lang__empty">
        <UiIcon
          name="i-lucide-book-open"
          class="h-9 w-9 text-content-disabled"
        />
        <p>{{ wordBankEmptyMessage }}</p>
      </div>
      <ul v-else class="lang__list">
        <li
          v-for="w in words"
          :key="w.id"
          class="lang__bank-row lang__bank-row--story"
          :style="{ '--bar': accentVarFor(w.word) }"
        >
          <button
            type="button"
            class="lang__bank-open"
            :aria-label="`Open details for ${w.word}`"
            @click="openWordDetails(w)"
          >
            <span class="lang__bank-main">
              <span class="lang__bank-word">{{ w.word }}</span>
              <span class="lang__bank-gloss"
                >{{ w.translation
                }}<template v-if="w.partOfSpeech">
                  · {{ w.partOfSpeech }}</template
                ></span
              >
            </span>
            <UiIcon
              name="i-lucide-chevron-right"
              class="lang__bank-story h-4 w-4"
            />
          </button>
          <UiPill
            size="sm"
            :label="badgeText(w)"
            :color="badgeColor(w)"
            variant="outline"
            active
            max-width="100px"
          />
          <div class="lang__bank-actions" @click.stop>
            <button
              type="button"
              class="lang__mini-action"
              :disabled="
                enrollingId === w.id ||
                w.status === 'mastered' ||
                w.status === 'enrolled'
              "
              @click="enrollWord(w)"
            >
              <!-- design-allow: functional CTA, not a status chip -->
              {{
                enrollingId === w.id
                  ? "Adding…"
                  : w.status === "enrolled"
                    ? "In review"
                    : "Review"
              }}
            </button>
            <UiDoubleTapDeleteButton
              unstyled
              class="lang__mini-action lang__mini-action--danger"
              :label="deletingId === w.id ? 'Deleting…' : 'Delete'"
              armed-label="Tap again"
              :loading="deletingId === w.id"
              :disabled="Boolean(deletingId && deletingId !== w.id)"
              :reset-key="w.id"
              @confirm="deleteWord(w)"
            />
          </div>
        </li>
      </ul>

      <UiButton
        v-if="hasMoreWords"
        pill
        block
        tone="neutral"
        variant="soft"
        :loading="loadingMoreWords"
        @click="loadMoreWords"
      >
        Load more words
      </UiButton>
    </section>

    <LanguageWordDetailModal
      v-model:open="detailOpen"
      :word="selectedWord"
      :generating-story="storyBusyId === selectedWord?.id"
      :enrolling="enrollingId === selectedWord?.id"
      @generate-story="generateStoryFor"
      @enroll="enrollWord"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  onBeforeUnmount,
  onMounted,
  nextTick,
  watch,
} from "vue";
import RewardGradient from "~/components/ui/RewardGradient.vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";
import LanguageWordDetailModal from "~/features/language-learning/components/LanguageWordDetailModal.vue";
import { useLanguageCapture } from "~/features/language-learning/composables/useLanguageCapture";
import { useLanguageLearningRuntime } from "~/features/language-learning/composables/languageLearningRuntime";
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import { accentVarFor } from "~/composables/useAccentColor";
import { useSanitize } from "~/composables/shared/useSanitize";
import {
  getLanguageLabel,
  type LanguageWord,
  type SupportedLanguageCode,
} from "@shared/utils/language.contract";

const { sanitizeHtml } = useSanitize();
const toast = useToast();
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

definePageMeta({ middleware: "auth" });

const queryWord = ref("");
const capturing = computed(
  () => captureState.value === "loading" || captureState.value === "saving",
);
const captureErrorMessage = computed(() => captureError.value?.message ?? null);
const preferences = languageRuntime.preferences;
const translateCapturedWord = ref(true);

const words = computed(() => languageRuntime.words.value);
const loadingWords = languageRuntime.isFetchingWords;
const loadingMoreWords = languageRuntime.isLoadingMoreWords;
const wordBankError = computed(
  () => languageRuntime.wordBankError.value?.message ?? null,
);
const dueCount = computed(() => languageRuntime.stats.value?.due ?? 0);
const hasMoreWords = languageRuntime.hasMore;
const wordSearch = ref("");
const statusFilter = ref<
  "all" | "captured" | "story_ready" | "enrolled" | "mastered"
>("all");
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
  "all",
  ...categories.value.slice(0, 5),
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

const firstExample = computed(() => result.value?.examples?.[0] ?? null);

async function capture() {
  const word = queryWord.value.trim();
  if (!word) return;
  await captureWord(word, capturePayload(word));
}

function resetCapture() {
  dismissResult();
  queryWord.value = "";
  focusCaptureInput();
}

async function loadPreferences() {
  return languageRuntime.ensurePreferences();
}

async function loadStats() {
  return languageRuntime.refreshStats();
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

function badgeText(w: LanguageWord) {
  if (w.status === "mastered") return "mastered";
  return w.status.replace("_", " ");
}
function badgeColor(w: LanguageWord) {
  if (w.status === "mastered") return "var(--color-success)";
  if (w.status === "enrolled") return "var(--color-primary)";
  if (w.status === "story_ready") return "var(--color-warning)";
  return "var(--color-content-secondary)";
}

function highlightWord(text: string, word: string) {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sanitizeHtml(
    text.replace(
      new RegExp(`(${safe})`, "gi"),
      '<span class="lang__hl">$1</span>',
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
async function generateStoryFor(w: LanguageWord) {
  if (storyBusyId.value) return;
  storyBusyId.value = w.id;
  try {
    const story = await generateStory(w.id, []);
    if (story) {
      selectedWord.value = {
        ...w,
        status: w.status === "mastered" ? "mastered" : "story_ready",
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
  wordFilterTimer = setTimeout(() => {
    void loadWords();
  }, 250);
});

const route = useRoute();
const lastComposeToken = ref("");

function focusCaptureInput() {
  if (import.meta.client && window.matchMedia("(pointer: coarse)").matches)
    return;
  nextTick(() => {
    (
      document.querySelector(
        ".lang__search-input input",
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
  void Promise.all([loadWords(), loadStats()]);
});

watch(words, (currentWords) => {
  if (!selectedWord.value) return;
  selectedWord.value =
    currentWords.find((word) => word.id === selectedWord.value?.id) ??
    selectedWord.value;
});

onMounted(async () => {
  await loadPreferences();
  translateCapturedWord.value = preferences.value?.translateOnCapture ?? true;
  await Promise.all([loadWords(), loadStats()]);
  // Capture-word entry from the FAB: focus on pointer-precise devices without
  // forcing the mobile keyboard open.
  consumeComposeRoute(route.query.compose);
});

onBeforeUnmount(() => {
  if (wordFilterTimer) clearTimeout(wordFilterTimer);
  activeAudio?.pause();
  if (import.meta.client && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});
</script>

<style scoped>
.lang {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
.lang__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-2);
}
.lang__title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.lang__capture,
.lang__bank {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.lang__capture {
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  box-shadow: var(--shadow-card);
}
.lang__bank {
  padding-top: var(--space-2);
}
.lang__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.lang__capture-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}
.lang__review-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--target-touch);
  padding: 0 14px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning-text);
  font-size: 12px;
  font-weight: 800;
}
.lang__search {
  position: relative;
  display: flex;
  align-items: center;
}
.lang__capture-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.lang__capture-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.lang__search-input {
  width: 100%;
}
.lang__dir {
  position: absolute;
  right: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--color-content-secondary);
}
.lang__loading {
  padding: var(--space-4) 0;
}
.lang__word-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.lang__word {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.lang__pos {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
}
.lang__ipa {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 14px;
  color: var(--color-content-secondary);
}
.lang__play {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  color: var(--color-primary);
  background: var(--color-primary-50);
}
.lang__reveal {
  margin-top: var(--space-4);
  border-radius: var(--radius-2xl);
  padding: var(--space-4);
}
.lang__reveal-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: color-mix(in srgb, var(--color-white) 78%, transparent);
}
.lang__reveal-text {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--color-white);
}
.lang__example {
  margin-top: var(--space-4);
}
.lang__example-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.lang__example-src {
  font-size: 15px;
  line-height: 1.5;
  color: var(--color-content-on-surface-strong);
  margin-top: 2px;
}
.lang__example-src :deep(.lang__hl) {
  color: var(--color-primary);
  font-weight: 700;
}
.lang__example-tr {
  font-size: 14px;
  color: var(--color-content-secondary);
  margin-top: 2px;
}
.lang__save {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
.lang__err {
  text-align: center;
  color: var(--color-error-text);
  font-size: 14px;
  padding: var(--space-4);
}
.lang__bank-tools {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  box-shadow: var(--shadow-card);
}
.lang__filter-row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.lang__filter-row::-webkit-scrollbar {
  display: none;
}
.lang__filter-row--compact {
  gap: 5px;
}
.lang__filter-count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  background: color-mix(
    in srgb,
    var(--color-content-on-background) 7%,
    transparent
  );
  font-size: 10px;
  text-align: center;
}
.lang__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  padding: 0;
  margin: 0;
}
.lang__bank-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3);
  padding-left: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--ds-surface-card);
  border: 1px solid var(--color-secondary);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}
.lang__bank-row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--bar);
}
.lang__bank-main {
  display: flex;
  flex-direction: column;
  flex: 1 1 180px;
  min-width: 0;
}
.lang__bank-word {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-content-on-surface-strong);
}
.lang__bank-gloss {
  font-size: 13px;
  color: var(--color-content-secondary);
}
.lang__bank-open {
  display: flex;
  align-items: center;
  flex: 1 1 220px;
  min-width: 0;
  gap: var(--space-3);
  text-align: left;
  cursor: pointer;
}
.lang__bank-story {
  color: var(--color-primary);
  flex-shrink: 0;
}
.lang__bank-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
  padding-left: var(--space-1);
}
.lang__mini-action {
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-full);
  background: color-mix(
    in srgb,
    var(--color-primary) 10%,
    var(--color-background)
  );
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
}
.lang__mini-action--danger {
  background: color-mix(
    in srgb,
    var(--color-error) 10%,
    var(--color-background)
  );
  color: var(--color-error-text);
}
.lang__mini-action:disabled {
  opacity: 0.55;
}
.lang__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-16) var(--space-6);
  text-align: center;
  color: var(--color-content-secondary);
}
@media (max-width: 639px) {
  .lang__capture-options {
    align-items: stretch;
    flex-direction: column;
  }
  .lang__section-head {
    align-items: flex-start;
  }
}
</style>
