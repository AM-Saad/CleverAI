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

// Column actions dropdown
const getColumnActions = (columnId: string) => {
  const column = columnsStore.getColumn(columnId);
  if (!column) return [];

  return [
    [
      {
        label: "Rename",
        icon: "i-lucide-pencil",
        onSelect: () => startEditingColumn(columnId, column.name),
      },
      {
        id: `delete-column-${columnId}`,
        label: "Delete",
        icon: "i-lucide-trash-2",
        requiresDoubleTap: true,
        confirmLabel: "Tap again to delete",
        onSelect: () => columnsStore.deleteColumn(columnId),
      },
    ]
  ];
};
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 overflow-y-auto gap-4 pr-1">
    <!-- Uncategorized section -->
    <UiPanel
      v-if="uncategorizedItems.length > 0 || orderedColumns.length === 0"
      tag="section"
      variant="surface"
      size="xs"
      class-name="shadow-[var(--shadow-dropdown)]"
      content-class="p-0">
      <div class="flex items-center justify-between gap-3 px-4 py-3 bg-surface-subtle group/header">
        <UiButton variant="link" tone="neutral" class="flex min-w-0 flex-1 items-center gap-2 text-left justify-start no-underline"
          @click="toggleSection('uncategorized')">
          <Icon :name="collapsedSections.has('uncategorized') ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-content-secondary" />
          <span class="font-semibold text-content-on-surface-strong dark:text-content-on-surface">Uncategorized</span>
          <span class="text-xs text-content-secondary">({{ uncategorizedItems.length }})</span>
        </UiButton>
        <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" @click.stop="createItem">
          Add
        </UiButton>
      </div>
      <div v-if="!collapsedSections.has('uncategorized')" class="p-3 space-y-2">
        <BoardItemCard v-for="item in uncategorizedItems" :key="item.id" :item="item"
          :is-selected="props.selectedItemId === item.id" @select="emit('select-item', item.id)"
          @delete="emit('delete-item', item.id)" @move="(targetId) => itemsStore.moveItemToColumn(item.id, targetId)" />
        <div v-if="uncategorizedItems.length === 0" class="text-center text-content-secondary py-6 text-sm">
          No items yet
        </div>
      </div>
    </UiPanel>

    <!-- Column sections -->
    <UiPanel
      v-for="column in orderedColumns"
      :key="column.id"
      tag="section"
      variant="surface"
      size="xs"
      class-name="shadow-[var(--shadow-dropdown)]"
      content-class="p-0">
      <div class="flex items-center justify-between px-4 py-3 bg-surface-subtle group/header">
        <UiButton v-if="isEditingColumn !== column.id" variant="link" tone="neutral" class="flex items-center gap-2 flex-1 text-left justify-start no-underline"
          @click="toggleSection(column.id)">
          <Icon :name="collapsedSections.has(column.id) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-content-secondary" />
          <span class="font-semibold text-content-on-surface-strong dark:text-content-on-surface" dir="auto">{{ column.name
            }}</span>
          <span class="text-xs text-content-secondary">({{ getColumnItems(column.id).length }})</span>
        </UiButton>
        <div v-else class="flex items-center gap-2 flex-1" data-editing @click.stop @mousedown.stop>
          <UiInput v-model="editColumnName" size="xs" class="flex-1" dir="auto"
            :ref="(el: unknown) => setEditInputRef(column.id, (el as any)?.$el || (el as any) || null)"
            @keyup.enter="saveColumnName(column.id)" @keyup.escape="isEditingColumn = null"
            @blur="saveColumnName(column.id)" @click.stop @mousedown.stop />
        </div>
        <div class="flex items-center gap-1">
          <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus"
            @click.stop="handleCreateInColumn(column.id)">
            Add
          </UiButton>
          <UiActionMenu :items="getColumnActions(column.id)"
            :content="{ align: 'end', side: 'bottom', sideOffset: 4 }">
            <UiButton size="xs" color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" @click.stop />
          </UiActionMenu>
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
    </UiPanel>
  </div>
</template>
