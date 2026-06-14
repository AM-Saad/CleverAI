<script setup lang="ts">
import BoardItemCard from "~/features/board/components/BoardItemCard.vue";
import { useBoardItemsStore } from "../composables/useBoardItemsStore";
import type { BoardItemState } from "../composables/useBoardItemsStore";
import type { BoardColumnState } from "../composables/useBoardColumnsStore";
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
  selectedItemId?: string;
  itemDragDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "rename", name: string): void;
  (e: "delete"): void;
  (e: "select-item", itemId: string): void;
  (e: "delete-item", itemId: string): void;
  (e: "item-dragging", isDragging: boolean): void;
  (e: "header-pointerdown", event: PointerEvent): void;
}>();

const route = useRoute();
const id = route.params.id;
const itemsStore = useBoardItemsStore(id as string);
const isItemPositionLocked = computed(() =>
  props.itemDragDisabled ||
  isDragDisabled.value ||
  itemsStore.isPositionMutationPending.value
);
const canDragItems = computed(() => !isItemPositionLocked.value);

// Use the reorderable list composable
const {
  localItems,
  isReordering,
  isAnyDragging,
  isDragDisabled,
  DragTracker,
  syncFromSource,
  shouldSuppressInteraction
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
  idKey: 'itemId',
  reorderDebounceMs: 250,
  clickSuppressMs: 220,
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
        for (const item of itemsNotInColumn) {
          const newOrder = localItems.value.findIndex(i => i.id === item.id);
          const success = await itemsStore.moveItemToColumn(item.id, props.columnId, newOrder);
          if (!success) {
            localItems.value = previousOrder;
            return;
          }
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

const handleSelectItem = (itemId: string) => {
  if (itemsStore.isPositionMutationPending.value) return;
  if (shouldSuppressInteraction(itemId)) return;
  emit("select-item", itemId);
};

const handleMoveItem = async (itemId: string, targetId: string | null) => {
  if (itemsStore.isPositionMutationPending.value) return;
  await itemsStore.moveItemToColumn(itemId, targetId);
};
</script>

<template>
  <div
    class="shrink-0 flex flex-col h-full min-h-0 bg-linear-to-b from-white to-surface/80 rounded-[var(--radius-xl)] border border-t-0 border-surface-subtle shadow-xs transition-shadow w-72 max-w-full ">
    <!-- Column Header - This is the drag handle on desktop -->
    <div
      class="flex items-center justify-between p-3 border-b border-secondary bg-white rounded-t-xl group/header shrink-0 column-drag-handle"
      @pointerdown="handleHeaderPointerDown" :class="{
        'lg:cursor-grab lg:active:cursor-grabbing': !isDefault && !isEditing,
        'lg:cursor-grabbing': isDragging
      }" :style="{ borderTop: color ? `2px solid ${color}` : undefined }">
      <div v-if="!isEditing" class="flex items-center gap-2.5 flex-1 min-w-0">
        <!-- Drag handle icon (desktop only) -->
        <div v-if="!isDefault"
          class="hidden lg:flex items-center text-content-disabled opacity-0 group-hover/header:opacity-100 transition-opacity">
          <Icon name="heroicons:bars-2" class="w-4 h-4" />
        </div>

        <div v-if="icon" class="flex items-center justify-center w-6 h-6 rounded-[var(--radius-md)] bg-surface"
          :style="{ color: color || 'currentColor' }">
          <Icon :name="icon" class="w-4 h-4" />
        </div>

        <ui-subtitle size="sm" @dblclick.stop="startEditing" class="select-none">
          {{ columnName }}
        </ui-subtitle>
        <span class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-secondary text-content-secondary">
          {{ items.length }}
        </span>

        <!-- Loading indicator -->
        <Icon v-if="isReordering" name="svg-spinners:ring-resize" class="w-3.5 h-3.5 text-primary" />
      </div>

      <div v-else class="flex items-center gap-2 flex-1 pointer-events-auto" @click.stop @mousedown.stop
        @pointerdown.stop>
        <UiInput v-model="editName" size="xs" class="flex-1" data-no-drag
          :ref="(el: unknown) => setEditInputRef((el as any)?.$el || (el as any) || null)" @keyup.enter="saveName"
          @keyup.escape="cancelEditing" @blur="handleEditBlur" @click.stop @mousedown.stop @pointerdown.stop />
        <UiButton size="xs" color="primary" variant="solid" icon="heroicons:check" data-no-drag @click.stop="saveName" />
      </div>

      <div
        class="flex items-center opacity-100 lg:opacity-0 lg:group-hover/header:opacity-100 transition-opacity pointer-events-auto"
        @pointerdown.stop>
        <UDropdownMenu v-if="!isDefault && columnActions.length > 0" :items="columnActions"
          :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
          <UiButton size="xs" color="neutral" variant="subtle" icon="heroicons:ellipsis-vertical" data-no-drag
            @click.stop @pointerdown.stop />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Items list - pointer-events enabled for item interactions -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 bg-surface/30" :class="{
      'pointer-events-auto': !isItemPositionLocked,
      'pointer-events-none opacity-60': isItemPositionLocked,
    }">
      <div>
        <ReorderGroup v-model:values="localItems" class="flex flex-col gap-3">
          <ReorderItem v-for="item in localItems" :key="item.id" :value="item" :drag="canDragItems ? 'y' : false"
            v-slot="{ isDragging: itemDragging }">
            <div>
              <DragTracker :item-id="item.id" :is-dragging="itemDragging" />
              <BoardItemCard :item="item" :is-selected="props.selectedItemId === item.id"
                @select="handleSelectItem(item.id)" @delete="emit('delete-item', item.id)"
                @move="(targetId) => handleMoveItem(item.id, targetId)" />
            </div>
          </ReorderItem>
        </ReorderGroup>
      </div>

      <!-- Empty state -->
      <div v-if="items.length === 0"
        class="flex flex-col items-center justify-center py-10 opacity-40 grayscale group/empty">
        <Icon name="heroicons:sparkles"
          class="w-8 h-8 text-content-disabled dark:text-content-disabled mb-2 transition-transform group-hover/empty:scale-110" />
        <p class="text-[11px] font-semibold text-content-secondary uppercase tracking-widest text-center px-4">
          Empty Column
        </p>
      </div>
    </div>

    <!-- Add item button -->
    <div class="shrink-0 p-2.5 bg-white rounded-b-xl border-t border-secondary pointer-events-auto">
      <UiButton size="sm" color="neutral" variant="ghost"
        class="w-full justify-start text-xs tracking-wide hover:bg-surface-subtle" icon="heroicons:plus-circle"
        @click="createItem">
        New Item
      </UiButton>
    </div>

    <!-- Delete confirmation modal -->
    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Column" @close="showDeleteConfirm = false"
      @confirm="confirmDelete">
      Are you sure you want to delete this column? Items in this column will be moved to Uncategorized.
    </shared-delete-confirmation-modal>
  </div>
</template>
