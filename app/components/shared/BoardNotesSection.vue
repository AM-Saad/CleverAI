<script setup lang="ts">
import { useBoardItemsStore } from "~/composables/useBoardItemsStore";
import { useBoardColumnsStore } from "~/composables/useBoardColumnsStore";
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import { useFullscreenModal } from "~/composables/ui/useFullscreenModal";
import type { BoardItemState } from "~/composables/useBoardItemsStore";
import { useFuse } from "@vueuse/integrations/useFuse";
import { UI_CONFIG } from "~/utils/constants/ui";
import { APIError } from "~/services/FetchFactory";

const nuxtApp = useNuxtApp();


// Stores
const itemsStore = useBoardItemsStore();
const columnsStore = useBoardColumnsStore();
const tagsStore = useUserTagsStore();
const fullscreen = useFullscreenModal<string>();

// View mode state (persisted to localStorage)
const viewMode = ref<"board" | "list">("board");

// Initialize view mode from localStorage
onMounted(() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("boardViewMode");
    if (saved === "board" || saved === "list") {
      viewMode.value = saved;
    }
  }
});

// Persist view mode
watch(viewMode, (mode) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("boardViewMode", mode);
  }
});

// Unwrap fullscreen.isOpen for template binding
const isFullscreenOpen = computed(() => fullscreen.isOpen.value);

// Local state
const currentItemId = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const itemToDelete = ref<string | null>(null);
const error = ref<Error | null>(null);
const searchQuery = ref("");
const selectedTags = ref<string[]>([]);
const isEditingTags = ref(false);
const editingItemTags = ref<string[]>([]);

// Column colors & icons
const COLUMN_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
];

const getColumnColor = (index: number): string => COLUMN_COLORS[index % COLUMN_COLORS.length] || '#94a3b8';

const getColumnIcon = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('todo') || n.includes('task')) return 'heroicons:clipboard-document-list';
  if (n.includes('progress') || n.includes('doing')) return 'heroicons:arrow-path';
  if (n.includes('done') || n.includes('complete')) return 'heroicons:check-circle';
  if (n.includes('idea') || n.includes('note')) return 'heroicons:light-bulb';
  return 'heroicons:tag';
};

// All items from store - sorted by order for consistent rendering
const items = computed(() => {
  return Array.from(itemsStore.items.value.values())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

// Fuzzy search setup
const { results: searchResults } = useFuse(searchQuery, items, {
  fuseOptions: {
    keys: ["content"],
    threshold: 0.3,
  },
  matchAllWhenSearchEmpty: true,
});

// Filtered notes (search + tags)
const filteredItems = computed(() => {
  let filtered = searchResults.value.map((r) => r.item);

  // Filter by selected tags (AND logic - note must have ALL selected tags)
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter((note) => {
      return selectedTags.value.every((tag) => note.tags?.includes(tag));
    });
  }

  return filtered;
});

// Get current note (for editing)
const currentItem = computed(() => {
  if (!currentItemId.value) return null;
  return itemsStore.getItem(currentItemId.value);
});

// Fullscreen note
const currentFullscreenItem = computed(() => {
  if (!fullscreen.fullscreenId.value) return null;
  return itemsStore.getItem(fullscreen.fullscreenId.value) ?? null;
});

// Is fetching
const isFetching = computed(() => itemsStore.loadingStates.value.get("board-board") ?? false);

// --- Desktop UX Enhancements ---

// Resizable panel logic
const panelWidth = ref(400);
const isResizing = ref(false);

const startResizing = (e: MouseEvent) => {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResizing);
  document.addEventListener('mouseup', stopResizing);
};

const handleResizing = (e: MouseEvent) => {
  if (!isResizing.value) return;
  const newWidth = window.innerWidth - e.clientX - 32; // 32 for padding/margins
  if (newWidth > 300 && newWidth < 800) {
    panelWidth.value = newWidth;
  }
};

const stopResizing = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResizing);
  document.removeEventListener('mouseup', stopResizing);
  localStorage.setItem('boardPanelWidth', panelWidth.value.toString());
};

// Keyboard shortcuts
const { n, v, escape: esc } = useMagicKeys();

