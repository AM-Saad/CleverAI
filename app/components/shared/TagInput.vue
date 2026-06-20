<script setup lang="ts">
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
  return Array.from(tagsStore.tags.value.values()).sort(
    (a, b) => a.order - b.order,
  );
});

// Filter suggestions based on input
const suggestions = computed(() => {
  const search = inputValue.value.trim().toLowerCase();

  return availableTags.value.filter((tag) => {
    if (props.modelValue.includes(tag.name)) return false;
    return !search || tag.name.toLowerCase().includes(search);
  });
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
    props.modelValue.filter((t) => t !== tagName),
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
  } else if (
    e.key === "Backspace" &&
    !inputValue.value &&
    props.modelValue.length > 0
  ) {
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
    <UiPanel
      variant="surface"
      size="xs"
      class-name="focus-within:ring-2 focus-within:ring-[var(--ds-focus-outline-color)] focus-within:border-primary"
      content-class="flex flex-wrap gap-1.5"
    >
      <!-- Selected Tags -->
      <UiBadge
        v-for="tag in selectedTags"
        :key="tag.id"
        :style="{
          backgroundColor: tag.color,
          color: 'var(--color-on-primary) !important',
        }"
        variant="subtle"
        size="sm"
        class="rounded-[var(--radius-md)] px-2.5 mr-0.5"
      >
        {{ tag.name }}
        <UiButton
          type="button"
          tone="neutral"
          variant="ghost"
          size="xs"
          square
          @click="removeTag(tag.name)"
        >
          <Icon name="heroicons:x-mark-20-solid" class="w-3 h-3" />
        </UiButton>
      </UiBadge>

      <!-- Input -->
      <!-- design-allow native input is required inside the tokenized multi-tag input composition. -->
      <input
        v-model="inputValue"
        type="text"
        :placeholder="
          selectedTags.length === 0 ? placeholder || 'Add tags...' : ''
        "
        class="flex-1 min-w-30 outline-none bg-transparent text-sm"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <!-- Loading indicator -->
      <Icon
        v-if="isCreating"
        name="svg-spinners:ring-resize"
        class="w-4 h-4 text-content-secondary"
      />
    </UiPanel>

    <!-- Suggestions Dropdown -->
    <UiOverlaySurface
      v-if="showSuggestions && (suggestions.length > 0 || !!inputValue.trim())"
      kind="popover"
      layer="popover"
      size="xs"
      class-name="absolute mt-1 w-full max-h-48 overflow-y-auto p-0"
    >
      <!-- Existing tag suggestions -->
      <UiButton
        v-for="tag in suggestions"
        :key="tag.id"
        type="button"
        block
        tone="neutral"
        variant="ghost"
        class="justify-start"
        @click="addTag(tag.name)"
      >
        {{ tag.name }}
      </UiButton>

      <!-- Create new tag option -->
      <UiButton
        v-if="inputValue.trim() && !tagsStore.getTagByName(inputValue.trim())"
        type="button"
        block
        tone="neutral"
        variant="ghost"
        class="justify-start border-t border-secondary"
        @click="addTag(inputValue)"
      >
        <Icon name="heroicons:plus-circle" class="w-4 h-4 text-primary" />
        <span class="text-sm">Create "{{ inputValue.trim() }}"</span>
      </UiButton>
    </UiOverlaySurface>
  </div>
</template>
