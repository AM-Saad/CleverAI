<script setup lang="ts">
import { useBoardColumnsStore } from "~/composables/useBoardColumnsStore";
import { useBoardItemsStore } from "~/composables/useBoardItemsStore";
import type { BoardColumnState } from "~/composables/useBoardColumnsStore";
import type { BoardItemState } from "~/composables/useBoardItemsStore";
import { ReorderGroup, ReorderItem, useDragControls } from "motion-v";
import { useReorderableList } from "~/composables/shared";

const props = defineProps<{
  items: BoardItemState[]; // Filtered items for display
  allItems: BoardItemState[]; // All items for proper reordering
  getColumnColor?: (index: number) => string;
  getColumnIcon?: (name: string) => string;
}>();

// Stores
const columnsStore = useBoardColumnsStore();
const itemsStore = useBoardItemsStore();

// Get ordered columns
const orderedColumns = computed(() => columnsStore.getOrderedColumns());

// Uncategorized items (items without a column) - filtered from props and SORTED by order
const uncategorizedItems = computed(() => {
  return props.items
    .filter(item => (item.columnId ?? null) === null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

// ALL uncategorized items for reordering (sorted)
const allUncategorizedItems = computed(() => {
  return props.allItems
    .filter(item => (item.columnId ?? null) === null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
});

// Helper to get items for a specific column from filtered props (for display)
const getColumnItems = (columnId: string): BoardItemState[] => {
  return props.items
    .filter(item => item.columnId === columnId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

// Helper to get ALL items for a column (for reordering)
const getAllColumnItems = (columnId: string): BoardItemState[] => {
  return props.allItems
    .filter(item => item.columnId === columnId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

// Loading state
const isLoading = computed(() => columnsStore.loadingStates.value.get("global") ?? false);

const emit = defineEmits<{
  (e: "select-item", itemId: string): void;
  (e: "delete-item", itemId: string): void;
}>();

// Track if ANY item in ANY column is being dragged
const anyItemBeingDraggedInColumns = ref(false);

// Use reorderable list composable for columns
const {
  localItems: localColumns,
  isReordering: isReorderingColumns,
  isAnyDragging: anyColumnDragging,
  isDragDisabled,
  DragTracker,
  syncFromSource
} = useReorderableList<BoardColumnState>({
  onReorder: async (newOrder) => {
    console.log("🚀 [BoardKanbanView] Executing column reorder for", newOrder.length, "columns");
    const success = await columnsStore.reorderColumns(newOrder);
    if (!success) {
      console.error("❌ [BoardKanbanView] Column reorder failed");
    }
    return success;
  },
  idKey: 'id'
});

// Disable column dragging when items are being dragged OR columns are being reordered OR on mobile
const columnDraggingDisabled = computed(() =>
  anyItemBeingDraggedInColumns.value || isDragDisabled.value || isMobile.value
);

// Column drag controls for header-only dragging
const columnDragControls = ref(new Map<string, ReturnType<typeof useDragControls>>());

const getColumnDragControls = (columnId: string) => {
  let controls = columnDragControls.value.get(columnId);
  if (!controls) {
    controls = useDragControls();
    columnDragControls.value.set(columnId, controls);
  }
  return controls;
};

const startColumnDrag = (columnId: string, event: PointerEvent) => {
  if (columnDraggingDisabled.value) return;
  event.preventDefault();
  event.stopPropagation();
  getColumnDragControls(columnId).start(event);
};

// Sync columns from store
watch(orderedColumns, (cols) => syncFromSource(cols), { immediate: true });

// Handle item dragging state from columns
const handleItemDraggingChange = (isDragging: boolean) => {
  anyItemBeingDraggedInColumns.value = isDragging;
};

// New column state
const showNewColumnInput = ref(false);
const newColumnName = ref("");
const isCreatingColumn = ref(false);

// Mobile column reorder modal
const showColumnReorderModal = ref(false);
const reorderingColumns = ref<BoardColumnState[]>([]);

const openColumnReorderModal = () => {
  reorderingColumns.value = [...localColumns.value];
  showColumnReorderModal.value = true;
};

const moveColumnInModal = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= reorderingColumns.value.length) return;

  const columns = [...reorderingColumns.value];
  const temp = columns[index];
  columns[index] = columns[newIndex]!;
  columns[newIndex] = temp!;
  reorderingColumns.value = columns;
};

const saveColumnReorder = async () => {
  const success = await columnsStore.reorderColumns(reorderingColumns.value);
  if (success) {
    showColumnReorderModal.value = false;
  }
};

// Create new column
const createColumn = async () => {
  if (!newColumnName.value.trim()) return;

  isCreatingColumn.value = true;
  const result = await columnsStore.createColumn(newColumnName.value.trim());
  isCreatingColumn.value = false;

  if (result) {
    newColumnName.value = "";
    showNewColumnInput.value = false;
  }
};

// Cancel new column
const cancelNewColumn = () => {
  newColumnName.value = "";
  showNewColumnInput.value = false;
};

// --- Mobile UX Enhancements ---

const boardContainer = ref<HTMLElement | null>(null);
const activeColumnId = ref<string | null>(null);
const isMobile = ref(false);
const mobileExpandedColumn = ref<string | null>(null); // For full-screen column view on mobile

// Check if mobile
onMounted(() => {
  isMobile.value = window.innerWidth < 1024;
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024;
  if (!isMobile.value) {
    mobileExpandedColumn.value = null; // Close expanded view when switching to desktop
  }
};

// Initialize active column
onMounted(() => {
  if (uncategorizedItems.value && uncategorizedItems.value.length === 0 && orderedColumns.value.length > 0) {
    activeColumnId.value = orderedColumns.value[0]?.id ?? null;
  }
});

// Scroll to specific column
const scrollToColumn = (columnId: string | null) => {
  activeColumnId.value = columnId;
  const elementId = columnId ? `column-${columnId}` : 'column-uncategorized';
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
};

// Navigate columns on mobile
const navigateColumn = (direction: 'prev' | 'next') => {
  const allColumnIds = [
    ...(uncategorizedItems.value.length > 0 || orderedColumns.value.length === 0 ? [null] : []),
    ...localColumns.value.map(c => c.id)
  ];
  const currentIndex = allColumnIds.indexOf(activeColumnId.value);

  let newIndex = direction === 'next'
    ? Math.min(currentIndex + 1, allColumnIds.length - 1)
    : Math.max(currentIndex - 1, 0);

  const newColumnId = allColumnIds[newIndex] ?? null;
  scrollToColumn(newColumnId);
};

// Expand column to full screen on mobile
const expandColumn = (columnId: string | null) => {
  if (isMobile.value) {
    mobileExpandedColumn.value = columnId === mobileExpandedColumn.value ? null : columnId;
  }
};

// Get expanded column data
const expandedColumnData = computed(() => {
  if (mobileExpandedColumn.value === null && mobileExpandedColumn.value !== 'uncategorized') {
    // Uncategorized
    if (mobileExpandedColumn.value === null) {
      return {
        id: null,
        name: 'Uncategorized',
        items: uncategorizedItems.value,
        allItems: allUncategorizedItems.value,
        icon: 'heroicons:inbox',
        color: '#94a3b8'
      };
    }
  }
  const column = localColumns.value.find(c => c.id === mobileExpandedColumn.value);
  if (!column) return null;
  const index = localColumns.value.indexOf(column);
  return {
    id: column.id,
    name: column.name,
    items: getColumnItems(column.id),
    allItems: getAllColumnItems(column.id),
    icon: props.getColumnIcon?.(column.name),
    color: props.getColumnColor?.(index)
  };
});

// Track which column is in view
const setupObserver = () => {
  const options = {
    root: boardContainer.value,
    threshold: 0.6,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        if (id === 'column-uncategorized') {
          activeColumnId.value = null;
        } else if (id.startsWith('column-')) {
          activeColumnId.value = id.replace('column-', '');
        }
      }
    });
  }, options);

  nextTick(() => {
    const columns = boardContainer.value?.querySelectorAll('[id^="column-"]');
    columns?.forEach((col) => observer.observe(col));
  });

  return observer;
};

let columnObserver: IntersectionObserver | null = null;
onMounted(() => {
  columnObserver = setupObserver();
});

onUnmounted(() => {
  columnObserver?.disconnect();
});

watch([localColumns, uncategorizedItems], () => {
  columnObserver?.disconnect();
  columnObserver = setupObserver();
}, { deep: true });
</script>

<template>
  <div
    class="flex flex-col h-full min-h-0 bg-gray-50/50 dark:bg-gray-900/50 rounded-xl  dark:border-gray-800 shadow-inner overflow-hidden">

    <!-- Mobile Header with Column Navigation -->
    <div class="lg:hidden shrink-0">
      <!-- Column Pills Navigation -->
      <div
        class="flex items-center gap-2 p-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 scrollbar-hide">

        <!-- Loading indicator for columns -->
        <Icon v-if="isReorderingColumns" name="svg-spinners:ring-resize" class="w-4 h-4 text-primary-500 shrink-0" />

        <button v-if="uncategorizedItems.length > 0 || orderedColumns.length === 0" @click="scrollToColumn(null)"
          :class="[
            'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border min-h-[36px]',
            activeColumnId === null
              ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
          ]">
          <span class="flex items-center gap-1.5">
            <Icon name="heroicons:inbox" class="w-4 h-4" />
            Uncategorized
            <span class="text-xs opacity-70">({{ uncategorizedItems.length }})</span>
          </span>
        </button>

        <button v-for="(column, index) in localColumns" :key="column.id" @click="scrollToColumn(column.id)" :class="[
          'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border flex items-center gap-1.5 min-h-[36px]',
          activeColumnId === column.id
            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
        ]">
          <Icon v-if="getColumnIcon" :name="getColumnIcon(column.name)" class="w-4 h-4" />
          {{ column.name }}
          <span class="text-xs opacity-70">({{ getColumnItems(column.id).length }})</span>
        </button>

        <!-- Navigation arrows integrated into pills bar -->
        <button @click="navigateColumn('prev')"
          class="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 shrink-0"
          :disabled="activeColumnId === null && uncategorizedItems.length > 0">
          <Icon name="heroicons:chevron-left" class="w-4 h-4" />
        </button>

        <button @click="navigateColumn('next')"
          class="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 shrink-0"
          :disabled="activeColumnId === localColumns[localColumns.length - 1]?.id">
          <Icon name="heroicons:chevron-right" class="w-4 h-4" />
        </button>

        <!-- Reorder columns button (mobile) -->
        <button v-if="localColumns.length > 1" @click="openColumnReorderModal"
          class="p-2 rounded-full text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all shrink-0"
          title="Reorder columns">
          <Icon name="heroicons:arrows-up-down" class="w-5 h-5" />
        </button>

        <button @click="showNewColumnInput = true"
          class="p-2 rounded-full text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all shrink-0">
          <Icon name="heroicons:plus" class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <ui-loader v-if="isLoading" :is-fetching="isLoading" label="Loading board..." />

    <!-- Kanban board -->
    <div v-else ref="boardContainer"
      class="flex items-stretch gap-4 p-4 overflow-x-auto overflow-y-hidden pb-6 flex-1 min-h-0 h-full scroll-smooth snap-x snap-mandatory lg:snap-none kanban-scroll-container">

      <!-- Uncategorized column (always first) -->
      <SharedBoardColumn v-if="uncategorizedItems.length > 0 || orderedColumns.length === 0" id="column-uncategorized"
        :column-id="null" column-name="Uncategorized" :items="uncategorizedItems"
        :all-column-items="allUncategorizedItems" :is-default="true" icon="heroicons:inbox" color="#94a3b8"
        class="snap-center lg:snap-align-none shadow-sm w-[85vw] lg:w-80 shrink-0 h-full"
        @select-item="(id) => emit('select-item', id)" @delete-item="(id) => emit('delete-item', id)"
        @item-dragging="handleItemDraggingChange" />

      <!-- Draggable columns (Desktop only drag) -->
      <div class="flex gap-4 h-full" :class="{ 'opacity-60': isReorderingColumns || anyItemBeingDraggedInColumns }">
        <div :class="{ 'pointer-events-none': columnDraggingDisabled }" class="flex gap-4 h-full">
          <ReorderGroup v-model:values="localColumns" axis="x" class="flex gap-4 h-full items-stretch">
            <ReorderItem v-for="(column, index) in localColumns" :key="column.id" :value="column" :drag-listener="false"
              :drag-controls="getColumnDragControls(column.id)" v-slot="{ isDragging }">
              <div class="relative column-drag-wrapper group/column h-full min-h-0">
                <DragTracker :column-id="column.id" :is-dragging="isDragging" />

                <SharedBoardColumn :id="`column-${column.id}`" :column-id="column.id" :column-name="column.name"
                  :items="getColumnItems(column.id)" :all-column-items="getAllColumnItems(column.id)" :column="column"
                  :color="getColumnColor ? getColumnColor(index) : undefined"
                  :icon="getColumnIcon ? getColumnIcon(column.name) : undefined" :is-dragging="isDragging"
                  class="snap-center lg:snap-align-none shadow-sm w-[85vw] lg:w-80 shrink-0 h-full"
                  :class="{ 'ring-2 ring-primary-500 ring-offset-2': isDragging }"
                  @rename="(name) => columnsStore.updateColumn(column.id, name)"
                  @delete="columnsStore.deleteColumn(column.id)" @select-item="(id) => emit('select-item', id)"
                  @delete-item="(id) => emit('delete-item', id)" @item-dragging="handleItemDraggingChange"
                  @header-pointerdown="(event) => startColumnDrag(column.id, event)" />
              </div>
            </ReorderItem>
          </ReorderGroup>
        </div>
      </div>

      <!-- Add column button -->
      <div class="shrink-0 w-[85vw] lg:w-80 snap-center lg:snap-align-none h-full" style="height: 100%;">
        <div v-if="!showNewColumnInput"
          class="h-full min-h-[200px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-white dark:hover:bg-gray-800 transition-all group"
          @click="showNewColumnInput = true">
          <div class="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 group-hover:text-primary-500">
            <Icon name="heroicons:plus" class="w-8 h-8" />
            <span class="text-sm font-semibold uppercase tracking-wider">Add Column</span>
          </div>
        </div>

        <div v-else
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-lg ring-1 ring-black/5">
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">New Column</h4>
          <UInput v-model="newColumnName" placeholder="Enter title..." size="md" class="mb-3" autofocus
            @keyup.enter="createColumn" @keyup.escape="cancelNewColumn" />
          <div class="flex gap-2">
            <UButton size="sm" color="primary" :loading="isCreatingColumn" :disabled="!newColumnName.trim()"
              @click="createColumn" class="flex-1">
              Create
            </UButton>
            <UButton size="sm" color="neutral" variant="ghost" @click="cancelNewColumn">
              Cancel
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Column Reorder Modal -->
    <UModal v-model:open="showColumnReorderModal">
      <template #content>
        <div class="p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reorder Columns</h3>
            <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:x-mark"
              @click="showColumnReorderModal = false" />
          </div>

          <div class="space-y-2 max-h-[60vh] overflow-y-auto">
            <div v-for="(column, index) in reorderingColumns" :key="column.id"
              class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="flex flex-col gap-1">
                <button @click="moveColumnInModal(index, 'up')" :disabled="index === 0"
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                  <Icon name="heroicons:chevron-up" class="w-4 h-4" />
                </button>
                <button @click="moveColumnInModal(index, 'down')" :disabled="index === reorderingColumns.length - 1"
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">
                  <Icon name="heroicons:chevron-down" class="w-4 h-4" />
                </button>
              </div>

              <div class="flex items-center gap-2 flex-1">
                <Icon v-if="getColumnIcon" :name="getColumnIcon(column.name)" class="w-5 h-5 text-gray-500" />
                <span class="font-medium text-gray-900 dark:text-white">{{ column.name }}</span>
              </div>

              <span class="text-xs text-gray-400 font-medium">{{ index + 1 }}</span>
            </div>
          </div>

          <div class="flex gap-2 mt-4">
            <UButton color="primary" class="flex-1" :loading="isReorderingColumns" @click="saveColumnReorder">
              Save Order
            </UButton>
            <UButton color="neutral" variant="outline" @click="showColumnReorderModal = false">
              Cancel
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Hide scrollbar but keep functionality */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Kanban board scroll container */
.kanban-scroll-container {
  -webkit-overflow-scrolling: touch;
}

/* Mobile snap behavior */
@media (max-width: 1023px) {
  .snap-center {
    scroll-snap-align: center;
  }
}

/* Desktop: Remove snap */
@media (min-width: 1024px) {
  .lg\:snap-align-none {
    scroll-snap-align: unset;
  }
}

/* Smooth transitions for dragging */
.ring-2 {
  transition: box-shadow 0.15s ease-out;
}
</style>
