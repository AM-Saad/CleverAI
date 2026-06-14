<template>
  <div class="mx-auto flex max-w-md flex-col items-center justify-center py-12 text-center">
    <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-surface-subtle ring-1 ring-secondary">
      <Icon name="i-lucide-inbox" class="h-6 w-6 text-content-secondary" />
    </div>
    <h3 class="text-base font-semibold text-content-on-surface">
      No review cards due
    </h3>
    <p class="mt-1 text-sm text-content-secondary">
      {{ emptyMessage }}
    </p>
    <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
      <UiButton size="sm" tone="neutral" variant="outline" @click="$emit('refresh')">
        <Icon name="i-lucide-refresh-cw" class="h-4 w-4" />
        Refresh
      </UiButton>
      <UiButton
        v-if="studySessionReviews > 0"
        size="sm"
        tone="neutral"
        variant="ghost"
        @click="$emit('showAnalytics')"
      >
        <Icon name="i-lucide-chart-no-axes-column" class="h-4 w-4" />
        View analytics
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  studySessionReviews?: number;
}>(), {
  studySessionReviews: 0,
});

defineEmits<{
  refresh: [];
  showAnalytics: [];
}>();

const emptyMessage = computed(() =>
  props.studySessionReviews > 0
    ? "You finished the available cards for this session."
    : "Enroll flashcards, questions, or materials, then refresh when they are due.",
);
</script>
