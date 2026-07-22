<template>
  <UiPanel
    variant="subtle"
    size="sm"
    class-name="daily-note-conflict-panel"
    content-class="text-content-on-surface"
  >
    <p class="mb-2 text-xs font-semibold text-warning-text">
      Sync conflict — this note changed on another device too
    </p>
    <div class="grid gap-3 md:grid-cols-2">
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Your version
        </div>
        <div
          class="max-h-32 overflow-auto rounded-[var(--radius-md)] bg-surface p-2 text-xs text-content-secondary"
        >
          {{ previewDailyNoteContent(conflict.localContent) }}
        </div>
      </div>
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Server version
        </div>
        <div
          class="max-h-32 overflow-auto rounded-[var(--radius-md)] bg-surface p-2 text-xs text-content-secondary"
        >
          {{ previewDailyNoteContent(conflict.serverContent) }}
        </div>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <UiButton
        size="xs"
        tone="primary"
        variant="soft"
        @click="$emit('resolve', 'keep-local')"
      >
        Keep mine
      </UiButton>
      <UiButton
        size="xs"
        tone="neutral"
        variant="soft"
        @click="$emit('resolve', 'keep-server')"
      >
        Use server
      </UiButton>
    </div>
  </UiPanel>
</template>

<script setup lang="ts">
import type { DailyNoteConflict } from "../repositories/dailyLocalRepository";
import { previewDailyNoteContent } from "../composables/dailyDraftCommitter";
defineProps<{ conflict: DailyNoteConflict }>();
defineEmits<{ resolve: [strategy: "keep-local" | "keep-server"] }>();
</script>

<style scoped>
:deep(.daily-note-conflict-panel) {
  border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
  background: color-mix(in srgb, var(--color-warning) 5%, transparent);
}
</style>
