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
    <UiButton
      type="button"
      tone="neutral"
      variant="link"
      class="action-row__main"
      :aria-label="`Edit ${item.title}`"
      @click="$emit('edit')"
    >
      <UiParagraph
        tag="p"
        size="base"
        :color="item.completed ? 'disabled' : 'content-on-surface'"
        class="truncate leading-none"
        :class="{ 'line-through': item.completed }"
        >{{ item.title }}</UiParagraph
      >
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
    </UiButton>
    <div class="action-row__actions">
      <UiIconButton
        icon="i-lucide-pencil"
        label="Edit action item"
        size="sm"
        @click="$emit('edit')"
      />
      <UiIconButton
        icon="i-lucide-calendar-clock"
        label="Move action item"
        size="sm"
        @click="$emit('move')"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
defineProps<{ item: DailyActionViewModel }>();
defineEmits<{ toggle: [completed: boolean]; edit: []; move: [] }>();
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
  display: block;
  min-width: 0;
  flex: 1;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: none !important;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
}

.action-row__main:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
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

.action-row__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__overdue {
  color: var(--color-error);
  /* font-weight: 700; */
}
</style>
