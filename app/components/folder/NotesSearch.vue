<template>
  <div class="sticky top-0 z-10 flex items-center gap-4">
    <u-input v-model="search" placeholder="Search in notes" type="text" class="w-full" :ui="{
      base: 'border-0 ring-0 h-10 bg-white dark:bg-dark border-b border-neutral dark:border-secondary rounded-none focus-within:border-0',
    }" @focus="onFocus && onFocus()" @blur="onBlur && onBlur()" />
  </div>
</template>
<script setup lang="ts">
import type { UseFuseOptions } from "@vueuse/integrations/useFuse";
import { useFuse } from "@vueuse/integrations/useFuse";
import { computed, shallowRef, watch } from "vue";

const props = defineProps<{
  folderId: string;
  onFocus?: () => void;
  onBlur?: () => void;
}>();

const notesStore = useNotesStore(props.folderId);
// Computed properties for reactive data
const notes = computed(() => {
  const allNotes = Array.from(notesStore.notes.value.values());
  // Sort by order field
  return allNotes.sort((a, b) => a.order - b.order);
});

const search = shallowRef("");

const resultLimit = shallowRef<number | undefined>(undefined);
const resultLimitString = shallowRef<string>("");
watch(resultLimitString, () => {
  if (resultLimitString.value === "") {
    resultLimit.value = undefined;
  } else {
    const float = Number.parseFloat(resultLimitString.value);
    if (!Number.isNaN(float)) {
      resultLimit.value = Math.round(float);
      resultLimitString.value = resultLimit.value.toString();
    }
  }
});

const exactMatch = shallowRef(false);
const isCaseSensitive = shallowRef(false);
const matchAllWhenSearchEmpty = shallowRef(false);

const options = computed<UseFuseOptions<NoteState>>(() => ({
  fuseOptions: {
    keys: ["content"],
    isCaseSensitive: isCaseSensitive.value,
    threshold: exactMatch.value ? 0 : 0.3, // Lower = stricter (0.0 = exact, 1.0 = match anything)
    distance: 100, // Maximum distance for fuzzy matching
    minMatchCharLength: 2, // Minimum character length for a match
    ignoreLocation: true, // Search entire string, not just beginning
  },
  resultLimit: resultLimit.value,
  matchAllWhenSearchEmpty: matchAllWhenSearchEmpty.value,
}));

const { results } = useFuse(search, notes, options);

// Expose filtered note IDs as a computed Set for O(1) lookup
const filteredNoteIds = computed(() => {
  if (!search.value.trim()) {
    return null; // No filter active
  }
  return new Set(results.value.map((r) => r.item.id));
});

// Update store's filtered state whenever results change
watch(
  filteredNoteIds,
  (newFilteredIds) => {
    if (notesStore.setFilteredNoteIds) {
      notesStore.setFilteredNoteIds(newFilteredIds);
    }
  },
  { immediate: true }
);
</script>
