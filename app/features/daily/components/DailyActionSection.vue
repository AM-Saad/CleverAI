<template>
  <section class="action-section" aria-labelledby="actions-title">
    <div class="action-section__head">
      <div>
        <UiTitle id="actions-title" tag="h2">Action items</UiTitle>
        <p>{{ openCount }} open · {{ completedCount }} completed</p>
      </div>
      <UiButton icon="i-lucide-plus" size="sm" @click="$emit('add')">Add</UiButton>
    </div>

    <DailyActionList v-if="items.length" :items="items" @toggle="emit('toggle', $event.occurrenceKey, $event.completed)"
      @move="emit('move', $event)" />
    <UiEmptyState v-else-if="!loading" icon="i-lucide-list-checks" title="No action items"
      description="Plan something for this day, or leave it open.">
      <UiButton variant="soft" @click="$emit('add')">Add an action</UiButton>
    </UiEmptyState>
    <UiSkeleton v-else class="h-24" />

    <div v-if="movedItems.length" class="moved-list">
      <p class="moved-list__label">Moved from this day</p>
      <div v-for="item in movedItems" :key="item.occurrenceKey" class="moved-row">
        <span>{{ item.title }}</span>
        <span>Moved to {{ item.movedDateLabel }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import DailyActionList from "~/features/daily/components/DailyActionList.vue";

defineProps<{
  items: readonly DailyActionViewModel[];
  movedItems: readonly DailyActionViewModel[];
  openCount: number;
  completedCount: number;
  loading: boolean;
}>();
const emit = defineEmits<{
  add: [];
  toggle: [occurrenceKey: string, completed: boolean];
  move: [occurrenceKey: string];
}>();
</script>

<style scoped>
.action-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.action-section__head,
.moved-row {
  display: flex;
  align-items: center;
}

.action-section__head {
  justify-content: space-between;
}

.action-section__head p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.action-section__head :deep(h2) {
  font-size: var(--text-lg);
}

.moved-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--color-secondary);
}

.moved-list__label {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.moved-row {
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-content-disabled);
  font-size: var(--text-sm);
}
</style>
