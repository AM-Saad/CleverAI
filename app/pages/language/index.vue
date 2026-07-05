<template>
  <div class="lang">
    <header class="lang__header">
      <ui-title tag="h1" class="lang__title">Language</ui-title>
      <NuxtLink
        to="/language/review"
        class="lang__due"
        :class="{ 'lang__due--none': !dueCount }"
      >
        {{ dueCount }} due
      </NuxtLink>
    </header>

    <div class="lang__seg" role="tablist">
      <button type="button" class="lang__seg-btn" :class="{ 'lang__seg-btn--on': tab === 'translate' }" @click="tab = 'translate'"> <!-- design-allow: native segmented control -->
        Translate
      </button>
      <button type="button" class="lang__seg-btn" :class="{ 'lang__seg-btn--on': tab === 'bank' }" @click="tab = 'bank'"> <!-- design-allow: native segmented control -->
        Word bank
      </button>
    </div>

    <!-- TRANSLATE -->
    <template v-if="tab === 'translate'">
      <form class="lang__search" @submit.prevent="translate">
        <UiInput
          v-model="queryWord"
          :placeholder="inputPlaceholder"
          icon="i-lucide-search"
          class="lang__search-input"
        />
        <span class="lang__dir">{{ directionLabel }}</span>
      </form>

      <div v-if="translating" class="lang__loading">
        <AiShimmer :lines="2" />
      </div>

      <UiCard
        v-else-if="result"
        variant="default"
        shadow="sm"
        class-name="lang__result"
      >
        <div class="lang__word-row">
          <ui-title tag="h2" class="lang__word" dir="auto">{{ result.word }}</ui-title>
          <span v-if="result.partOfSpeech" class="lang__pos">{{
            result.partOfSpeech
          }}</span>
        </div>
        <div v-if="result.phonetic" class="lang__ipa">
          {{ result.phonetic }}
          <button type="button" class="lang__play" aria-label="Play pronunciation" @click="speak(result.word)"> <!-- design-allow: native audio control -->
            <UiIcon name="i-lucide-volume-2" class="h-4 w-4" />
          </button>
        </div>

        <!-- brand-gradient reward reveal (vivid full band, white text) -->
        <RewardGradient class="lang__reveal">
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
          <p v-if="firstExample.translation" class="lang__example-tr" dir="auto">
            {{ firstExample.translation }}
          </p>
        </div>

        <div class="lang__save">
          <button type="button" class="lang__star" :class="{ 'lang__star--on': saved }" aria-label="Save" :aria-pressed="saved" @click="save"> <!-- design-allow: native save toggle -->
            <UiIcon name="i-lucide-star" class="h-5 w-5" />
          </button>
          <UiButton
            pill
            block
            tone="primary"
            :loading="saving"
            :disabled="saved"
            @click="save"
          >
            {{ saved ? "Saved to word bank" : "Save to word bank" }}
          </UiButton>
        </div>
      </UiCard>

      <p v-else-if="translateError" class="lang__err">{{ translateError }}</p>
    </template>

    <!-- WORD BANK -->
    <template v-else>
      <NuxtLink v-if="dueCount" to="/language/review" class="lang__due-hero">
        <div>
          <span class="lang__due-hero-eyebrow">DUE NOW</span>
          <p class="lang__due-hero-count">
            {{ dueCount }} word{{ dueCount === 1 ? "" : "s" }}
          </p>
        </div>
        <span class="lang__due-hero-cta"
          >Review <UiIcon name="i-lucide-arrow-right" class="h-4 w-4"
        /></span>
      </NuxtLink>

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
          role="button"
          tabindex="0"
          @click="onWordTap(w)"
          @keydown.enter="onWordTap(w)"
        >
          <div class="lang__bank-main">
            <span class="lang__bank-word">{{ w.word }}</span>
            <span class="lang__bank-gloss"
              >{{ w.translation
              }}<template v-if="w.partOfSpeech">
                · {{ w.partOfSpeech }}</template
              ></span
            >
          </div>
          <UiIcon
            :name="
              storyBusyId === w.id
                ? 'i-lucide-loader-circle'
                : hasStory(w)
                  ? 'i-lucide-book-open-text'
                  : 'i-lucide-sparkles'
            "
            class="lang__bank-story h-4 w-4"
            :class="{ 'lang__bank-story--busy': storyBusyId === w.id }"
          />
          <UiPill
            size="sm"
            :label="badgeText(w)"
            :color="badgeColor(w)"
            variant="outline"
            active
            max-width="100px"
          />
          <div class="lang__bank-actions" @click.stop>
            <button type="button" class="lang__mini-action" :disabled="enrollingId === w.id || w.status === 'mastered' || w.status === 'enrolled'" @click="enrollWord(w)"> <!-- design-allow: functional CTA, not a status chip -->
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
    </template>

    <!-- immersive story reader overlay -->
    <Teleport to="body">
      <div v-if="storyOpen" class="lang__reader">
        <StoryReader
          :title="activeStory.title"
          :level="activeStory.level"
          :text="activeStory.text"
          :saved-words="activeStory.savedWords"
          @close="storyOpen = false"
          @save="onSaveFromStory"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, nextTick, watch } from "vue";
