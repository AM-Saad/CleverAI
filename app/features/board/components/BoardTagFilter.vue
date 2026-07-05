<script setup lang="ts">
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import type { UserTag } from "~/shared/utils/user-tag.contract";

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const route = useRoute();
const id = route.params.id;
const tagsStore = useUserTagsStore(id as string);
const isOpen = ref(false);

// Load tags on mount
onMounted(() => {
  if (tagsStore.tags.value.size === 0) {
    tagsStore.loadTags();
  }
});

// All tags sorted by order
const allTags = computed(() => {
  return Array.from(tagsStore.tags.value.values()).sort(
    (a, b) => a.order - b.order,
  );
});

// Toggle tag selection
const toggleTag = (tagName: string) => {
  const isSelected = props.modelValue.includes(tagName);
  if (isSelected) {
    emit(
      "update:modelValue",
      props.modelValue.filter((t) => t !== tagName),
    );
  } else {
    emit("update:modelValue", [...props.modelValue, tagName]);
  }
};

// Select all tags
const selectAll = () => {
  emit(
    "update:modelValue",
    allTags.value.map((t) => t.name),
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
  <UiPopover v-model:open="isOpen">
    <UiButton
      size="sm"
      :icon="selectedCount > 0 ? 'i-lucide-list-filter' : 'i-lucide-list-filter'"
      trailing-icon="i-lucide-chevron-down"
    >
      <span v-if="selectedCount === 0">Filter</span>
      <span v-else
        >{{ selectedCount }} tag{{ selectedCount === 1 ? "" : "s" }}</span
      >
    </UiButton>

    <template #content>
      <div class="w-64 p-2">
        <!-- Header -->
        <div class="flex items-center justify-between px-2 py-1 mb-2">
          <span class="text-xs font-medium text-content-secondary">
            Filter
          </span>
          <div class="flex gap-1">
            <UiButton
              v-if="selectedCount > 0"
              size="xs"
              tone="neutral"
              variant="ghost"
              @click="clearAll"
            >
              Clear
            </UiButton>
            <UiButton
              v-if="selectedCount < allTags.length"
              size="xs"
              tone="neutral"
              variant="ghost"
              @click="selectAll"
            >
              All
            </UiButton>
          </div>
        </div>

        <!-- Tag list -->
        <div
          v-if="allTags.length > 0"
          class="max-h-64 overflow-y-auto space-y-1"
        >
          <UiButton
            v-for="tag in allTags"
            :key="tag.id"
            block
            tone="neutral"
            variant="ghost"
            size="xs"
            class="justify-start"
            @click="toggleTag(tag.name)"
          >
            <Icon
              :name="
                modelValue.includes(tag.name)
                  ? 'i-lucide-circle-check'
                  : 'i-lucide-circle'
              "
              :class="[
                'w-4 h-4',
                modelValue.includes(tag.name)
                  ? 'text-primary'
                  : 'text-content-disabled',
              ]"
            />
            <UiBadge
              variant="subtle"
              size="sm"
              class="flex-1 justify-start"
              :style="{
                backgroundColor: tag.color,
                color: 'var(--color-content-on-surface)',
              }"
            >
              {{ tag.name }}
            </UiBadge>
          </UiButton>
        </div>

        <!-- Empty state -->
        <div
          v-else
          class="px-2 py-8 text-center text-sm text-content-secondary"
        >
          No tags yet. Create tags while adding notes.
        </div>

        <!-- Selected tags preview (when closed) -->
        <div
          v-if="selectedTags.length > 0"
          class="mt-2 pt-2 border-t border-secondary"
        >
          <div class="flex flex-wrap gap-1">
            <UiBadge
              v-for="tag in selectedTags.slice(0, 3)"
              :key="tag.id"
              variant="subtle"
              size="xs"
              :style="{
                backgroundColor: tag.color,
                color: 'var(--color-content-on-surface)',
              }"
            >
              {{ tag.name }}
            </UiBadge>
            <span
              v-if="selectedTags.length > 3"
              class="text-xs text-content-secondary"
            >
              +{{ selectedTags.length - 3 }} more
            </span>
          </div>
        </div>
      </div>
    </template>
  </UiPopover>
</template>
