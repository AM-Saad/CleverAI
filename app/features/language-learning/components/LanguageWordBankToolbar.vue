<template>
  <section class="word-bank-toolbar" aria-label="Word bank filters">
    <div class="word-bank-toolbar__search-row">
      <UiInput
        v-model="search"
        type="search"
        icon="i-lucide-search"
        placeholder="Search saved words…"
        class="word-bank-toolbar__search"
      />
      <Transition name="word-bank-toolbar__clear">
        <UiButton
          v-if="hasActiveFilters"
          size="xs"
          variant="ghost"
          tone="neutral"
          leading-icon="i-lucide-x"
          @click="clearFilters"
        >
          Clear
        </UiButton>
      </Transition>
    </div>

    <div class="word-bank-toolbar__group">
      <UiLabel size="sm" weight="bold" color="content-secondary" uppercase>Status</UiLabel>
      <div class="word-bank-toolbar__status-scroll">
        <UiSegmentedControl
          v-model="status"
          label="Word status"
          size="sm"
          :items="statusFilters"
        />
      </div>
    </div>

    <div class="word-bank-toolbar__group">
      <UiLabel size="sm" weight="bold" color="content-secondary" uppercase>Refine</UiLabel>
      <div class="word-bank-toolbar__refine-row">
        <UiPill
          clickable
          selectable
          :active="storyOnly"
          icon="i-lucide-sparkles"
          label="Stories only"
          color="var(--color-primary)"
          variant="outline"
          size="sm"
          class="word-bank-toolbar__story-pill"
          @click="storyOnly = !storyOnly"
        />
        <UiSelect
          v-model="selectedCategory"
          :items="categories"
          value-key="value"
          label-key="label"
          size="sm"
          class="word-bank-toolbar__category"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type LanguageWordStatusFilter =
  | "all"
  | "captured"
  | "story_ready"
  | "enrolled"
  | "mastered";
const search = defineModel<string>("search", { required: true });
const status = defineModel<LanguageWordStatusFilter>("status", {
  required: true,
});
const storyOnly = defineModel<boolean>("storyOnly", { required: true });
const selectedCategory = defineModel<string>("category", { required: true });
defineProps<{
  statusFilters: readonly {
    value: LanguageWordStatusFilter;
    label: string;
    count: number;
  }[];
  categories: readonly { value: string; label: string }[];
}>();

const hasActiveFilters = computed(
  () =>
    Boolean(search.value.trim()) ||
    status.value !== "all" ||
    storyOnly.value ||
    selectedCategory.value !== "all",
);

function clearFilters() {
  search.value = "";
  status.value = "all";
  storyOnly.value = false;
  selectedCategory.value = "all";
}
</script>

<style scoped>
.word-bank-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--ds-surface-card);
}
.word-bank-toolbar__search-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.word-bank-toolbar__search {
  min-width: 0;
  flex: 1 1 auto;
}
.word-bank-toolbar__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.word-bank-toolbar__status-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  /* Fades the right edge so overflow reads as "scroll for more", not a hard
     crop — five segments + counts can outgrow a narrow viewport. */
  mask-image: linear-gradient(to right, black calc(100% - 24px), transparent);
}
.word-bank-toolbar__status-scroll::-webkit-scrollbar {
  display: none;
}
.word-bank-toolbar__refine-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.word-bank-toolbar__story-pill {
  flex-shrink: 0;
}
.word-bank-toolbar__category {
  min-width: 0;
  flex: 1 1 auto;
}
.word-bank-toolbar__clear-enter-active,
.word-bank-toolbar__clear-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.word-bank-toolbar__clear-enter-from,
.word-bank-toolbar__clear-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
