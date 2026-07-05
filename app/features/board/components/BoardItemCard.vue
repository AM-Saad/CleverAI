<script setup lang="ts">
import type { BoardItemState } from "../composables/useBoardItemsStore";
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import { useBoardColumnsStore } from "../composables/useBoardColumnsStore";

const props = defineProps<{
  item: BoardItemState;
  isSelected?: boolean;
}>();

const emit = defineEmits<{
  select: [];
  delete: [];
  "update:tags": [tags: string[]];
  move: [columnId: string | null];
}>();

const route = useRoute();
const id = route.params.id;
const tagsStore = useUserTagsStore();
const columnsStore = useBoardColumnsStore(id as string);

// Column options for movement
const columnOptions = computed(() => {
  const options = [
    [{ label: "Uncategorized", onSelect: () => emit("move", null) }],
  ];

  const columnItems = columnsStore
    .getOrderedColumns()
    .filter((col) => col.id !== props.item.columnId)
    .map((col) => ({
      label: col.name,
      onSelect: () => emit("move", col.id),
    }));

  if (columnItems.length > 0) {
    options.push(columnItems);
  }

  return options;
});

// Strip HTML for preview
const plainContent = computed(() => {
  return props.item.content.replace(/<[^>]*>/g, "").trim() || "Empty note";
});

// Get tag objects for display
const noteTags = computed(() => {
  return (
    props.item.tags
      ?.map((name) => tagsStore.getTagByName(name))
      .filter((tag) => tag !== null) || []
  );
});

// Due date display
const dueDateInfo = computed(() => {
  if (!props.item.dueDate) return null;
  const d = new Date(props.item.dueDate as string);
  const now = new Date();
  const isOverdue = d < now;
  const label = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { label, isOverdue };
});

// Attachment count
const attachmentCount = computed(() => (props.item.attachments || []).length);

// Formatted date
const formattedDate = computed(() => {
  const date = props.item.updatedAt;
  if (!date) return "";

  const now = new Date();
  const noteDate = new Date(date);
  const diffMs = now.getTime() - noteDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return noteDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
});
</script>

<template>
  <div
    :class="[
      'group relative',
      item.isLoading && 'opacity-60 pointer-events-none grayscale',
    ]"
  >
    <!-- Drag Handle (Mobile/Tablet Friendly) -->
    <div class="board-item-card__drag" aria-hidden="true">
      <div class="board-item-card__drag-dot" />
      <div class="board-item-card__drag-dot" />
      <div class="board-item-card__drag-dot" />
    </div>

    <UiItemCard
      clickable
      :selected="isSelected"
      variant="soft"
      size="sm"
      :disabled="item.isLoading"
      :show-body="false"
      :class-name="
        ['board-item-card__surface', item.error && 'border-error/30 bg-error/5']
          .filter(Boolean)
          .join(' ')
      "
      @click="emit('select')"
    >
      <template #title>
        <span dir="auto">{{ plainContent.slice(0, 40) }}</span>
      </template>
      <template v-if="item.isLoading || item.error" #status>
        <Icon
          v-if="item.isLoading"
          name="svg-spinners:ring-resize"
          class="h-4 w-4 text-primary"
        />
        <Icon
          v-else-if="item.error"
          name="i-lucide-circle-alert"
          class="h-4 w-4 text-error-text"
          :title="item.error"
        />
      </template>

      <template v-if="noteTags.length" #kicker>
        <UiPill
          v-for="tag in noteTags"
          :key="tag.id"
          size="sm"
          variant="fill"
          :label="tag.name"
          :color="tag.color ?? 'var(--color-primary)'"
          max-width="150px"
        />
      </template>

      <template #footer>
        <UiPill
          v-if="dueDateInfo"
          size="sm"
          variant="outline"
          :active="dueDateInfo.isOverdue"
          :label="dueDateInfo.label"
          :color="
            dueDateInfo.isOverdue
              ? 'var(--color-error)'
              : 'var(--color-success)'
          "
          max-width="92px"
        >
          <template #indicator>
            <UiPillIcon name="i-lucide-calendar-days" size="sm" />
          </template>
        </UiPill>
        <UiPill
          v-if="attachmentCount > 0"
          size="sm"
          :label="String(attachmentCount)"
          color="var(--color-content-secondary)"
          max-width="76px"
        >
          <template #indicator>
            <UiPillIcon name="i-lucide-paperclip" size="sm" />
          </template>
        </UiPill>
        <span class="board-item-card__date">{{ formattedDate }}</span>
      </template>
    </UiItemCard>

    <!-- Secondary actions are siblings, not nested inside the clickable card target. -->
    <div
      class="absolute bottom-2 right-2 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    >
      <UiActionMenu
        :items="columnOptions"
        :content="{ align: 'start', side: 'bottom', sideOffset: 4 }"
      >
        <UiIconButton
          icon="i-lucide-arrow-left-right"
          label="Move to column"
          size="xs"
          variant="ghost"
          class="hover:bg-primary/10"
        />
      </UiActionMenu>

      <UiDoubleTapDeleteButton
        hide-label
        stop-propagation
        icon="i-lucide-trash-2"
        label="Delete item"
        armed-label="Tap again to delete item"
        size="xs"
        variant="ghost"
        class="hover:bg-error/10 hover:text-error-text"
        :reset-key="item.id"
        @confirm="emit('delete')"
      />
    </div>

    <!-- Dirty indicator -->
    <div
      v-if="item.isDirty && !item.error"
      class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-warning rounded-full border-2 border-white shadow-[var(--shadow-dropdown)]"
      title="Unsaved changes"
    />
    <div
      v-else-if="item.error"
      class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-white shadow-[var(--shadow-dropdown)]"
      title="Sync failed. Open item details to retry."
    />
  </div>
</template>

<style scoped>
.board-item-card__surface {
  padding-right: calc(var(--space-3) + 56px);
}

.board-item-card__drag {
  position: absolute;
  left: calc(var(--space-1) * -1);
  top: 50%;
  z-index: 1;
  display: flex;
  width: var(--space-2);
  height: var(--space-6);
  cursor: grab;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--color-content-disabled);
  opacity: 1;
  transition: opacity var(--duration-fast) var(--ease-standard);
  transform: translateY(-50%);
}

.board-item-card__drag:active {
  cursor: grabbing;
}

.board-item-card__drag-dot {
  width: var(--space-1);
  height: var(--space-1);
  border-radius: var(--radius-full);
  background: currentColor;
}

.board-item-card__date {
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--color-content-secondary);
}

@media (min-width: 1024px) {
  .board-item-card__drag {
    opacity: 0;
  }

  .group:hover .board-item-card__drag {
    opacity: 1;
  }
}
</style>