import RewardGradient from "~/components/ui/RewardGradient.vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";
import StoryReader from "~/features/language-learning/components/StoryReader.vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useSanitize } from "~/composables/shared/useSanitize";
import {
  getLanguageLabel,
  type CaptureWordResponse,
  type LanguageWord,
  type SupportedLanguageCode,
  type UserLanguagePreferences,
} from "@shared/utils/language.contract";

const { $api } = useNuxtApp();
const { sanitizeHtml } = useSanitize();

definePageMeta({ middleware: "auth" });

const tab = ref<"translate" | "bank">("translate");
const queryWord = ref("");
const translating = ref(false);
const translateError = ref<string | null>(null);
const result = ref<CaptureWordResponse | null>(null);
const saved = ref(false);
const saving = ref(false);
const preferences = ref<UserLanguagePreferences | null>(null);

const words = ref<LanguageWord[]>([]);
const loadingWords = ref(false);
const loadingMoreWords = ref(false);
const wordBankError = ref<string | null>(null);
const dueCount = ref(0);
const hasMoreWords = ref(false);
const nextCursor = ref<string | null>(null);
const wordSearch = ref("");
const statusFilter = ref<
  "all" | "captured" | "story_ready" | "enrolled" | "mastered"
>("all");
const storyOnly = ref(false);
const categoryFilter = ref("all");
const categories = ref<string[]>([]);
const statusCounts = ref<Record<string, number>>({});
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
    : "No saved words yet. Translate one to start.",
);

function capturePayload(word: string, translateOnly: boolean) {
  return {
    sourceLang: "auto",
    targetLang: nativeLanguage.value,
    includeTranslation: true,
    forceRetranslate: false,
    sourceType: "manual" as const,
    word,
    translateOnly,
  };
}

const firstExample = computed(() => result.value?.examples?.[0] ?? null);

async function translate() {
  const word = queryWord.value.trim();
  if (!word) return;
  translating.value = true;
  translateError.value = null;
  saved.value = false;
  result.value = null;
  try {
    const res = await $api.language.captureWord(capturePayload(word, true));
    if (res.success) {
      result.value = res.data;
      saved.value = res.data.saved;
    } else {
      translateError.value =
        res.error?.message ?? "Couldn't translate that word.";
    }
  } catch (err) {
    translateError.value =
      err instanceof Error ? err.message : "Translation failed.";
  } finally {
    translating.value = false;
  }
}

async function save() {
  if (!result.value || saved.value) return;
  saving.value = true;
  try {
    const res = await $api.language.captureWord(
      capturePayload(result.value.word, false),
    );
    if (res.success) {
      saved.value = true;
      await Promise.all([loadWords(), loadStats()]);
    }
  } finally {
    saving.value = false;
  }
}

function wordQueryParams(append = false) {
  return {
    limit: 50,
    // The word bank is the user's full saved library. Scoping it to the
    // current language preferences hides older words after preference changes.
    ...(append && nextCursor.value ? { cursor: nextCursor.value } : {}),
    ...(wordSearch.value.trim() ? { search: wordSearch.value.trim() } : {}),
    ...(statusFilter.value !== "all" ? { status: statusFilter.value } : {}),
    ...(storyOnly.value ? { hasStory: true } : {}),
    ...(categoryFilter.value !== "all"
      ? { category: categoryFilter.value }
      : {}),
  };
}

async function loadPreferences() {
  const res = await $api.language.getPreferences();
  if (res.success) {
    preferences.value = res.data;
  }
}

async function loadStats() {
  const res = await $api.language.getStats();
  if (res.success) {
    dueCount.value = res.data.due ?? 0;
  }
}

async function loadWords(append = false) {
  if (append) loadingMoreWords.value = true;
  else loadingWords.value = true;
  wordBankError.value = null;
  try {
    const res = await $api.language.getWords(wordQueryParams(append));
    if (res.success) {
      words.value = append
        ? [...words.value, ...res.data.words]
        : res.data.words;
      categories.value = res.data.categories ?? categories.value;
      statusCounts.value = res.data.statusCounts ?? statusCounts.value;
      nextCursor.value = res.data.nextCursor ?? null;
      hasMoreWords.value = Boolean(res.data.nextCursor);
    } else {
      wordBankError.value =
        res.error?.message ?? "Couldn't load your saved words.";
    }
  } finally {
    if (append) loadingMoreWords.value = false;
    else loadingWords.value = false;
  }
}

async function loadMoreWords() {
  if (!hasMoreWords.value || loadingMoreWords.value) return;
  await loadWords(true);
}

