<script setup lang="ts">
import BoardItemCard from "~/features/board/components/BoardItemCard.vue";
import { useBoardColumnsStore } from "../composables/useBoardColumnsStore";
import { useBoardItemsStore } from "../composables/useBoardItemsStore";
import type { BoardItemState } from "../composables/useBoardItemsStore";

const props = defineProps<{
  itemsByColumn: Map<string | null, BoardItemState[]>;
  selectedItemId?: string;
}>();

const route = useRoute();
const id = route.params.id;
// Stores
const columnsStore = useBoardColumnsStore(id as string);
const itemsStore = useBoardItemsStore(id as string);

const emit = defineEmits<{
  (e: "select-item", itemId: string): void;
  (e: "delete-item", itemId: string): void;
}>();

// Get all items sorted by column
const orderedColumns = computed(() => columnsStore.getOrderedColumns());

const getColumnItems = (columnId: string | null) =>
  props.itemsByColumn.get(columnId) ?? [];

const uncategorizedItems = computed(() => getColumnItems(null));

// Collapsed sections
const collapsedSections = ref<Set<string>>(new Set());

const toggleSection = (sectionId: string) => {
  if (collapsedSections.value.has(sectionId)) {
    collapsedSections.value.delete(sectionId);
  } else {
    collapsedSections.value.add(sectionId);
  }
};

// Create item in uncategorized
const createItem = async () => {
  const newItemId = await itemsStore.createItem("", [], null);
  if (newItemId) {
    emit("select-item", newItemId);
  }
};

const handleCreateInColumn = async (columnId: string) => {
  const newItemId = await itemsStore.createItem("", [], columnId);
  if (newItemId) {
    emit("select-item", newItemId);
  }
};

// Column editing
const isEditingColumn = ref<string | null>(null);
const editColumnName = ref("");

const editInputRefs = ref<Map<string, HTMLElement>>(new Map());

const setEditInputRef = (columnId: string, el: HTMLElement | null) => {
  if (el) {
    editInputRefs.value.set(columnId, el);
  } else {
    editInputRefs.value.delete(columnId);
  }
};

const focusEditInput = (columnId: string) => {
  const inputWrapper = editInputRefs.value.get(columnId);
  const inputElement = inputWrapper?.querySelector('input') as HTMLInputElement | null;
  if (inputElement) {
    inputElement.focus();
    inputElement.select();
  }
};

const startEditingColumn = async (columnId: string, currentName: string) => {
  isEditingColumn.value = columnId;
  editColumnName.value = currentName;

  // Wait for DOM update, then focus
  await nextTick();
  await nextTick(); // Double nextTick to ensure complete render

  requestAnimationFrame(() => {
    focusEditInput(columnId);
    requestAnimationFrame(() => focusEditInput(columnId));
  });
};

const saveColumnName = async (columnId: string) => {
  // Prevent saving if we're not actually editing
  if (isEditingColumn.value !== columnId) return;

  if (editColumnName.value.trim() && editColumnName.value !== columnsStore.getColumn(columnId)?.name) {
    await columnsStore.updateColumn(columnId, editColumnName.value.trim());
  }
  isEditingColumn.value = null;
};

// Delete confirmation
const columnToDelete = ref<string | null>(null);
const showDeleteConfirm = ref(false);

const confirmDeleteColumn = async () => {
  if (columnToDelete.value) {
    await columnsStore.deleteColumn(columnToDelete.value);
    columnToDelete.value = null;
  }
  showDeleteConfirm.value = false;
};

