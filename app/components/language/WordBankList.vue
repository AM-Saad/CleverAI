<template>
  <div class="space-y-4">
    <!-- Status tab bar -->
    <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <u-button v-for="tab in tabs" :key="tab.value" :variant="activeTab === tab.value ? 'soft' : 'ghost'"
        color="neutral" size="xs" class="shrink-0" @click="activeTab = tab.value">
        {{ tab.label }}
        <u-badge v-if="tab.count > 0" variant="soft" color="neutral" class="ml-1 text-xs">{{ tab.count }}</u-badge>
      </u-button>
    </div>

    <!-- Loading -->
    <ui-loader v-if="isLoading" :is-fetching="true" />

    <!-- Error -->
    <shared-error-message v-else-if="error" :error="error" />

    <!-- Empty -->
    <div v-else-if="!filteredWords.length" class="py-10 text-center space-y-2">
      <Icon name="i-lucide-inbox" class="w-10 h-10 text-content-disabled mx-auto" />
      <ui-paragraph size="sm" class="text-content-secondary">
        {{ activeTab === 'all' ? 'No words captured yet.' : `No ${activeTab} words yet.` }}
      </ui-paragraph>
    </div>

    <!-- Word list -->
    <div v-else class="space-y-2">
      <div v-for="word in filteredWords" :key="word.id"
        class="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-surface-strong border border-secondary hover:border-primary/30 transition-colors">
        <div class="flex-1 min-w-0 space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="font-medium text-content-on-surface truncate">{{ word.word }}</span>
            <u-badge variant="soft" :color="statusColor(word.status)" class="text-xs shrink-0">
              {{ word.status }}
            </u-badge>
          </div>
          <ui-paragraph size="xs" class="text-content-secondary truncate">
            {{ word.translation }}
          </ui-paragraph>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 ml-3 shrink-0">
          <!-- Generate Story (only for captured words with no story) -->
          <u-button v-if="word.status === 'captured' && !wordHasStory(word)" variant="ghost" color="primary" size="xs"
            title="Generate a story for this word" :loading="generatingStoryId === word.id"
            @click="handleGenerateStory(word)">
            <Icon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
          </u-button>
          <!-- Enroll (only for words that have a story but aren't enrolled yet) -->
          <u-button v-if="canEnroll(word)" variant="ghost" color="primary" size="xs" title="Add to review deck"
            :loading="enrollingId === word.id" @click="handleEnroll(word)">
            <Icon name="i-lucide-book-plus" class="w-3.5 h-3.5" />
          </u-button>
          <!-- Delete -->
          <u-button variant="ghost" color="error" size="xs" :loading="deletingId === word.id"
            @click="confirmDelete(word)">
            <Icon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
          </u-button>
        </div>
      </div>

      <!-- Load more -->
      <div v-if="hasMore" class="flex justify-center pt-2">
        <u-button variant="ghost" color="neutral" size="sm" :loading="isLoadingMore" @click="loadMore">
          Load more
        </u-button>
      </div>
    </div>

    <!-- Delete confirmation -->
    <shared-dialog-modal :show="!!pendingDelete" title="Delete word?" icon="i-heroicons-trash"
      @close="pendingDelete = null">
      <template #body>
        <ui-paragraph size="sm" color="content-secondary">
          Remove "<strong>{{ pendingDelete?.word }}</strong>" from your language deck? This also deletes its story and
          review history.
        </ui-paragraph>
      </template>

      <template #footer>
        <div class="flex gap-2 justify-end">
          <u-button variant="ghost" color="neutral" @click="pendingDelete = null">Cancel</u-button>
          <u-button color="error" :loading="!!deletingId" @click="executeDelete">Delete</u-button>
        </div>
      </template>
    </shared-dialog-modal>
  </div>
</template>

<script setup lang="ts">
import type { LanguageWord } from "~/shared/utils/language.contract";

const { $api } = useNuxtApp();
const { generateStory: generateStoryCapture } = useLanguageCapture();

// ── Data ──────────────────────────────────────────────────────────────────────
const words = ref<LanguageWord[]>([]);
const cursor = ref<string | undefined>(undefined);
const hasMore = ref(false);

const fetchOp = useOperation<{ words: LanguageWord[]; nextCursor?: string }>();
const loadMoreOp = useOperation<{ words: LanguageWord[]; nextCursor?: string }>();
const deleteOp = useOperation<void>();
const enrollOp = useOperation<{ wordId: string; status: string }>();

const isLoading = fetchOp.pending;
const isLoadingMore = loadMoreOp.pending;
const error = fetchOp.error;

const enrollingId = ref<string | null>(null);
const generatingStoryId = ref<string | null>(null);

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<string>("all");

const tabs = computed(() => {
  const counts: Record<string, number> = {};
  for (const w of words.value) {
    counts[w.status] = (counts[w.status] ?? 0) + 1;
  }
  return [
    { value: "all", label: "All", count: words.value.length },
    { value: "captured", label: "Captured", count: counts["captured"] ?? 0 },
    { value: "enrolled", label: "Enrolled", count: counts["enrolled"] ?? 0 },
    { value: "mastered", label: "Mastered", count: counts["mastered"] ?? 0 },
  ].filter((t) => t.value === "all" || t.count > 0);
});

const filteredWords = computed(() =>
  activeTab.value === "all" ? words.value : words.value.filter((w) => w.status === activeTab.value)
);

// ── Delete ────────────────────────────────────────────────────────────────────
const pendingDelete = ref<LanguageWord | null>(null);
const deletingId = ref<string | null>(null);

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
    words.value = words.value.filter((w) => w.id !== id);
  }
  deletingId.value = null;
};

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchWords = async () => {
  cursor.value = undefined;
  const result = await fetchOp.execute(() => $api.language.getWords({ limit: 50 }));
  if (result) {
    words.value = (result as any).words ?? [];
    cursor.value = (result as any).nextCursor;
    hasMore.value = !!(result as any).nextCursor;
  }
};

const loadMore = async () => {
  if (!cursor.value) return;
  const result = await loadMoreOp.execute(() =>
    $api.language.getWords({ limit: 50, cursor: cursor.value })
  );
  if (result) {
    words.value.push(...((result as any).words ?? []));
    cursor.value = (result as any).nextCursor;
    hasMore.value = !!(result as any).nextCursor;
  }
};

const wordHasStory = (word: LanguageWord) =>
  Array.isArray((word as any).stories) && (word as any).stories.length > 0;

const canEnroll = (word: LanguageWord) =>
  word.status !== "enrolled" && word.status !== "mastered" && wordHasStory(word);

const handleEnroll = async (word: LanguageWord) => {
  enrollingId.value = word.id;
  const result = await enrollOp.execute(() => $api.language.enrollWord(word.id));
  if (result) {
    const idx = words.value.findIndex((w) => w.id === word.id);
    if (idx !== -1) words.value[idx] = { ...words.value[idx], status: "enrolled" };
  }
  enrollingId.value = null;
};

const handleGenerateStory = async (word: LanguageWord) => {
  generatingStoryId.value = word.id;
  const result = await generateStoryCapture(word.id);
  if (result) {
    // Refresh list to reflect new status
    await fetchWords();
  }
  generatingStoryId.value = null;
};

const statusColor = (status: string) => {
  const map: Record<string, any> = {
    captured: "neutral",
    story_ready: "warning",
    enrolled: "primary",
    mastered: "success",
  };
  return map[status] ?? "neutral";
};

onMounted(() => fetchWords());

defineExpose({ refresh: fetchWords });
</script>
