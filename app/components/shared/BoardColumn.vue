<script setup lang="ts">
import { useBoardItemsStore } from "~/composables/useBoardItemsStore";
import type { BoardItemState } from "~/composables/useBoardItemsStore";
import type { BoardColumnState } from "~/composables/useBoardColumnsStore";
import { useReorderableList } from "~/composables/shared/useReorderableList";
import { ReorderGroup, ReorderItem } from "motion-v";

const props = defineProps<{
  columnId: string | null;
  columnName: string;
  items: BoardItemState[];
  allColumnItems?: BoardItemState[];
  column?: BoardColumnState;
  isDefault?: boolean;
  color?: string;
  icon?: string;
  isDragging?: boolean; // Whether this column is being dragged
}>();

const emit = defineEmits<{
  (e: "rename", name: string): void;
  (e: "delete"): void;
  (e: "select-item", itemId: string): void;
  (e: "delete-item", itemId: string): void;
  (e: "item-dragging", isDragging: boolean): void;
  (e: "header-pointerdown", event: PointerEvent): void;
}>();

const itemsStore = useBoardItemsStore();

// Use the reorderable list composable
const {
  localItems,
  isReordering,
  isAnyDragging,
  isDragDisabled,
  DragTracker,
  syncFromSource
} = useReorderableList<BoardItemState>({
  onReorder: async (newOrder) => {
    const allItems = props.allColumnItems || newOrder;
    const reorderedItems = newOrder.map((item, index) => ({
      ...allItems.find(i => i.id === item.id) || item,
      order: index
    }));
    const hiddenItems = allItems.filter(item => !newOrder.some(n => n.id === item.id));
    const completeOrder = [...reorderedItems, ...hiddenItems];
    return itemsStore.reorderItemsInColumn(props.columnId, completeOrder);
  },
  onDragStateChange: (isDragging) => emit('item-dragging', isDragging),
  idKey: 'itemId'
});

// Sync local items with props
watch(() => props.items, (items) => syncFromSource(items), { immediate: true });

// Handle cross-column moves (when items are dragged between columns)
watch(isAnyDragging, async (isDragging, wasDragging) => {
  if (wasDragging && !isDragging) {
    const itemsNotInColumn = localItems.value.filter(item => item.columnId !== props.columnId);

    if (itemsNotInColumn.length > 0) {
      const previousOrder = [...localItems.value];

      try {
        const movePromises = itemsNotInColumn.map((item) => {
          const newOrder = localItems.value.findIndex(i => i.id === item.id);
          return itemsStore.moveItemToColumn(item.id, props.columnId, newOrder);
        });

        const results = await Promise.all(movePromises);

        if (results.some(r => !r)) {
          localItems.value = previousOrder;
        }
      } catch {
        localItems.value = previousOrder;
      }
    }
  }
});

// Column editing
const isEditing = ref(false);
const editName = ref("");
const editInputRef = ref<HTMLInputElement | null>(null);
const ignoreNextBlur = ref(false);

const setEditInputRef = (el: HTMLElement | null) => {
  if (!el) {
    editInputRef.value = null;
    return;
  }
  const inputEl = el.querySelector('input') as HTMLInputElement | null;
  editInputRef.value = inputEl;
};

const startEditing = async (): Promise<void> => {
  if (props.isDefault) return;
  editName.value = props.columnName;
  isEditing.value = true;
  ignoreNextBlur.value = true;

  await nextTick();
  await nextTick();

  requestAnimationFrame(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
    requestAnimationFrame(() => {
      editInputRef.value?.focus();
      editInputRef.value?.select();
    });
  });
};

const saveName = () => {
  if (!isEditing.value) return;
  if (editName.value.trim() && editName.value !== props.columnName) {
    emit("rename", editName.value.trim());
  }
  isEditing.value = false;
};

const handleEditBlur = () => {
  if (ignoreNextBlur.value) {
    ignoreNextBlur.value = false;
    requestAnimationFrame(() => {
      editInputRef.value?.focus();
      editInputRef.value?.select();
    });
    return;
  }
  saveName();
};

const cancelEditing = () => {
  isEditing.value = false;
};