function isDue(w: LanguageWord) {
  return w.status === "due" || w.status === "learning";
}
function badgeText(w: LanguageWord) {
  if (w.status === "mastered") return "mastered";
  if (isDue(w)) return "due";
  return w.status;
}
function badgeColor(w: LanguageWord) {
  if (w.status === "mastered") return "var(--color-success)";
  if (isDue(w)) return "var(--color-warning)";
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
function speak(text: string) {
  if (import.meta.client && "speechSynthesis" in window) {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
}

// ── Immersive story reader ──────────────────────────────────────────────────
const storyOpen = ref(false);
const activeStory = reactive<{
  title: string;
  level: string;
  text: string;
  savedWords: { word: string; translation: string; phonetic?: string }[];
}>({ title: "", level: "A2", text: "", savedWords: [] });

function hasStory(w: LanguageWord) {
  return !!(w.stories && w.stories.length && w.stories[0]?.storyText);
}
function openStory(w: LanguageWord) {
  const story = w.stories![0]!;
  activeStory.title = w.word;
  activeStory.level = (w.difficulty as string) || "A2";
  activeStory.text = story.storyText;
  // Highlight every saved word in the reader, each in its stable accent.
  activeStory.savedWords = words.value.map((x) => ({
    word: x.word,
    translation: x.translation,
    phonetic: x.phonetic ?? undefined,
  }));
  storyOpen.value = true;
}
const storyBusyId = ref<string | null>(null);
function onWordTap(w: LanguageWord) {
  if (storyBusyId.value) return;
  if (hasStory(w)) openStory(w);
  else generateStoryFor(w);
}
async function generateStoryFor(w: LanguageWord) {
  storyBusyId.value = w.id;
  try {
    const res = await $api.language.generateStory({
      wordId: w.id,
      relatedWords: [],
    });
    if (res.success) {
      activeStory.title = w.word;
      activeStory.level = (w.difficulty as string) || "A2";
      activeStory.text = res.data.storyText;
      activeStory.savedWords = words.value.map((x) => ({
        word: x.word,
        translation: x.translation,
        phonetic: x.phonetic ?? undefined,
      }));
      storyOpen.value = true;
      void Promise.all([loadWords(), loadStats()]);
    }
  } catch {
    /* non-blocking */
  } finally {
    storyBusyId.value = null;
  }
}

async function onSaveFromStory(word: string) {
  await $api.language.captureWord(capturePayload(word, false));
  await Promise.all([loadWords(), loadStats()]);
}

async function deleteWord(word: LanguageWord) {
  if (deletingId.value) return;
  deletingId.value = word.id;
  try {
    const res = await $api.language.deleteWord(word.id);
    if (res.success) {
      words.value = words.value.filter((item) => item.id !== word.id);
      await Promise.all([loadWords(), loadStats()]);
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
    const res = await $api.language.enrollWord(word.id);
    if (res.success) {
      words.value = words.value.map((item) =>
        item.id === word.id ? { ...item, status: res.data.status } : item,
      );
      await Promise.all([loadWords(), loadStats()]);
    }
  } finally {
    enrollingId.value = null;
  }
}

let wordFilterTimer: ReturnType<typeof setTimeout> | null = null;
watch([wordSearch, statusFilter, storyOnly, categoryFilter], () => {
  if (wordFilterTimer) clearTimeout(wordFilterTimer);
  wordFilterTimer = setTimeout(() => {
    nextCursor.value = null;
    void loadWords();
  }, 250);
});

const route = useRoute();
const lastComposeToken = ref("");

function focusTranslateInput() {
  tab.value = "translate";
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
  focusTranslateInput();
}

watch([() => route.query.compose, () => route.query.capture], ([compose]) =>
  consumeComposeRoute(compose),
);

onMounted(async () => {
  await loadPreferences();
  await Promise.all([loadWords(), loadStats()]);
  // Capture-word entry from the FAB: land on Translate, focused & ready.
  consumeComposeRoute(route.query.compose);
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
.lang__due {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning-text);
}
.lang__due--none {
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
}
.lang__seg {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
}
.lang__seg-btn {
  flex: 1;
  padding: 8px;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-content-secondary);
}
.lang__seg-btn--on {
  background: var(--color-background);
  color: var(--color-primary);
  box-shadow: var(--shadow-card);
}
.lang__search {
  position: relative;
  display: flex;
  align-items: center;
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
.lang__star {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-secondary);
  color: var(--color-content-secondary);
  flex-shrink: 0;
}
.lang__star--on {
  color: var(--color-warning);
  border-color: var(--color-warning);
}
.lang__err {
  text-align: center;
  color: var(--color-error-text);
  font-size: 14px;
  padding: var(--space-4);
}
.lang__due-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-2xl);
  background: var(--ds-gradient-due);
  color: var(--color-white);
  box-shadow: var(--shadow-primary-glow);
}
.lang__due-hero-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  opacity: 0.8;
}
.lang__due-hero-count {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 1.1;
}
.lang__due-hero-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  background: var(--color-white);
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 700;
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
.lang__bank-row--story {
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
.lang__bank-story--busy {
  animation: lang-spin 0.9s linear infinite;
}
@keyframes lang-spin {
  to {
    transform: rotate(360deg);
  }
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
.lang__reader {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  max-width: 480px;
  margin: 0 auto;
  background: var(--color-background);
}
</style>
