<template>
  <div class="action-skeleton" role="status">
    <div v-for="row in rows" :key="row" class="action-skeleton__row">
      <UiSkeleton shape="circle" width="1.25rem" height="1.25rem" />
      <div class="action-skeleton__main">
        <UiSkeleton
          shape="text"
          :width="titleWidths[(row - 1) % titleWidths.length]"
          height="1rem"
        />
        <UiSkeleton
          v-if="showMeta"
          shape="text"
          :width="metaWidths[(row - 1) % metaWidths.length]"
          height="0.75rem"
        />
      </div>
      <div class="action-skeleton__actions">
        <UiSkeleton shape="circle" width="2rem" height="2rem" />
        <UiSkeleton shape="circle" width="2rem" height="2rem" />
      </div>
    </div>
    <span class="sr-only">Loading action items</span>
  </div>
</template>

<script setup lang="ts">
const { rows = 3, showMeta = true } = defineProps<{
  rows?: number;
  showMeta?: boolean;
}>();

const titleWidths = ["68%", "52%", "76%"] as const;
const metaWidths = ["34%", "42%", "28%"] as const;
</script>

<style scoped>
.action-skeleton {
  overflow: hidden;
}

.action-skeleton__row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-height: 3.5rem;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.action-skeleton__row:last-of-type {
  border-bottom: 0;
}

.action-skeleton__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: 0.125rem;
}

.action-skeleton__actions {
  display: flex;
  gap: var(--space-1);
}
</style>
