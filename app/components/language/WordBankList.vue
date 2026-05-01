<script setup lang="ts">
import { useTextToSpeechWorker } from "~/composables/ai/useTextToSpeechWorker";
import type { LanguageWord } from "~/shared/utils/language.contract";

const { $api } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const { generateStory: generateStoryCapture } = useLanguageCapture();
const ttsWorker = useTextToSpeechWorker();

const words = ref<LanguageWord[]>([]);
const serverCategories = ref<string[]>([]);
const cursor = ref<string | undefined>(undefined);
const hasMore = ref(false);
const activeTab = ref("all");
const selectedCategory = ref("all");
const storyFilter = ref<"all" | "with">("all");
const searchQuery = ref("");
const expandedStoryIds = ref(new Set<string>());

type WordsResult = {
  words: LanguageWord[];
  nextCursor: string | null;
  categories?: string[];
};

const fetchOp = useOperation<WordsResult>();
const loadMoreOp = useOperation<WordsResult>();
const deleteOp = useOperation<{ message: string }>();
const enrollOp = useOperation<{ wordId: string; status: string }>();

const isLoading = fetchOp.pending;
const isLoadingMore = loadMoreOp.pending;
const error = fetchOp.error;

const enrollingId = ref<string | null>(null);
const generatingStoryId = ref<string | null>(null);
const speakingId = ref<string | null>(null);
let activeAudio: HTMLAudioElement | null = null;

const tabs = computed(() => {
  const counts: Record<string, number> = {};
  for (const word of words.value) {
    counts[word.status] = (counts[word.status] ?? 0) + 1;
  }
  return [
    { value: "all", label: "All", count: words.value.length },
    { value: "captured", label: "Captured", count: counts.captured ?? 0 },
    { value: "story_ready", label: "Stories", count: counts.story_ready ?? 0 },
    { value: "enrolled", label: "Enrolled", count: counts.enrolled ?? 0 },
    { value: "mastered", label: "Mastered", count: counts.mastered ?? 0 },
  ].filter((tab) => tab.value === "all" || tab.count > 0);
});

const categories = computed(() => serverCategories.value.slice(0, 12));

const filteredWords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return words.value.filter((word) => {
    const matchesStatus =
      activeTab.value === "all" || word.status === activeTab.value;
    const matchesCategory =
      selectedCategory.value === "all" ||
      word.category === selectedCategory.value;
    const matchesStory = storyFilter.value === "all" || wordHasStory(word);
    const matchesSearch =
      !query ||
      [word.word, word.translation, word.category, word.partOfSpeech]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    return matchesStatus && matchesCategory && matchesStory && matchesSearch;
  });
});

const emptyMessage = computed(() =>
  words.value.length === 0
    ? "No words captured yet."
    : "No words match these filters.",
);

const pendingDelete = ref<LanguageWord | null>(null);
const deletingId = ref<string | null>(null);

const fetchWords = async () => {
  cursor.value = undefined;
  const result = await fetchOp.execute(() =>
    $api.language.getWords({
      limit: 50,
      status: activeTab.value === "all" ? undefined : activeTab.value,
      category:
        selectedCategory.value === "all" ? undefined : selectedCategory.value,
      hasStory: storyFilter.value === "with" ? true : undefined,
      search: searchQuery.value.trim() || undefined,
    }),
  );
  if (result) {
    words.value = result.words ?? [];
    serverCategories.value = result.categories ?? [];
    cursor.value = result.nextCursor ?? undefined;
    hasMore.value = !!result.nextCursor;
  }
};

