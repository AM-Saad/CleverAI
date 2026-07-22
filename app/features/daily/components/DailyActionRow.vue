<template>
  <article
    class="action-row"
    :class="{ 'action-row--completed': item.completed }"
  >
    <UiCheckbox
      :model-value="item.completed"
      :aria-label="`Mark ${item.title} complete`"
      @update:model-value="$emit('toggle', Boolean($event))"
    />
    <div class="action-row__main">
      <p class="action-row__title">{{ item.title }}</p>
      <div class="action-row__meta">
        <UiPill
          v-if="item.timingLabel"
          size="sm"
          :label="item.timingLabel"
          :color="
            item.overdue
              ? 'var(--color-error)'
              : 'var(--color-content-secondary)'
          "
          variant="soft"
        />
        <span v-if="item.recurrenceLabel" class="action-row__repeat">
          <UiIcon name="i-lucide-repeat-2" class="h-3.5 w-3.5" />
          {{ item.recurrenceLabel }}
        </span>
        <span v-if="item.overdue" class="action-row__overdue">Overdue</span>
      </div>
    </div>
    <UiIconButton
      icon="i-lucide-calendar-clock"
      label="Move action item"
      size="sm"
      @click="$emit('move')"
    />
  </article>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
defineProps<{ item: DailyActionViewModel }>();
defineEmits<{ toggle: [completed: boolean]; move: [] }>();
</script>

<style scoped>
.action-row,
.action-row__meta {
  display: flex;
  align-items: center;
}

.action-row {
  gap: var(--space-3);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-secondary);
  align-items: start;
}

.action-row:last-child {
  border-bottom: 0;
}
.action-row__main {
  min-width: 0;
  flex: 1;
}
.action-row__title {
  overflow: hidden;
  color: var(--color-content-on-surface);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-row--completed .action-row__title {
  color: var(--color-content-disabled);
  text-decoration: line-through;
}
.action-row__meta {
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}
.action-row__repeat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.action-row__overdue {
  color: var(--color-error);
  font-weight: 700;
}
</style>
