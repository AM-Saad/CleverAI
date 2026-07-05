<script setup lang="ts">
// design-allow-file: word-bank list intentionally uses native <button> for the
// segmented status tabs (role="tab" / aria-selected semantics) and the story
// disclosure toggle, plus a self-contained filter panel. Revisit and migrate to
// Ui* primitives when this WIP layout is finalized.
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import type { LanguageWord } from "~/shared/utils/language.contract";
import { useLanguageLearningRuntime } from "../composables/languageLearningRuntime";

const route = useRoute();
const router = useRouter();
const { generateStory: generateStoryCapture } = useLanguageCapture();
const ttsWorker = useTextToSpeechWorker();
const languageRuntime = useLanguageLearningRuntime();

const STATUS_FILTERS = [
  { value: "all", label: "All", icon: "i-lucide-library" },
  { value: "captured", label: "Captured", icon: "i-lucide-bookmark" },
  { value: "story_ready", label: "Stories", icon: "i-lucide-book-open" },
  { value: "enrolled", label: "Review", icon: "i-lucide-layers-3" },
  { value: "mastered", label: "Mastered", icon: "i-lucide-check-circle-2" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const words = computed<LanguageWord[]>(
  () => languageRuntime.words?.value ?? [],
);
const totalWords = computed(
  () => languageRuntime.totalWords?.value ?? words.value.length,
);
const statusCounts = computed<Record<string, number>>(
  () => languageRuntime.statusCounts?.value ?? {},
);
const hasMore = computed(() => Boolean(languageRuntime.hasMore?.value));
const activeTab = ref<StatusFilter>("all");
const selectedCategory = ref("all");
const storyFilter = ref<"all" | "with">("all");
const searchQuery = ref("");
const expandedStoryIds = ref(new Set<string>());

const isLoading = computed(() =>
  Boolean(languageRuntime.isFetchingWords?.value),
);
const isLoadingMore = computed(() =>
  Boolean(languageRuntime.isLoadingMoreWords?.value),
);
const error = computed(() => languageRuntime.wordBankError?.value ?? null);

const enrollingId = ref<string | null>(null);
const generatingStoryId = ref<string | null>(null);
const speakingId = ref<string | null>(null);
let activeAudio: HTMLAudioElement | null = null;

const tabs = computed(() =>
  STATUS_FILTERS.map((tab) => ({
    ...tab,
    count:
      tab.value === "all"
        ? totalWords.value
        : (statusCounts.value[tab.value] ?? 0),
  })),
);

const categories = computed(() =>
  (languageRuntime.categories?.value ?? []).slice(0, 12),
);
const categoryOptions = computed(() => [
  { label: "All categories", value: "all" },
  ...categories.value.map((category) => ({
    label: category,
    value: category,
  })),
]);

const filteredWords = computed(() => words.value);

const hasActiveFilters = computed(
  () =>
    activeTab.value !== "all" ||
    selectedCategory.value !== "all" ||
    storyFilter.value !== "all" ||
    !!searchQuery.value.trim(),
);

const activeFilterCount = computed(
  () =>
    Number(activeTab.value !== "all") +
    Number(selectedCategory.value !== "all") +
    Number(storyFilter.value !== "all") +
    Number(!!searchQuery.value.trim()),
);

const resultSummary = computed(() => {
  if (isLoading.value) return "Loading words";
  if (totalWords.value === 0) return "No saved words";

  const visible = filteredWords.value.length;
  const noun = visible === 1 ? "word" : "words";
  if (hasActiveFilters.value) {
    return `${visible} matching ${noun} of ${totalWords.value}`;
  }

  return hasMore.value
    ? `${visible}+ saved ${noun}`
    : `${visible} saved ${noun}`;
});

const emptyMessage = computed(() =>
  totalWords.value === 0
    ? "No words captured yet."
    : "No words match these filters.",
);

const deletingId = ref<string | null>(null);

const fetchWords = async () => {
  languageRuntime.setWordFilters({
    status: activeTab.value,
    category: selectedCategory.value,
    hasStory: storyFilter.value === "with",
    search: searchQuery.value,
  });
  return languageRuntime.fetchWords();
};

const loadMore = async () => {
  return languageRuntime.loadMoreWords();
};

const storyFor = (word: LanguageWord) =>
  Array.isArray(word.stories) ? (word.stories[0] ?? null) : null;

const wordHasStory = (word: LanguageWord) => !!storyFor(word);
const cleanStoryText = (text?: string | null) =>
  (text ?? "").replace(/\[\[CLOZE:([^\]]+)\]\]/g, "$1");

const canEnroll = (word: LanguageWord) =>
  word.status !== "enrolled" && word.status !== "mastered";

const toggleStory = (wordId: string) => {
  const next = new Set(expandedStoryIds.value);
  if (next.has(wordId)) next.delete(wordId);
  else next.add(wordId);
  expandedStoryIds.value = next;
};

const handleSpeak = async (word: LanguageWord) => {
  speakingId.value = word.id;
  try {
    const audioUrl = await ttsWorker.synthesize(word.word, word.sourceLang);
    if (!audioUrl) return;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    activeAudio = new Audio(audioUrl);
    await activeAudio.play();
  } catch (err) {
    console.warn("[language] Text to speech failed", err);
  } finally {
    speakingId.value = null;
  }
};

const handleSpeakStory = async (word: LanguageWord) => {
  const storyText = cleanStoryText(storyFor(word)?.storyText);
  if (!storyText) return;
  speakingId.value = `${word.id}:story`;
  try {
    const audioUrl = await ttsWorker.synthesize(storyText, word.sourceLang);
    if (!audioUrl) return;
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    activeAudio = new Audio(audioUrl);
    await activeAudio.play();
  } catch (err) {
    console.warn("[language] Story text to speech failed", err);
  } finally {
    speakingId.value = null;
  }
};

const deleteWord = async (word: LanguageWord) => {
  if (deletingId.value) return;
  const id = word.id;
  deletingId.value = id;

  try {
    await languageRuntime.deleteWord(id);
  } finally {
    deletingId.value = null;
  }
};

const handleEnroll = async (word: LanguageWord) => {
  enrollingId.value = word.id;
  await languageRuntime.enrollWord(word.id);
  enrollingId.value = null;
};

const handleGenerateStory = async (word: LanguageWord) => {
  generatingStoryId.value = word.id;
  await generateStoryCapture(word.id);
  generatingStoryId.value = null;
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const statusPillColor = (status: string) => {
  const map: Record<string, string> = {
    captured: "var(--color-content-secondary)",
    story_ready: "var(--color-warning)",
    enrolled: "var(--color-primary)",
    mastered: "var(--color-success)",
  };
  return map[status] ?? "var(--color-content-secondary)";
};

const normalizeStatusFilter = (value: unknown): StatusFilter => {
  const candidate = typeof value === "string" ? value : "all";
  return STATUS_FILTERS.some((item) => item.value === candidate)
    ? (candidate as StatusFilter)
    : "all";
};

const syncFiltersFromRoute = () => {
  activeTab.value = normalizeStatusFilter(route.query.status);
  selectedCategory.value =
    typeof route.query.category === "string" ? route.query.category : "all";
  storyFilter.value = route.query.hasStory === "true" ? "with" : "all";
  searchQuery.value =
    typeof route.query.search === "string" ? route.query.search : "";
};

const writeFiltersToRoute = () => {
  const query = { ...route.query };
  if (activeTab.value === "all") delete query.status;
  else query.status = activeTab.value;
  if (selectedCategory.value === "all") delete query.category;
  else query.category = selectedCategory.value;
  if (storyFilter.value === "all") delete query.hasStory;
  else query.hasStory = "true";
  if (!searchQuery.value.trim()) delete query.search;
  else query.search = searchQuery.value.trim();
  router.replace({ query });
};

const clearFilters = () => {
  activeTab.value = "all";
  selectedCategory.value = "all";
  storyFilter.value = "all";
  searchQuery.value = "";
  writeFiltersToRoute();
};

let didReadInitialRoute = false;
const {
  debouncedFunc: scheduleFilterRouteWrite,
  cancel: cancelFilterRouteWrite,
} = useDebounce(writeFiltersToRoute, 250);

watch(
  () => route.query,
  () => {
    syncFiltersFromRoute();
    if (didReadInitialRoute) void fetchWords();
  },
);

watch([activeTab, selectedCategory, storyFilter, searchQuery], () => {
  if (!didReadInitialRoute) return;
  scheduleFilterRouteWrite();
});

watch(languageRuntime.wordBankRevision ?? ref(0), () => {
  if (didReadInitialRoute) void fetchWords();
});

onMounted(() => {
  syncFiltersFromRoute();
  didReadInitialRoute = true;
  void fetchWords();
});
onBeforeUnmount(() => {
  cancelFilterRouteWrite();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
});

defineExpose({ refresh: fetchWords });
</script>

<template>
  <div class="space-y-4">
    <UiPanel
      variant="surface"
      size="sm"
      class-name="shadow-[var(--shadow-card)]"
    >
      <div class="flex flex-col gap-3">
        <div
          class="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        >
          <UiInput
            v-model="searchQuery"
            type="search"
            icon="i-lucide-search"
            placeholder="Search word bank"
            size="sm"
            class="w-full"
            aria-label="Search word bank"
          />

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <UiSelect
              v-model="selectedCategory"
              :items="categoryOptions"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full sm:w-52"
              aria-label="Filter word bank by category"
            />
            <UiButton
              size="sm"
              :variant="storyFilter === 'with' ? 'soft' : 'ghost'"
              tone="neutral"
              leading-icon="i-lucide-book-open-check"
              class="justify-center"
              :aria-pressed="storyFilter === 'with'"
              aria-label="Show only words with stories"
              @click="storyFilter = storyFilter === 'with' ? 'all' : 'with'"
            >
              Stories
            </UiButton>
            <UiButton
              v-if="hasActiveFilters"
              size="sm"
              variant="ghost"
              tone="neutral"
              leading-icon="i-lucide-x"
              class="justify-center"
              @click="clearFilters"
            >
              Clear {{ activeFilterCount }}
            </UiButton>
          </div>
        </div>

        <div
          class="flex gap-1 overflow-x-auto pb-1 scrollbar-none"
          role="tablist"
          aria-label="Word status"
        >
          <UiPill
            v-for="tab in tabs"
            :key="tab.value"
            clickable
            role="tab"
            :aria-selected="activeTab === tab.value"
            :active="activeTab === tab.value"
            :label="tab.label"
            color="var(--color-primary)"
            variant="outline"
            max-width="160px"
            @click="activeTab = tab.value"
          >
            <template #indicator>
              <UiPillIcon :name="tab.icon" size="sm" />
            </template>
            <template #icon>
              <span
                class="min-w-5 rounded-[var(--radius-sm)] bg-content-on-background/5 px-1.5 py-0.5 text-center text-[11px] font-semibold"
              >
                {{ tab.count }}
              </span>
            </template>
          </UiPill>
        </div>

        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t border-secondary pt-2"
        >
          <span class="text-xs font-medium text-content-secondary">
            {{ resultSummary }}
          </span>
          <div v-if="hasActiveFilters" class="flex flex-wrap gap-1.5">
            <UiPill
              v-if="activeTab !== 'all'"
              size="sm"
              :label="statusLabel(activeTab)"
              max-width="140px"
            />
            <UiPill
              v-if="selectedCategory !== 'all'"
              size="sm"
              :label="selectedCategory"
              max-width="140px"
            />
            <UiPill
              v-if="storyFilter === 'with'"
              size="sm"
              label="Stories"
              max-width="100px"
            />
            <UiPill
              v-if="searchQuery.trim()"
              size="sm"
              label="Search"
              max-width="100px"
            />
          </div>
        </div>
      </div>
    </UiPanel>

    <ui-loader v-if="isLoading" :is-fetching="true" />
    <shared-error-message v-else-if="error" :error="error" />

    <div v-else-if="!filteredWords.length" class="py-10 text-center space-y-2">
      <Icon
        name="i-lucide-inbox"
        class="w-10 h-10 text-content-disabled mx-auto"
      />
      <ui-paragraph size="sm" class="text-content-secondary">
        {{ emptyMessage }}
      </ui-paragraph>
    </div>

    <div v-else class="space-y-3">
      <UiItemCard
        v-for="word in filteredWords"
        :key="word.id"
        :show-body="Boolean(word.meanings?.length || storyFor(word))"
        body-class="space-y-3"
      >
        <template #title>
          <span dir="auto">{{ word.word }}</span>
        </template>
        <template #badges>
          <UiPill
            size="sm"
            :label="statusLabel(word.status)"
            :color="statusPillColor(word.status)"
            variant="outline"
            active
            max-width="140px"
          />
          <UiPill
            v-if="word.category"
            size="sm"
            :label="word.category"
            color="var(--color-content-secondary)"
            max-width="140px"
          />
        </template>

        <template #subtitle>
          <span v-if="word.phonetic" class="text-xs text-content-secondary">
            {{ word.phonetic }}
          </span>
          <span
            v-if="word.translation"
            class="text-sm font-medium text-primary"
            dir="auto"
          >
            {{ word.translation }}
            {{
              word.metadata?.translationLanguage
                ? `(${word.metadata.translationLanguage})`
                : ""
            }}
          </span>
        </template>

        <template #actions>
          <ui-button
            variant="ghost"
            color="neutral"
            size="xs"
            title="Hear word"
            :loading="speakingId === word.id"
            :aria-label="`Hear ${word.word}`"
            @click="handleSpeak(word)"
          >
            <Icon name="i-lucide-volume-2" class="w-3.5 h-3.5" />
          </ui-button>
          <ui-button
            v-if="word.status !== 'mastered'"
            variant="ghost"
            color="primary"
            size="xs"
            :title="wordHasStory(word) ? 'Regenerate story' : 'Generate story'"
            :aria-label="
              wordHasStory(word)
                ? `Regenerate story for ${word.word}`
                : `Generate story for ${word.word}`
            "
            :loading="generatingStoryId === word.id"
            @click="handleGenerateStory(word)"
          >
            <Icon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
          </ui-button>
          <ui-button
            v-if="canEnroll(word)"
            variant="ghost"
            color="primary"
            size="xs"
            title="Add to review deck"
            :aria-label="`Add ${word.word} to review deck`"
            :loading="enrollingId === word.id"
            @click="handleEnroll(word)"
          >
            <Icon name="i-lucide-book-plus" class="w-3.5 h-3.5" />
          </ui-button>
          <UiDoubleTapDeleteButton
            hide-label
            :label="`Delete ${word.word}`"
            :armed-label="`Tap again to delete ${word.word}`"
            size="xs"
            variant="ghost"
            :loading="deletingId === word.id"
            :disabled="Boolean(deletingId && deletingId !== word.id)"
            :reset-key="word.id"
            @confirm="deleteWord(word)"
          >
            <Icon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
          </UiDoubleTapDeleteButton>
        </template>

        <div v-if="word.meanings?.length" class="space-y-1.5">
          <p
            v-for="(meaning, index) in word.meanings.slice(0, 2)"
            :key="`${word.id}-meaning-${index}`"
            class="text-sm leading-relaxed text-content-secondary"
          >
            <span class="text-content-disabled">{{ index + 1 }}.</span>
            {{ meaning.definition }}
          </p>
        </div>

        <UiPanel
          v-if="storyFor(word)"
          variant="subtle"
          size="xs"
          content-class="p-0"
        >
          <button
            type="button"
            class="flex min-h-[var(--target-touch)] w-full items-center justify-between gap-3 px-3 py-2 text-left"
            :aria-expanded="expandedStoryIds.has(word.id)"
            :aria-label="`${expandedStoryIds.has(word.id) ? 'Hide' : 'Show'} story for ${word.word}`"
            @click="toggleStory(word.id)"
          >
            <span class="flex items-center gap-2 text-sm font-medium">
              <Icon name="i-lucide-book-open" class="h-4 w-4 text-primary" />
              Story
            </span>
            <Icon
              :name="
                expandedStoryIds.has(word.id)
                  ? 'i-lucide-chevron-up'
                  : 'i-lucide-chevron-down'
              "
              class="h-4 w-4 text-content-secondary"
            />
          </button>
          <div
            v-if="expandedStoryIds.has(word.id)"
            class="border-t border-secondary px-3 py-3"
          >
            <div class="mb-2 flex justify-end">
              <ui-button
                variant="ghost"
                color="neutral"
                size="xs"
                :loading="speakingId === `${word.id}:story`"
                @click="handleSpeakStory(word)"
              >
                <Icon name="i-lucide-book-audio" class="h-3.5 w-3.5" />
                Hear story
              </ui-button>
            </div>
            <p class="text-sm leading-7 text-content-on-surface" dir="auto">
              {{ cleanStoryText(storyFor(word)?.storyText) }}
            </p>
          </div>
        </UiPanel>
      </UiItemCard>

      <div v-if="hasMore" class="flex justify-center pt-2">
        <ui-button
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="isLoadingMore"
          @click="() => void loadMore()"
        >
          Load more
        </ui-button>
      </div>
    </div>
  </div>
</template>