const isInputFocused = () => {
  return ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '') ||
    document.activeElement?.getAttribute('contenteditable') === 'true';
};

watch(() => n?.value, (val) => {
  if (val && !isInputFocused() && !isEditingTags.value) {
    createNewItem();
  }
});

watch(() => v?.value, (val) => {
  if (val && !isInputFocused() && !isEditingTags.value) {
    viewMode.value = viewMode.value === 'board' ? 'list' : 'board';
  }
});

watch(() => esc?.value, (val) => {
  if (val) {
    currentItemId.value = null;
    isEditingTags.value = false;
  }
});

onMounted(() => {
  const savedWidth = localStorage.getItem('boardPanelWidth');
  if (savedWidth) panelWidth.value = parseInt(savedWidth);
});

// Persist selected note to localStorage
watch(currentItemId, (noteId) => {
  if (typeof window === "undefined" || !noteId) return;
  try {
    const note = itemsStore.getItem(noteId);
    if (note) {
      localStorage.setItem("selectedBoardItemItem", noteId);
    }
  } catch (err) {
    console.error("Failed to save selected board note:", err);
  }
});

// Load tags and notes on mount
onMounted(async () => {
  try {
    error.value = null;

    // Load tags, notes and columns in parallel
    const loaders: Promise<void>[] = [
      (tagsStore.tags.value.size === 0 ? tagsStore.loadTags() : Promise.resolve()) as Promise<void>,
      itemsStore.syncWithServer(),
      columnsStore.syncWithServer()
    ];
    await Promise.all(loaders);
  } catch (e: unknown) {
    console.error("Failed to load board notes or tags:", e);
    error.value = e instanceof APIError ? e : new APIError("Failed to load board notes");
  }
});

// Create new note
const createNewItem = async () => {
  // Wait for columns to load if they're still loading
  const isColumnsLoading = columnsStore.loadingStates.value.get("global");
  if (isColumnsLoading) {
    await new Promise(resolve => {
      const unwatch = watch(
        () => columnsStore.loadingStates.value.get("global"),
        (loading) => {
          if (!loading) {
            unwatch();
            resolve(true);
          }
        },
        { immediate: true }
      );
    });
  }

  // Use first column if available, otherwise default to Uncategorized (null)
  const columns = columnsStore.getOrderedColumns();
  const columnId = columns.length > 0 ? columns[0]?.id ?? null : null;

  const noteId = await itemsStore.createItem("", [], columnId);

  if (noteId) {
    currentItemId.value = noteId;
    // Open tag editor after note is created
    isEditingTags.value = true;
    editingItemTags.value = [];
  }
};

// Update note content
const handleUpdateItem = async (id: string, text: string) => {
  const note = itemsStore.getItem(id);
  if (!note) {
    console.error("Item not found for update:", id);
    return;
  }

  const updatedItem: BoardItemState = {
    ...note,
    content: text,
    isDirty: true,
    updatedAt: new Date(),
  };

  await itemsStore.updateItem(id, updatedItem);
};

// Update note tags
const handleUpdateItemTags = async (noteId: string, tags: string[]) => {
  const note = itemsStore.getItem(noteId);
  if (!note) return;

  const updatedItem: BoardItemState = {
    ...note,
    tags,
    isDirty: true,
    updatedAt: new Date(),
  };

  await itemsStore.updateItem(noteId, updatedItem);
  isEditingTags.value = false;
};

// Open tag editor for current note
const openTagEditor = () => {
  if (!currentItem.value) return;
  editingItemTags.value = [...(currentItem.value.tags || [])];
  isEditingTags.value = true;
};

// Save tags from editor
const saveEditingTags = async () => {
  if (!currentItemId.value) return;
  await handleUpdateItemTags(currentItemId.value, editingItemTags.value);
};

// Delete note
const deleteItem = (id: string) => {
  itemToDelete.value = id;
  showDeleteConfirm.value = true;
};