// Column actions dropdown
const getColumnActions = (columnId: string) => {
  const column = columnsStore.getColumn(columnId);
  if (!column) return [];

  return [
    [
      {
        label: "Rename",
        icon: "heroicons:pencil",
        onSelect: () => startEditingColumn(columnId, column.name),
      },
      {
        label: "Delete",
        icon: "heroicons:trash",
        onSelect: () => {
          columnToDelete.value = columnId;
          showDeleteConfirm.value = true;
        },
      },
    ]
  ];
};
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 overflow-y-auto gap-4 pr-1">
    <!-- Uncategorized section -->
    <div v-if="uncategorizedItems.length > 0 || orderedColumns.length === 0"
      class="bg-white dark:bg-surface/40 rounded-[var(--radius-xl)] border border-secondary dark:border-secondary shadow-[var(--shadow-dropdown)] overflow-hidden">
      <button class="w-full flex items-center justify-between px-4 py-3 bg-surface-subtle dark:bg-surface/60"
        @click="toggleSection('uncategorized')">
        <div class="flex items-center gap-2 text-left">
          <Icon :name="collapsedSections.has('uncategorized') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'"
            class="w-4 h-4 text-content-secondary" />
          <span class="font-semibold text-content-on-surface-strong dark:text-content-on-surface">Uncategorized</span>
          <span class="text-xs text-content-secondary">({{ uncategorizedItems.length }})</span>
        </div>
        <UiButton size="xs" color="neutral" variant="ghost" icon="heroicons:plus" @click.stop="createItem">
          Add
        </UiButton>
      </button>
      <div v-if="!collapsedSections.has('uncategorized')" class="p-3 space-y-2">
        <BoardItemCard v-for="item in uncategorizedItems" :key="item.id" :item="item"
          :is-selected="props.selectedItemId === item.id" @select="emit('select-item', item.id)"
          @delete="emit('delete-item', item.id)" @move="(targetId) => itemsStore.moveItemToColumn(item.id, targetId)" />
        <div v-if="uncategorizedItems.length === 0" class="text-center text-content-secondary py-6 text-sm">
          No items yet
        </div>
      </div>
    </div>

    <!-- Column sections -->
    <div v-for="column in orderedColumns" :key="column.id"
      class="bg-white dark:bg-surface/40 rounded-[var(--radius-xl)] border border-secondary dark:border-secondary shadow-[var(--shadow-dropdown)] overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 bg-surface-subtle dark:bg-surface/60 group/header">
        <button v-if="isEditingColumn !== column.id" class="flex items-center gap-2 flex-1 text-left"
          @click="toggleSection(column.id)">
          <Icon :name="collapsedSections.has(column.id) ? 'heroicons:chevron-right' : 'heroicons:chevron-down'"
            class="w-4 h-4 text-content-secondary" />
          <span class="font-semibold text-content-on-surface-strong dark:text-content-on-surface">{{ column.name
            }}</span>
          <span class="text-xs text-content-secondary">({{ getColumnItems(column.id).length }})</span>
        </button>
        <div v-else class="flex items-center gap-2 flex-1" data-editing @click.stop @mousedown.stop>
          <UiInput v-model="editColumnName" size="xs" class="flex-1"
            :ref="(el: unknown) => setEditInputRef(column.id, (el as any)?.$el || (el as any) || null)"
            @keyup.enter="saveColumnName(column.id)" @keyup.escape="isEditingColumn = null"
            @blur="saveColumnName(column.id)" @click.stop @mousedown.stop />
        </div>
        <div class="flex items-center gap-1">
          <UiButton size="xs" color="neutral" variant="ghost" icon="heroicons:plus"
            @click.stop="handleCreateInColumn(column.id)">
            Add
          </UiButton>
          <UDropdownMenu :items="getColumnActions(column.id)"
            :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
            <UiButton size="xs" color="neutral" variant="ghost" icon="heroicons:ellipsis-vertical" @click.stop />
          </UDropdownMenu>
        </div>
      </div>
      <div v-if="!collapsedSections.has(column.id)" class="p-3 space-y-2">
        <BoardItemCard v-for="item in getColumnItems(column.id)" :key="item.id" :item="item"
          :is-selected="props.selectedItemId === item.id" @select="emit('select-item', item.id)"
          @delete="emit('delete-item', item.id)" @move="(targetId) => itemsStore.moveItemToColumn(item.id, targetId)" />
        <div v-if="getColumnItems(column.id).length === 0" class="text-center text-content-secondary py-6 text-sm">
          No items yet
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <shared-delete-confirmation-modal :show="showDeleteConfirm" title="Delete Column" @close="showDeleteConfirm = false"
      @confirm="confirmDeleteColumn">
      Are you sure you want to delete this column? Items in this column will be moved to Uncategorized.
    </shared-delete-confirmation-modal>
  </div>
</template>