const handleHeaderPointerDown = (event: PointerEvent) => {
  if (isEditing.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, button, a, [data-no-drag]")) return;
  emit("header-pointerdown", event);
};

// Delete confirmation
const showDeleteConfirm = ref(false);

const confirmDelete = () => {
  emit("delete");
  showDeleteConfirm.value = false;
};

// Column dropdown items
const columnActions = computed(() => {
  if (props.isDefault) return [];
  return [
    [
      { label: "Rename", icon: "heroicons:pencil", onSelect: () => startEditing() },
      { label: "Delete", icon: "heroicons:trash", onSelect: () => { showDeleteConfirm.value = true; } },
    ]
  ];
});

// Create new item in this column
const createItem = async () => {
  const newItemId = await itemsStore.createItem("", [], props.columnId);
  if (newItemId) {
    emit("select-item", newItemId);
  }
};
</script>

<template>
  <div
    class="shrink-0 w-72 lg:w-80 flex flex-col h-full min-h-0 bg-gradient-to-b from-white to-gray-50/80 dark:from-gray-800 dark:to-gray-900/50 rounded-xl border  border-t-0 border-muted shadow-xs transition-shadow">
    <!-- Column Header - This is the drag handle on desktop -->
    <div
      class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 rounded-t-xl group/header shrink-0 column-drag-handle"
      @pointerdown="handleHeaderPointerDown" :class="{
        'lg:cursor-grab lg:active:cursor-grabbing': !isDefault && !isEditing,
        'lg:cursor-grabbing': isDragging
      }" :style="{ borderTop: color ? `2px solid ${color}` : undefined }">
      <div v-if="!isEditing" class="flex items-center gap-2.5 flex-1 min-w-0">
        <!-- Drag handle icon (desktop only) -->
        <div v-if="!isDefault"
          class="hidden lg:flex items-center text-gray-300 dark:text-gray-600 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <Icon name="heroicons:bars-2" class="w-4 h-4" />
        </div>

        <div v-if="icon" class="flex items-center justify-center w-6 h-6 rounded bg-gray-50 dark:bg-gray-700/50"
          :style="{ color: color || 'currentColor' }">
          <Icon :name="icon" class="w-4 h-4" />
        </div>

        <ui-subtitle size="sm" @dblclick.stop="startEditing" class="select-none">
          {{ columnName }}
        </ui-subtitle>
        <span
          class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {{ items.length }}
        </span>

        <!-- Loading indicator -->
        <Icon v-if="isReordering" name="svg-spinners:ring-resize" class="w-3.5 h-3.5 text-primary-500" />
      </div>

      <div v-else class="flex items-center gap-2 flex-1 pointer-events-auto" @click.stop @mousedown.stop
        @pointerdown.stop>
        <UInput v-model="editName" size="xs" class="flex-1" data-no-drag
          :ref="(el) => setEditInputRef((el as any)?.$el || (el as any) || null)"
          @keyup.enter="saveName" @keyup.escape="cancelEditing" @blur="handleEditBlur" @click.stop @mousedown.stop
          @pointerdown.stop />
        <UButton size="xs" color="primary" variant="solid" icon="heroicons:check" data-no-drag
          @click.stop="saveName" />
      </div>

      <div
        class="flex items-center opacity-100 lg:opacity-0 lg:group-hover/header:opacity-100 transition-opacity pointer-events-auto"
        @pointerdown.stop>
        <UDropdownMenu v-if="!isDefault && columnActions.length > 0" :items="columnActions"
          :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
          <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:ellipsis-vertical" data-no-drag @click.stop
            @pointerdown.stop />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Items list - pointer-events enabled for item interactions -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-gray-100/30 dark:bg-gray-900/10 pointer-events-auto"
      :class="{ 'opacity-60': isDragDisabled }">
      <div :class="{ 'pointer-events-none': isDragDisabled }">
        <ReorderGroup v-model:values="localItems" class="flex flex-col gap-3">
          <ReorderItem v-for="item in localItems" :key="item.id" :value="item" v-slot="{ isDragging: itemDragging }">
            <div>
              <DragTracker :item-id="item.id" :is-dragging="itemDragging" />
              <SharedBoardItemCard :item="item" :is-selected="false" @select="emit('select-item', item.id)"
                @delete="emit('delete-item', item.id)"
                @move="(targetId) => itemsStore.moveItemToColumn(item.id, targetId, 0)" />
            </div>
          </ReorderItem>
        </ReorderGroup>
      </div>

      <!-- Empty state -->
      <div v-if="items.length === 0"
        class="flex flex-col items-center justify-center py-10 opacity-40 grayscale group/empty">
        <Icon name="heroicons:sparkles"
          class="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2 transition-transform group-hover/empty:scale-110" />
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest text-center px-4">
          Empty Column
        </p>
      </div>
    </div>

    <!-- Add item button -->
    <div
      class="shrink-0 p-2.5 bg-white dark:bg-gray-800 rounded-b-xl border-t border-gray-100 dark:border-gray-800 pointer-events-auto">
      <UButton size="sm" color="neutral" variant="ghost"
        class="w-full justify-start font-semibold text-xs tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700/50"
        icon="heroicons:plus-circle" @click="createItem">
        New Card
      </UButton>
    </div>

    <!-- Delete confirmation modal -->
    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Column" @close="showDeleteConfirm = false"
      @confirm="confirmDelete">
      Are you sure you want to delete this column? Items in this column will be moved to Uncategorized.
    </shared-delete-confirmation-modal>
  </div>
</template>