const loadMore = async () => {
  if (!cursor.value) return;
  const result = await loadMoreOp.execute(() =>
    $api.language.getWords({
      limit: 50,
      cursor: cursor.value,
      status: activeTab.value === "all" ? undefined : activeTab.value,
      category:
        selectedCategory.value === "all" ? undefined : selectedCategory.value,
      hasStory: storyFilter.value === "with" ? true : undefined,
      search: searchQuery.value.trim() || undefined,
    }),
  );
  if (result) {
    words.value.push(...(result.words ?? []));
    cursor.value = result.nextCursor ?? undefined;
    hasMore.value = !!result.nextCursor;
  }
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
    await ttsWorker.synthesize(storyText, word.sourceLang);
  } catch (err) {
    console.warn("[language] Story text to speech failed", err);
  } finally {
    speakingId.value = null;
  }
};

const confirmDelete = (word: LanguageWord) => {
  pendingDelete.value = word;
};

const executeDelete = async () => {
  if (!pendingDelete.value) return;
  const id = pendingDelete.value.id;
  deletingId.value = id;
  pendingDelete.value = null;

  await deleteOp.execute(() => $api.language.deleteWord(id));
  if (!deleteOp.error.value) {
    words.value = words.value.filter((word) => word.id !== id);
  }
  deletingId.value = null;
};

const handleEnroll = async (word: LanguageWord) => {
  enrollingId.value = word.id;
  const result = await enrollOp.execute(() =>
    $api.language.enrollWord(word.id),
  );
  if (result) {
    const idx = words.value.findIndex((item) => item.id === word.id);
    const current = words.value[idx];
    if (current) words.value[idx] = { ...current, status: "enrolled" };
  }
  enrollingId.value = null;
};

const handleGenerateStory = async (word: LanguageWord) => {
  generatingStoryId.value = word.id;
  const result = await generateStoryCapture(word.id);
  if (result) await fetchWords();
  generatingStoryId.value = null;
};

const statusLabel = (status: string) =>
  status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const statusColor = (status: string) => {
  const map: Record<string, any> = {
    captured: "neutral",
    story_ready: "warning",
    enrolled: "primary",
    mastered: "success",
  };
  return map[status] ?? "neutral";
};

