<template>
  <div class="action-list">
    <DailyActionRow v-for="item in items" :key="item.occurrenceKey" :item="item" @toggle="
      $emit('toggle', {
        occurrenceKey: item.occurrenceKey,
        completed: $event,
      })
      " @move="$emit('move', item.occurrenceKey)" />
  </div>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import DailyActionRow from "~/features/daily/components/DailyActionRow.vue";
defineProps<{ items: readonly DailyActionViewModel[] }>();
defineEmits<{
  toggle: [payload: { occurrenceKey: string; completed: boolean }];
  move: [occurrenceKey: string];
}>();
</script>

<style scoped>
.action-list {
  overflow: hidden;
  background: var(--color-surface-subtle);
}
</style>
