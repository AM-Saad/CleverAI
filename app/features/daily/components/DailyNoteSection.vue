<template>
  <section class="note-section" aria-labelledby="note-title">
    <div class="note-section__head">
      <div>
        <UiTitle id="note-title" tag="h2">Daily note</UiTitle>
        <p>One continuous note for this day</p>
      </div>
      <span class="note-section__save-state">{{ saveState }}</span>
    </div>

    <DailyNoteConflictPanel v-if="conflict" :conflict="conflict" @resolve="$emit('resolve', $event)" />
    <DailyRichEditor :key="dateKey" :model-value="modelValue" :readonly="Boolean(conflict)"
      @update:model-value="$emit('update:modelValue', $event)" @blur="$emit('blur')" />
  </section>
</template>

<script setup lang="ts">
import type { DailyNoteConflict } from "../repositories/dailyLocalRepository";
import DailyNoteConflictPanel from "~/features/daily/components/DailyNoteConflictPanel.vue";
import DailyRichEditor from "~/features/daily/components/DailyRichEditor.vue";


defineProps<{
  dateKey: string;
  modelValue: unknown;
  saveState: string;
  conflict: DailyNoteConflict | null;
}>();
defineEmits<{
  "update:modelValue": [value: unknown];
  blur: [];
  resolve: [strategy: "keep-local" | "keep-server"];
}>();
</script>

<style scoped>
.note-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.note-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.note-section__head p,
.note-section__save-state {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.note-section__head :deep(h2) {
  font-size: var(--text-lg);
}
</style>
