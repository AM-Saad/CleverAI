<script setup lang="ts">
import type { BoardItemState } from "~/composables/board/useBoardItemsStore";
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import { useBoardColumnsStore } from "~/composables/board/useBoardColumnsStore";

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
    [
      { label: "Uncategorized", onSelect: () => emit('move', null) }
    ]
  ];

  const columnItems = columnsStore.getOrderedColumns()
    .filter(col => col.id !== props.item.columnId)
    .map(col => ({
      label: col.name,
      onSelect: () => emit('move', col.id)
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
  return props.item.tags
    ?.map((name) => tagsStore.getTagByName(name))
    .filter((tag) => tag !== null) || [];
});

// Due date display
const dueDateInfo = computed(() => {
  if (!props.item.dueDate) return null;
  const d = new Date(props.item.dueDate as string);
  const now = new Date();
  const isOverdue = d < now;
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  return noteDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
});
</script>

<template>
  <div :class="[
    'group relative p-2 rounded-[var(--radius-xl)] border cursor-pointer transition-all duration-200',
    'hover:shadow-xs hover:-translate-y-0.5',
    isSelected
      ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
      : 'border-surface-subtle bg-white hover:border-surface-strong',
    item.isLoading && 'opacity-60 pointer-events-none grayscale',
    item.error && 'border-error/30 bg-error/5 ',
  ]" @click="emit('select')">

    <!-- Drag Handle (Mobile/Tablet Friendly) -->
    <div
      class="lg:opacity-0 lg:group-hover:opacity-100 absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-6 flex flex-col justify-center items-center gap-0.5 text-content-disabled cursor-grab active:cursor-grabbing transition-opacity"
      aria-hidden="true">
      <div class="w-1 h-1 bg-current rounded-full" />
      <div class="w-1 h-1 bg-current rounded-full" />
      <div class="w-1 h-1 bg-current rounded-full" />
    </div>

    <!-- Loading/Error indicators -->
    <div v-if="item.isLoading" class="absolute top-3 right-3 flex items-center gap-1 text-primary">
      <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
    </div>

    <div v-if="item.error" class="absolute top-3 right-3 text-error" :title="item.error">
      <Icon name="heroicons:exclamation-circle" class="w-4 h-4" />
    </div>

    <!-- Item content preview -->
    <div class="space-y-3">
      <!-- Content -->
      <ui-paragraph class=" line-clamp-3 leading-relaxed">
        {{ plainContent.slice(0, 40) }}
      </ui-paragraph>

      <!-- Tags -->
      <UBadge v-for="tag in noteTags" :key="tag.id" :style="{ backgroundColor: tag.color, color: '#ffffff' }"
        variant="solid" size="sm" class="rounded-full px-2.5 mr-0.5">
        {{ tag.name }}
      </UBadge>

      <!-- Due date + attachments row -->
      <div v-if="dueDateInfo || attachmentCount > 0" class="flex items-center gap-2 flex-wrap mt-0.5">
        <span v-if="dueDateInfo" :class="['inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5',
          dueDateInfo.isOverdue
            ? 'bg-error/10 text-error dark:bg-error/20'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20']">
          <Icon name="heroicons:calendar-days" class="w-3 h-3" />
          {{ dueDateInfo.label }}
        </span>
        <span v-if="attachmentCount > 0"
          class="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-secondary text-content-secondary">
          <Icon name="heroicons:paper-clip" class="w-3 h-3" />
          {{ attachmentCount }}
        </span>
      </div>

      <!-- Footer: Date + Actions -->
      <div
        class="flex items-center justify-between text-[10px] font-semibold text-content-secondary  uppercase pt-2 border-t border-secondary">
        <span class="truncate">{{ formattedDate }}</span>

        <!-- Actions (visible on hover) -->
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <!-- Move to column -->
          <UDropdownMenu :items="columnOptions" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
            <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:arrows-right-left"
              aria-label="Move to column" title="Move to column" class="hover:bg-primary/10" @click.stop />
          </UDropdownMenu>

          <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:trash" @click.stop="emit('delete')"
            aria-label="Delete note" class="hover:bg-error/10 hover:text-error" />
        </div>
      </div>
    </div>

    <!-- Dirty indicator -->
    <div v-if="item.isDirty"
      class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white shadow-sm"
      title="Unsaved changes" />
  </div>
</template>
