<script setup lang="ts">
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import type { UserTag } from "~/shared/utils/user-tag.contract";

const props = defineProps<{
  modelValue: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const tagsStore = useUserTagsStore();
const inputValue = ref("");
const isCreating = ref(false);
const showSuggestions = ref(false);

// Load tags on mount
onMounted(() => {
  if (tagsStore.tags.value.size === 0) {
    tagsStore.loadTags();
  }
});

// All available tags sorted by order
const availableTags = computed(() => {
  return Array.from(tagsStore.tags.value.values()).sort((a, b) => a.order - b.order);
});

// Filter suggestions based on input
const suggestions = computed(() => {
  if (!inputValue.value.trim()) return [];

  const search = inputValue.value.toLowerCase();
  return availableTags.value.filter(
    (tag) =>
      tag.name.toLowerCase().includes(search) &&
      !props.modelValue.includes(tag.name)
  );
});

// Currently selected tags as tag objects
const selectedTags = computed(() => {
  return props.modelValue
    .map((tagName) => tagsStore.getTagByName(tagName))
    .filter((tag): tag is UserTag => tag !== null);
});

// Add tag (existing or new)
const addTag = async (tagName: string) => {
  const trimmed = tagName.trim();
  if (!trimmed || props.modelValue.includes(trimmed)) return;

  // Check if tag exists
  let existingTag = tagsStore.getTagByName(trimmed);

  // Create new tag if it doesn't exist
  if (!existingTag) {
    isCreating.value = true;
    const tagId = await tagsStore.createTag(trimmed);
    isCreating.value = false;

    if (!tagId) return; // Failed to create
    existingTag = tagsStore.getTag(tagId);
    if (!existingTag) return;
  }

  // Add to selected tags
  emit("update:modelValue", [...props.modelValue, existingTag.name]);
  inputValue.value = "";
  showSuggestions.value = false;
};

// Remove tag
const removeTag = (tagName: string) => {
  emit(
    "update:modelValue",
    props.modelValue.filter((t) => t !== tagName)
  );
};

// Handle input keydown
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && inputValue.value.trim()) {
    e.preventDefault();
    if (suggestions.value.length > 0 && suggestions.value[0]) {
      addTag(suggestions.value[0].name);
    } else {
      addTag(inputValue.value);
    }
  } else if (e.key === "Backspace" && !inputValue.value && props.modelValue.length > 0) {
    const lastTag = props.modelValue[props.modelValue.length - 1];
    if (lastTag) {
      removeTag(lastTag);
    }
  }
};

// Show/hide suggestions
const handleFocus = () => {
  showSuggestions.value = true;
};

const handleBlur = () => {
  // Delay to allow click on suggestions
  setTimeout(() => {
    showSuggestions.value = false;
  }, 200);
};
</script>

<template>
  <div class="relative">
    <!-- Selected Tags + Input -->
    <div
      class="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
      <!-- Selected Tags -->
      <UBadge v-for="tag in selectedTags" :key="tag.id"
        :style="{ backgroundColor: tag.color, color: '#ffffff !important' }" variant="subtle" size="sm"
        class="flex items-center gap-1">
        {{ tag.name }}
        <button type="button" @click="removeTag(tag.name)"
          class="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5">
          <Icon name="heroicons:x-mark-20-solid" class="w-3 h-3" />
        </button>
      </UBadge>

      <!-- Input -->
      <input v-model="inputValue" type="text"
        :placeholder="selectedTags.length === 0 ? (placeholder || 'Add tags...') : ''"
        class="flex-1 min-w-30 outline-none bg-transparent text-sm" @keydown="handleKeydown" @focus="handleFocus"
        @blur="handleBlur" />

      <!-- Loading indicator -->
      <Icon v-if="isCreating" name="svg-spinners:ring-resize" class="w-4 h-4 text-gray-400" />
    </div>

    <!-- Suggestions Dropdown -->
    <div v-if="showSuggestions && (suggestions.length > 0 || inputValue.trim())"
      class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
      <!-- Existing tag suggestions -->
      <button v-for="tag in suggestions" :key="tag.id" type="button"
        class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        @click="addTag(tag.name)">
        <UBadge :style="{ color: '#ffffff !important', backgroundColor: tag.color }" variant="subtle" size="sm">
          {{ tag.name }}
        </UBadge>
      </button>

      <!-- Create new tag option -->
      <button v-if="inputValue.trim() && !tagsStore.getTagByName(inputValue.trim())" type="button"
        class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-t border-gray-200 dark:border-gray-600"
        @click="addTag(inputValue)">
        <Icon name="heroicons:plus-circle" class="w-4 h-4 text-primary-500" />
        <span class="text-sm">Create "{{ inputValue.trim() }}"</span>
      </button>
    </div>
  </div>
</template>