const confirmDeleteItem = async () => {
  if (itemToDelete.value) {
    // If deleting current note, select another
    if (itemToDelete.value === currentItemId.value) {
      const remaining = items.value.filter((n) => n.id !== itemToDelete.value);
      currentItemId.value = remaining.length > 0 ? remaining[0]?.id ?? null : null;
    }

    await itemsStore.deleteItem(itemToDelete.value);
    itemToDelete.value = null;
  }
  showDeleteConfirm.value = false;
};

// Retry failed note
const handleRetry = (id: string) => {
  itemsStore.retryFailedItem(id);
};

// Clear filters
const clearFilters = () => {
  searchQuery.value = "";
  selectedTags.value = [];
};
</script>

<template>
  <div>
    <ui-card variant="ghost" size="lg" shadow="none"
      class="flex flex-col shrink-0 min-h-0 mb-6 overflow-hidden h-[80vh]" contentClasses="flex flex-col flex-1 min-h-0"
      header>
      <!-- Header -->
      <template #header>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Icon name="heroicons:bookmark" class="w-5 h-5" />
            Board
            <ui-label v-if="items.length"> ({{ items.length }}) </ui-label>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- View toggle -->
            <SharedBoardViewToggle v-model="viewMode" />

            <!-- Search -->
            <UInput v-model="searchQuery" icon="heroicons:magnifying-glass" placeholder="Search notes..." size="sm"
              class="w-48" />

            <!-- Tag filter -->
            <SharedBoardTagFilter v-model="selectedTags" />

            <!-- Clear filters button -->
            <UButton v-if="searchQuery || selectedTags.length > 0" size="sm" color="neutral" variant="ghost"
              icon="heroicons:x-mark" @click="clearFilters">
              Clear
            </UButton>

            <!-- New note button -->
            <UButton size="sm" color="primary" variant="outline" @click="createNewItem">
              <Icon name="heroicons:plus" />
              New Item
            </UButton>
          </div>
        </div>
      </template>

      <!-- Content -->
      <template #default>
        <ui-loader v-if="isFetching" :is-fetching="isFetching" label="Loading board notes..." />

        <!-- Error state -->
        <shared-error-message v-if="error" :error="(error as APIError)" />

        <!-- Empty state -->
        <shared-empty-state v-if="!error && !isFetching && items.length === 0" title="No Board Items"
          button-text="Create First Item" :center-description="true" @action="createNewItem">
          <template #description>
            Board notes are personal notes not tied to any folder.<br />
            Use tags to organize and find them easily.
          </template>
        </shared-empty-state>

        <!-- No results -->
        <shared-empty-state v-if="!error && !isFetching && items.length > 0 && filteredItems.length === 0"
          title="No matching notes" button-text="Clear Filters" :center-description="true" @action="clearFilters">
          <template #description>
            Try adjusting your search or tag filters.
          </template>
        </shared-empty-state>

        <!-- Items grid with editor -->
        <div v-if="!error && !isFetching && items.length > 0" class="flex flex-1 min-h-0 overflow-hidden">
          <!-- Kanban View -->
          <SharedBoardKanbanView v-if="viewMode === 'board'" class="flex-1 h-full min-h-0" :items="filteredItems"
            :all-items="items" :get-column-color="getColumnColor" :get-column-icon="getColumnIcon"
            @select-item="(id) => currentItemId = id" @delete-item="deleteItem" />

          <!-- List View -->
          <SharedBoardListView v-else class="flex-1 min-h-0 overflow-y-auto" :items="filteredItems" :all-items="items"
            @select-item="(id) => currentItemId = id" @delete-item="deleteItem" />

          <!-- Item editor (right side on desktop, slide-over on mobile) -->
          <Transition enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-x-full lg:translate-x-0 lg:opacity-0"
            enter-to-class="translate-x-0 lg:opacity-100" leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-x-0 lg:opacity-100"
            leave-to-class="translate-x-full lg:translate-x-0 lg:opacity-0">
            <div v-if="currentItem"
              class="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 lg:bg-transparent lg:border-0 transition-all w-full shrink-0 p-2"
              :style="{ '--panel-width': `${panelWidth}px` }" :class="['lg:w-[var(--panel-width)]']">
              <!-- Resizer handle (Desktop only) -->
              <div
                class="hidden lg:block absolute -left-0.5 top-1/2 -translate-y-1/2 bottom-0 h-[90%] w-1 cursor-col-resize hover:bg-primary transition-colors z-10 rounded-2xl"
                @mousedown="startResizing" />

              <!-- Editor header -->
              <div
                class="flex items-center justify-between p-4 lg:p-0 lg:mb-4 border-b border-gray-100 dark:border-gray-800 lg:border-0 shrink-0">
                <div class="flex items-center gap-2">
                  <UButton variant="ghost" color="neutral" icon="heroicons:chevron-left" class="lg:hidden"
                    @click="currentItemId = null" />
                  <span class="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Edit Note
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:tag" @click="openTagEditor" />
                  <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:arrows-pointing-out"
                    class="hidden md:block" @click="fullscreen.toggle(currentItem.id)" />
                </div>
              </div>

              <div class="flex-1 overflow-y-auto p-4 lg:p-0">
                <!-- Tag editor -->
                <div v-if="isEditingTags"
                  class="mb-4 space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                  <SharedTagInput v-model="editingItemTags" placeholder="Add tags..." />
                  <div class="flex gap-2">
                    <UButton size="sm" color="primary" @click="saveEditingTags">Save</UButton>
                    <UButton size="sm" color="neutral" variant="ghost" @click="isEditingTags = false">Cancel</UButton>
                  </div>
                </div>

                <!-- Tags display -->
                <div v-else-if="currentItem.tags && currentItem.tags.length > 0" class="mb-4 flex flex-wrap gap-1.5">
                  <UBadge v-for="tag in currentItem.tags
                    .map((name) => tagsStore.getTagByName(name))
                    .filter((t): t is NonNullable<typeof t> => t !== null)" :key="tag.id"
                    :style="{ backgroundColor: tag.color, color: '#ffffff' }" variant="solid" size="sm"
                    class="rounded-full px-2.5">
                    {{ tag.name }}
                  </UBadge>
                </div>

                <!-- Sticky note editor -->
                <div class="h-full min-h-[500px] lg:h-auto">
                  <UiStickyNote :note="currentItem" :delete-note="deleteItem" @update="handleUpdateItem"
                    @retry="handleRetry" @toggle-fullscreen="fullscreen.toggle" placeholder="Write your note..."
                    class="h-full lg:h-auto" :is-board-item="true" />
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </ui-card>

    <!-- Fullscreen Item View (Desktop) -->
    <shared-fullscreen-wrapper :is-open="isFullscreenOpen" aria-label="Item fullscreen view" max-width="900px"
      max-height="80vh" @close="fullscreen.close">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-gray-100">Board Item</span>
            <!-- Tags in fullscreen -->
            <div v-if="currentFullscreenItem?.tags && currentFullscreenItem.tags.length > 0"
              class="flex flex-wrap gap-1">
              <UBadge v-for="tag in currentFullscreenItem.tags
                .map((name) => tagsStore.getTagByName(name))
                .filter((t): t is NonNullable<typeof t> => t !== null)" :key="tag.id"
                :style="{ backgroundColor: tag.color, color: '#ffffff' }" variant="solid" size="sm"
                class="rounded-full px-2.5">
                {{ tag.name }}
              </UBadge>
            </div>
          </div>
          <u-button variant="outline" color="neutral" size="xs" aria-label="Close fullscreen" class="hidden md:block"
            @click="fullscreen.close()">
            <icon name="i-heroicons-x-mark" :size="UI_CONFIG.ICON_SIZE" />
          </u-button>
        </div>
      </template>

      <div v-if="currentFullscreenItem" class="h-full">
        <UiStickyNote :note="currentFullscreenItem" :delete-note="deleteItem" :is-fullscreen="true" size="lg"
          @update="handleUpdateItem" @retry="handleRetry" @toggle-fullscreen="fullscreen.close"
          placeholder="Write your note..." :is-board-item="true" />
      </div>
    </shared-fullscreen-wrapper>

    <!-- Delete confirmation -->
    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Item" @close="showDeleteConfirm = false"
      @confirm="confirmDeleteItem">
      Are you sure you want to delete this note? This action cannot be undone.
    </shared-delete-confirmation-modal>
  </div>
</template>
