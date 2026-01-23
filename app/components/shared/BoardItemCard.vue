<script setup lang="ts">
import type { BoardItemState } from "~/composables/useBoardItemsStore";
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import { useBoardColumnsStore } from "~/composables/useBoardColumnsStore";

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

const tagsStore = useUserTagsStore();
const columnsStore = useBoardColumnsStore();

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
    'group relative p-2 rounded-xl border cursor-pointer transition-all duration-200',
    'hover:shadow-lg hover:-translate-y-0.5',
    isSelected
      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 shadow-md ring-1 ring-primary-500/20'
      : 'border-muted dark:border-gray-800 bg-white dark:bg-muted  hover:border-primary dark:hover:border-primary-800',
    item.isLoading && 'opacity-60 pointer-events-none grayscale',
    item.error && 'border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20',
  ]" @click="emit('select')">

    <!-- Drag Handle (Mobile/Tablet Friendly) -->
    <div
      class="lg:opacity-0 lg:group-hover:opacity-100 absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-6 flex flex-col justify-center items-center gap-0.5 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing transition-opacity"
      aria-hidden="true">
      <div class="w-1 h-1 bg-current rounded-full" />
      <div class="w-1 h-1 bg-current rounded-full" />
      <div class="w-1 h-1 bg-current rounded-full" />
    </div>

    <!-- Loading/Error indicators -->
    <div v-if="item.isLoading" class="absolute top-3 right-3 flex items-center gap-1 text-primary-500">
      <Icon name="svg-spinners:ring-resize" class="w-4 h-4" />
    </div>

    <div v-if="item.error" class="absolute top-3 right-3 text-red-500" :title="item.error">
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

      <!-- Footer: Date + Actions -->
      <div
        class="flex items-center justify-between text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase pt-2 border-t border-gray-50 dark:border-gray-700/50">
        <span class="truncate">{{ formattedDate }}</span>

        <!-- Actions (visible on hover) -->
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <!-- Move to column -->
          <UDropdownMenu :items="columnOptions" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
            <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:arrows-right-left"
              aria-label="Move to column" title="Move to column"
              class="hover:bg-primary-50 dark:hover:bg-primary-900/20" @click.stop />
          </UDropdownMenu>

          <UButton size="xs" color="neutral" variant="ghost" icon="heroicons:trash" @click.stop="emit('delete')"
            aria-label="Delete note" class="hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500" />
        </div>
      </div>
    </div>

    <!-- Dirty indicator -->
    <div v-if="item.isDirty"
      class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
      title="Unsaved changes" />
  </div>
</template>
