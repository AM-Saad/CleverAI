<script setup lang="ts">
import type { BoardItemState } from "~/composables/board/useBoardItemsStore";
import { useFuse } from "@vueuse/integrations/useFuse";
import { UI_CONFIG } from "~/utils/constants/ui";
import { APIError } from "~/services/FetchFactory";
import { useAdaptiveToolbar } from "~/composables/ui/useAdaptiveToolbar";



const route = useRoute();
const id = route.params.id;
// Stores
const itemsStore = useBoardItemsStore(id as string);
const columnsStore = useBoardColumnsStore(id as string);
const tagsStore = useUserTagsStore(id as string);
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

// Filter state
interface BoardFilterState {
  tags: string[];
  dueDate: "any" | "overdue" | "today" | "this-week" | "has-date";
  createdAfter: string | null;
  createdBefore: string | null;
}

// Local state
const currentItemId = ref<string | null>(null);
const showDeleteConfirm = ref(false);
const itemToDelete = ref<string | null>(null);
const error = ref<Error | null>(null);
const searchQuery = ref("");
const filterState = ref<BoardFilterState>({
  tags: [],
  dueDate: "any",
  createdAfter: null,
  createdBefore: null,
});

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

// Filtered items (search + tags + due date + created range)
const filteredItems = computed(() => {
  let filtered = searchResults.value.map((r) => r.item);

  // Tag filter (AND logic — item must have ALL selected tags)
  if (filterState.value.tags.length > 0) {
    filtered = filtered.filter((item) =>
      filterState.value.tags.every((tag) => item.tags?.includes(tag))
    );
  }

  // Due date filter
  if (filterState.value.dueDate !== "any") {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    filtered = filtered.filter((item) => {
      const dd = item.dueDate ? new Date(item.dueDate as string) : null;
      if (filterState.value.dueDate === "has-date") return dd !== null;
      if (filterState.value.dueDate === "overdue") return dd !== null && dd < now;
      if (filterState.value.dueDate === "today")
        return dd !== null && dd >= todayStart && dd < new Date(todayStart.getTime() + 86400000);
      if (filterState.value.dueDate === "this-week")
        return dd !== null && dd >= todayStart && dd <= weekEnd;
      return true;
    });
  }

  // Created-at range filter
  if (filterState.value.createdAfter) {
    const from = new Date(filterState.value.createdAfter);
    filtered = filtered.filter((item) => item.createdAt && new Date(item.createdAt as string) >= from);
  }
  if (filterState.value.createdBefore) {
    const to = new Date(filterState.value.createdBefore);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter((item) => item.createdAt && new Date(item.createdAt as string) <= to);
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

// Is fetching (both items store and columns store use "global" key)
const isFetching = computed(() =>
  (itemsStore.loadingStates.value.get("global") ?? false) ||
  (columnsStore.loadingStates.value.get("global") ?? false)
);

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
  if (val && !isInputFocused() && !currentItemId.value) {
    createNewItem();
  }
});

watch(() => v?.value, (val) => {
  if (val && !isInputFocused()) {
    viewMode.value = viewMode.value === 'board' ? 'list' : 'board';
  }
});

watch(() => esc?.value, (val) => {
  if (val) {
    currentItemId.value = null;
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
  await itemsStore.updateItem(noteId, { ...note, tags, isDirty: true, updatedAt: new Date() });
};

// Meta update from detail panel (tags, dueDate, attachments)
const handleUpdateItemMeta = async (id: string, patch: Partial<Pick<BoardItemState, "tags" | "dueDate" | "attachments">>) => {
  const note = itemsStore.getItem(id);
  if (!note) return;
  await itemsStore.updateItem(id, { ...note, ...patch, isDirty: true, updatedAt: new Date() });
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
  filterState.value = { tags: [], dueDate: "any", createdAfter: null, createdBefore: null };
};

// ─── Adaptive Toolbar ─────────────────────────────────────────────
const { containerRef: toolbarRef, tier, showLabels, showSecondaryActions, isOverflowing } = useAdaptiveToolbar();
const showSearchPopover = ref(false);

// Has active filters (for badge indicator)
const hasActiveFilters = computed(() =>
  searchQuery.value.length > 0 ||
  filterState.value.tags.length > 0 ||
  filterState.value.dueDate !== "any" ||
  filterState.value.createdAfter !== null ||
  filterState.value.createdBefore !== null
);

const activeFilterCount = computed(() => {
  let n = filterState.value.tags.length;
  if (filterState.value.dueDate !== "any") n++;
  if (filterState.value.createdAfter || filterState.value.createdBefore) n++;
  return n;
});

// Overflow menu items for collapsed tier
const overflowMenuItems = computed(() => [
  [{
    label: viewMode.value === 'board' ? 'Switch to List' : 'Switch to Board',
    icon: viewMode.value === 'board' ? 'heroicons:list-bullet' : 'heroicons:view-columns',
    onSelect: () => { viewMode.value = viewMode.value === 'board' ? 'list' : 'board'; },
  },
  {
    label: 'Search',
    icon: 'heroicons:magnifying-glass',
    onSelect: () => { showSearchPopover.value = true; },
  },
  {
    label: `Filters${activeFilterCount.value > 0 ? ` (${activeFilterCount.value})` : ''}`,
    icon: activeFilterCount.value > 0 ? 'heroicons:funnel-solid' : 'heroicons:funnel',
    onSelect: () => { /* filter is a popover, handled separately */ },
  }],
  ...(hasActiveFilters.value ? [[{
    label: 'Clear filters',
    icon: 'heroicons:x-mark',
    onSelect: clearFilters,
  }]] : []),
]);
</script>

<template>
  <ui-card size="sm" shadow="none" class="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden z-10 relative!" header>
    <!-- Header -->
    <template #header>
      <div ref="toolbarRef" class="adaptive-toolbar">
        <!-- Title (always visible) -->
        <div class="toolbar-title">
          <Icon name="heroicons:bookmark" class="w-4 h-4 shrink-0" />
          <span class="">Board</span>
          <ui-label v-if="items.length"> ({{ items.length }}) </ui-label>
        </div>

        <!-- Actions -->
        <div class="toolbar-actions">
          <!-- Primary: New Item (always visible) -->
          <UButton size="sm" color="primary" variant="outline" @click="createNewItem">
            <Icon name="heroicons:plus" />
            <span v-if="showLabels" class="toolbar-label">New Item</span>
          </UButton>

          <!-- Secondary: View toggle (wide + compact) -->
          <!-- <Transition name="toolbar-fade">
            <BoardViewToggle v-if="showSecondaryActions" v-model="viewMode" />
          </Transition> -->



          <!-- Secondary: Filter panel (wide + compact) -->
          <Transition name="toolbar-fade">
            <BoardFilterBar v-if="showSecondaryActions" v-model="filterState" />
          </Transition>
          <!-- Secondary: Search (inline in wide, popover in compact) -->
          <Transition name="toolbar-fade">
            <UInput v-if="showLabels" v-model="searchQuery" icon="heroicons:magnifying-glass" placeholder="Search..."
              size="sm" class="toolbar-search" />
          </Transition>
          <UPopover v-if="!showLabels && showSecondaryActions" v-model:open="showSearchPopover">
            <UButton size="sm" color="neutral" variant="ghost" icon="heroicons:magnifying-glass"
              :class="{ 'text-primary': searchQuery.length > 0 }" />
            <template #content>
              <div class="p-2 w-64">
                <UInput v-model="searchQuery" icon="heroicons:magnifying-glass" placeholder="Search notes..." size="sm"
                  autofocus class="w-full" />
              </div>
            </template>
          </UPopover>
          <!-- Clear filters (wide + compact, only if active) -->
          <Transition name="toolbar-fade">
            <UButton v-if="showSecondaryActions && hasActiveFilters" size="sm" color="neutral" variant="ghost"
              icon="heroicons:x-mark" @click="clearFilters">
              <span v-if="showLabels" class="toolbar-label">Clear</span>
            </UButton>
          </Transition>

          <!-- Overflow menu (collapsed tier only) -->
          <UDropdownMenu v-if="isOverflowing" :items="overflowMenuItems">
            <UButton size="sm" color="neutral" variant="ghost" icon="heroicons:ellipsis-vertical">
              <span v-if="hasActiveFilters" class="overflow-indicator" />
            </UButton>
          </UDropdownMenu>
        </div>
      </div>
    </template>

    <!-- Content -->
    <template #default>
      <!-- Full-page loader: only when no cached items exist yet -->
      <ui-loader v-if="isFetching && items.length === 0" :is-fetching="true" label="Loading board..." />

      <!-- Error state -->
      <div v-if="error && items.length === 0"
        class="flex flex-col items-center justify-center flex-1 gap-3 py-12 text-center px-6">
        <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
          <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-error" />
        </div>
        <div>
          <p class="font-semibold text-content-on-surface-strong">Failed to load board</p>
          <p class="text-sm text-content-secondary mt-1">{{ (error as any)?.message || 'An unexpected error occurred' }}
          </p>
        </div>
        <UButton size="sm" color="primary" variant="soft" icon="heroicons:arrow-path"
          @click="() => { error = null; itemsStore.syncWithServer(); columnsStore.syncWithServer(); }">
          Retry
        </UButton>
      </div>

      <!-- Empty state: first load done, no items at all -->
      <shared-empty-state v-if="!isFetching && !error && items.length === 0" title="No Board Items"
        button-text="Create First Item" :center-description="true" @action="createNewItem">
        <template #description>
          Add your first board item to get started.<br />
          Use columns, tags, and due dates to stay organised.
        </template>
      </shared-empty-state>

      <!-- Items grid with editor (show even while refreshing in background) -->
      <div v-if="!error && items.length > 0" class="flex flex-col flex-1 min-h-0 overflow-hidden relative">

        <!-- Subtle background sync indicator -->
        <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0"
          enter-to-class="opacity-100" leave-active-class="transition duration-200" leave-from-class="opacity-100"
          leave-to-class="opacity-0">
          <div v-if="isFetching"
            class="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-[10px] font-medium text-primary bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-sm border border-primary/20">
            <Icon name="svg-spinners:ring-resize" class="w-3 h-3" />
            Syncing
          </div>
        </Transition>

        <!-- No results after filtering -->
        <shared-empty-state v-if="filteredItems.length === 0" title="No matching items" button-text="Clear Filters"
          :center-description="true" @action="clearFilters">
          <template #description>
            Try adjusting your search or filters.
          </template>
        </shared-empty-state>

        <div v-else class="flex flex-1 min-h-0 overflow-hidden">
          <!-- Kanban View -->
          <BoardKanbanView v-if="viewMode === 'board'" class="flex-1 min-w-0 h-full min-h-0" :items="filteredItems"
            :all-items="items" :selected-item-id="currentItemId ?? undefined" :get-column-color="getColumnColor"
            :get-column-icon="getColumnIcon" @select-item="(id) => currentItemId = id" @delete-item="deleteItem" />

          <!-- List View -->
          <BoardListView v-else class="flex-1 min-w-0 min-h-0 overflow-y-auto" :items="filteredItems" :all-items="items"
            :selected-item-id="currentItemId ?? undefined" @select-item="(id) => currentItemId = id"
            @delete-item="deleteItem" />

          <!-- Item editor:
             - xl+ (≥1280px): right-side panel inline (shares row with board/list)
             - Below xl: full-screen overlay teleported to <body> to escape overflow stacking
        -->

          <!-- Desktop inline panel (xl+) -->
          <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-x-2"
            enter-to-class="opacity-100 translate-x-0" leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 translate-x-2">
            <div v-if="currentItem"
              class="hidden xl:flex flex-col border-l border-secondary bg-white dark:bg-surface transition-all shrink-0 relative"
              :style="{ width: `${panelWidth}px` }">
              <!-- Resizer handle -->
              <div
                class="absolute -left-0.5 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10 rounded-[var(--radius-2xl)]"
                @mousedown="startResizing" />
              <board-item-detail-panel :item="currentItem" :workspace-id="id as string" @update="handleUpdateItem"
                @update-meta="handleUpdateItemMeta" @delete="deleteItem" @retry="handleRetry"
                @toggle-fullscreen="fullscreen.toggle(currentItem.id)" @close="currentItemId = null" />
            </div>
          </Transition>

          <Teleport to="body">
            <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="translate-x-full"
              enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in"
              leave-from-class="translate-x-0" leave-to-class="translate-x-full">
              <div v-if="currentItem"
                class="xl:hidden fixed inset-0 z-200 flex flex-col bg-white dark:bg-surface overflow-hidden">
                <board-item-detail-panel :item="currentItem" :workspace-id="id as string" @update="handleUpdateItem"
                  @update-meta="handleUpdateItemMeta" @delete="deleteItem" @retry="handleRetry"
                  @toggle-fullscreen="fullscreen.toggle(currentItem.id)" @close="currentItemId = null" />
              </div>
            </Transition>
          </Teleport>
        </div>
      </div>
    </template>
  </ui-card>

  <!-- Fullscreen Item View (Desktop) -->
  <shared-fullscreen-wrapper :is-open="isFullscreenOpen" aria-label="Item fullscreen view" max-width="960px"
    max-height="90vh" @close="fullscreen.close">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-medium text-content-on-surface-strong">Board Item</span>
        <UButton variant="outline" color="neutral" size="xs" aria-label="Close fullscreen" @click="fullscreen.close()">
          <Icon name="i-heroicons-x-mark" :size="UI_CONFIG.ICON_SIZE" />
        </UButton>
      </div>
    </template>

    <div v-if="currentFullscreenItem" class="h-full overflow-hidden">
      <board-item-detail-panel :item="currentFullscreenItem" :workspace-id="id as string" @update="handleUpdateItem"
        @update-meta="handleUpdateItemMeta" @delete="deleteItem" @retry="handleRetry"
        @toggle-fullscreen="fullscreen.close" @close="fullscreen.close" />
    </div>
  </shared-fullscreen-wrapper>

  <!-- Delete confirmation -->
  <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Item" @close="showDeleteConfirm = false"
    @confirm="confirmDeleteItem">
    Are you sure you want to delete this note? This action cannot be undone.
  </shared-delete-confirmation-modal>
</template>

<style scoped>
/* ─── Adaptive Toolbar ───────────────────────────────────────────── */

.adaptive-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  position: relative;
}

.toolbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Prevent wrap to ensure it stays on one line */
  flex-wrap: nowrap;
  overflow: hidden;
  justify-content: flex-end;
}

/* Transitions for fading items in/out smoothly */
.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
  transition: opacity 0.25s ease, max-width 0.25s ease, margin 0.25s ease;
  overflow: hidden;
}

.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
  opacity: 0;
  max-width: 0;
  margin-left: 0;
  margin-right: 0;
}

/* Label text fade inside buttons */
.toolbar-label {
  transition: opacity 0.2s ease;
}

.overflow-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-primary);
}
</style>
