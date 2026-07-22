<template>
  <section class="word-bank-toolbar" aria-label="Word bank filters">
    <UiInput
      v-model="search"
      type="search"
      icon="i-lucide-search"
      placeholder="Search saved words…"
    />
    <div class="word-bank-toolbar__row" role="tablist" aria-label="Word status">
      <UiPill
        v-for="filter in statusFilters"
        :key="filter.value"
        clickable
        role="tab"
        :aria-selected="status === filter.value"
        :active="status === filter.value"
        :label="filter.label"
        color="var(--color-primary)"
        variant="outline"
        size="sm"
        max-width="140px"
        @click="status = filter.value"
      >
        <template #icon
          ><span class="word-bank-toolbar__count">{{
            filter.count
          }}</span></template
        >
      </UiPill>
    </div>
    <div
      class="word-bank-toolbar__row word-bank-toolbar__row--compact"
      aria-label="Additional filters"
    >
      <UiPill
        clickable
        selectable
        :active="storyOnly"
        label="Stories"
        color="var(--color-primary)"
        variant="outline"
        size="sm"
        max-width="100px"
        @click="storyOnly = !storyOnly"
      />
      <UiPill
        v-for="category in categories"
        :key="category"
        clickable
        selectable
        :active="selectedCategory === category"
        :label="category === 'all' ? 'All categories' : category"
        color="var(--color-primary)"
        variant="outline"
        size="sm"
        max-width="140px"
        @click="selectedCategory = category"
      />
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
  categories: readonly string[];
}>();
</script>

<style scoped>
.word-bank-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--ds-surface-card);
}
.word-bank-toolbar__row {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.word-bank-toolbar__row::-webkit-scrollbar {
  display: none;
}
.word-bank-toolbar__row--compact {
  gap: 5px;
}
.word-bank-toolbar__count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  background: color-mix(
    in srgb,
    var(--color-content-on-background) 7%,
    transparent
  );
  font-size: 10px;
  text-align: center;
}
</style>