const syncFiltersFromRoute = () => {
  activeTab.value =
    typeof route.query.status === "string" ? route.query.status : "all";
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

let didReadInitialRoute = false;
const handleExternalWordsChanged = () => {
  void fetchWords();
};

watch(
  () => route.query,
  () => {
    syncFiltersFromRoute();
    if (didReadInitialRoute) void fetchWords();
  },
);

watch([activeTab, selectedCategory, storyFilter, searchQuery], () => {
  if (!didReadInitialRoute) return;
  writeFiltersToRoute();
});

onMounted(() => {
  syncFiltersFromRoute();
  didReadInitialRoute = true;
  void fetchWords();
  window.addEventListener("language:words-changed", handleExternalWordsChanged);
});
onBeforeUnmount(() => {
  window.removeEventListener(
    "language:words-changed",
    handleExternalWordsChanged,
  );
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
    <div class="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <u-input
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search word bank"
        class="w-full"
      />
      <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <u-button
          v-for="tab in tabs"
          :key="tab.value"
          :variant="activeTab === tab.value ? 'soft' : 'ghost'"
          color="neutral"
          size="xs"
          class="shrink-0"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
          <u-badge
            v-if="tab.count > 0"
            variant="soft"
            color="neutral"
            class="ml-1 text-xs"
          >
            {{ tab.count }}
          </u-badge>
        </u-button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <u-button
        size="xs"
        :variant="selectedCategory === 'all' ? 'soft' : 'ghost'"
        color="neutral"
        @click="selectedCategory = 'all'"
      >
        All categories
      </u-button>
      <u-button
        v-for="category in categories"
        :key="category"
        size="xs"
        :variant="selectedCategory === category ? 'soft' : 'ghost'"
        color="neutral"
        @click="selectedCategory = category"
      >
        {{ category }}
      </u-button>
      <u-button
        size="xs"
        :variant="storyFilter === 'with' ? 'soft' : 'ghost'"
        color="neutral"
        @click="storyFilter = storyFilter === 'with' ? 'all' : 'with'"
      >
        Has story
      </u-button>
    </div>

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
      <ui-card v-for="word in filteredWords" :key="word.id">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3
                class="truncate text-base font-semibold text-content-on-surface"
              >
                {{ word.word }}
              </h3>
              <u-badge
                variant="soft"
                :color="statusColor(word.status)"
                class="text-xs"
              >
                {{ statusLabel(word.status) }}
              </u-badge>
              <u-badge
                v-if="word.category"
                variant="soft"
                color="neutral"
                class="text-xs"
              >
                {{ word.category }}
              </u-badge>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span v-if="word.phonetic" class="text-xs text-content-secondary">
                {{ word.phonetic }}
              </span>
              <span
                v-if="word.translation"
                class="text-sm font-medium text-primary"
              >
                {{ word.translation }}
                {{
                  word.metadata?.translationLanguage
                    ? `(${word.metadata.translationLanguage})`
                    : ""
                }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-1">
            <u-button
              variant="ghost"
              color="neutral"
              size="xs"
              title="Hear word"
              :loading="speakingId === word.id"
              @click="handleSpeak(word)"
            >
              <Icon name="i-lucide-volume-2" class="w-3.5 h-3.5" />
            </u-button>
            <u-button
              v-if="word.status !== 'mastered'"
              variant="ghost"
              color="primary"
              size="xs"
              :title="
                wordHasStory(word) ? 'Regenerate story' : 'Generate story'
              "
              :loading="generatingStoryId === word.id"
              @click="handleGenerateStory(word)"
            >
              <Icon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
            </u-button>
            <u-button
              v-if="canEnroll(word)"
              variant="ghost"
              color="primary"
              size="xs"
              title="Add to review deck"
              :loading="enrollingId === word.id"
              @click="handleEnroll(word)"
            >
              <Icon name="i-lucide-book-plus" class="w-3.5 h-3.5" />
            </u-button>
            <u-button
              variant="ghost"
              color="error"
              size="xs"
              title="Delete word"
              :loading="deletingId === word.id"
              @click="confirmDelete(word)"
            >
              <Icon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
            </u-button>
          </div>
        </div>

        <div v-if="word.meanings?.length" class="mt-3 space-y-1.5">
          <p
            v-for="(meaning, index) in word.meanings.slice(0, 2)"
            :key="`${word.id}-meaning-${index}`"
            class="text-sm leading-relaxed text-content-secondary"
          >
            <span class="text-content-disabled">{{ index + 1 }}.</span>
            {{ meaning.definition }}
          </p>
        </div>

        <div
          v-if="storyFor(word)"
          class="mt-3 rounded-lg border border-secondary bg-surface"
        >
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
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
              <u-button
                variant="ghost"
                color="neutral"
                size="xs"
                :loading="speakingId === `${word.id}:story`"
                @click="handleSpeakStory(word)"
              >
                <Icon name="i-lucide-book-audio" class="h-3.5 w-3.5" />
                Hear story
              </u-button>
            </div>
            <p class="text-sm leading-7 text-content-on-surface">
              {{ cleanStoryText(storyFor(word)?.storyText) }}
            </p>
          </div>
        </div>
      </ui-card>

      <div v-if="hasMore" class="flex justify-center pt-2">
        <u-button
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="isLoadingMore"
          @click="loadMore"
        >
          Load more
        </u-button>
      </div>
    </div>

    <shared-dialog-modal
      :show="!!pendingDelete"
      title="Delete word?"
      icon="i-heroicons-trash"
      @close="pendingDelete = null"
    >
      <template #body>
        <ui-paragraph size="sm" color="content-secondary">
          Remove "<strong>{{ pendingDelete?.word }}</strong
          >" from your language deck? This also deletes its story and review
          history.
        </ui-paragraph>
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <u-button
            variant="ghost"
            color="neutral"
            @click="pendingDelete = null"
            >Cancel</u-button
          >
          <u-button color="error" :loading="!!deletingId" @click="executeDelete"
            >Delete</u-button
          >
        </div>
      </template>
    </shared-dialog-modal>
  </div>
</template>
