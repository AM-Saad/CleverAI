<script setup lang="ts">
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import type { UserTag } from "~/shared/utils/user-tag.contract";

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const tagsStore = useUserTagsStore();
const isOpen = ref(false);

// Load tags on mount
onMounted(() => {
  if (tagsStore.tags.value.size === 0) {
    tagsStore.loadTags();
  }
});

// All tags sorted by order
const allTags = computed(() => {
  return Array.from(tagsStore.tags.value.values()).sort((a, b) => a.order - b.order);
});

// Toggle tag selection
const toggleTag = (tagName: string) => {
  const isSelected = props.modelValue.includes(tagName);
  if (isSelected) {
    emit(
      "update:modelValue",
      props.modelValue.filter((t) => t !== tagName)
    );
  } else {
    emit("update:modelValue", [...props.modelValue, tagName]);
  }
};

// Select all tags
const selectAll = () => {
  emit(
    "update:modelValue",
    allTags.value.map((t) => t.name)
  );
};

// Clear all selections
const clearAll = () => {
  emit("update:modelValue", []);
};

// Count of selected tags
const selectedCount = computed(() => props.modelValue.length);

// Selected tag objects for display
const selectedTags = computed(() => {
  return props.modelValue
    .map((name) => tagsStore.getTagByName(name))
    .filter((tag): tag is UserTag => tag !== null);
});
</script>

<template>
  <UPopover v-model:open="isOpen">
    <template #default="{ open }">
      <UButton color="neutral" variant="solid" :icon="selectedCount > 0 ? 'heroicons:funnel-solid' : 'heroicons:funnel'"
        trailing-icon="heroicons:chevron-down-20-solid">
        <span v-if="selectedCount === 0">Filter by tags</span>
        <span v-else>{{ selectedCount }} tag{{ selectedCount === 1 ? '' : 's' }}</span>
      </UButton>
    </template>

    <template #content>
      <div class="w-64 p-2">
        <!-- Header -->
        <div class="flex items-center justify-between px-2 py-1 mb-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
            Filter by tags
          </span>
          <div class="flex gap-1">
            <UButton v-if="selectedCount > 0" size="xs" color="neutral" variant="ghost" @click="clearAll">
              Clear
            </UButton>
            <UButton v-if="selectedCount < allTags.length" size="xs" color="neutral" variant="ghost" @click="selectAll">
              All
            </UButton>
          </div>
        </div>

        <!-- Tag list -->
        <div v-if="allTags.length > 0" class="max-h-64 overflow-y-auto space-y-1">
          <button v-for="tag in allTags" :key="tag.id" type="button"
            class="w-full px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            @click="toggleTag(tag.name)">
            <Icon :name="modelValue.includes(tag.name)
                ? 'heroicons:check-circle-solid'
                : 'heroicons:circle'
              " :class="[
                'w-4 h-4',
                modelValue.includes(tag.name)
                  ? 'text-primary-500'
                  : 'text-gray-300 dark:text-gray-600',
              ]" />
            <UBadge :color="(tag.color as any)" variant="subtle" size="sm" class="flex-1 justify-start">
              {{ tag.name }}
            </UBadge>
          </button>
        </div>

        <!-- Empty state -->
        <div v-else class="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No tags yet. Create tags while adding notes.
        </div>

        <!-- Selected tags preview (when closed) -->
        <div v-if="selectedTags.length > 0" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div class="flex flex-wrap gap-1">
            <UBadge v-for="tag in selectedTags.slice(0, 3)" :key="tag.id" :color="(tag.color as any)" variant="subtle"
              size="xs">
              {{ tag.name }}
            </UBadge>
            <span v-if="selectedTags.length > 3" class="text-xs text-gray-500 dark:text-gray-400">
              +{{ selectedTags.length - 3 }} more
            </span>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
