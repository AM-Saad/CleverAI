<template>
  <UiPanel
    variant="subtle"
    size="sm"
    tone="warning"
    class="occurrence-conflict-panel"
    content-class="overflow-auto text-content-on-surface"
  >
    <p class="mb-2 text-xs font-semibold text-warning-text">
      Couldn’t sync {{ conflict.actionTitle }}
    </p>
    <div class="grid gap-3 md:grid-cols-2">
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Your version
        </div>
        <div class="conflict-version">
          <p class="font-medium">{{ localStatus }}</p>
          <p class="text-content-secondary">{{ localDate }}</p>
        </div>
      </div>
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Server version
        </div>
        <div class="conflict-version">
          <p class="font-medium">{{ serverStatus }}</p>
          <p class="text-content-secondary">{{ serverDate }}</p>
        </div>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <UiButton
        size="xs"
        tone="primary"
        variant="soft"
        :loading="resolving"
        :disabled="resolving"
        @click="$emit('resolve', 'keep-local')"
      >
        Keep mine
      </UiButton>
      <UiButton
        size="xs"
        tone="neutral"
        variant="soft"
        :disabled="resolving"
        @click="$emit('resolve', 'keep-server')"
      >
        Use server
      </UiButton>
    </div>
  </UiPanel>
</template>

<script setup lang="ts">
import type { DailyOccurrenceConflict } from "../repositories/dailyLocalRepository";

const props = defineProps<{
  conflict: DailyOccurrenceConflict;
  resolving?: boolean;
}>();
defineEmits<{ resolve: [strategy: "keep-local" | "keep-server"] }>();

function statusLabel(value: Record<string, unknown>) {
  switch (value.status) {
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Removed";
    case "SKIPPED":
      return "Skipped";
    default:
      return "Open";
  }
}

function dateLabel(value: Record<string, unknown> | null) {
  return typeof value?.dateKey === "string" ? value.dateKey : "Original day";
}

const localStatus = computed(() => statusLabel(props.conflict.localOccurrence));
const serverStatus = computed(() =>
  statusLabel(props.conflict.serverOccurrence),
);
const localDate = computed(() => dateLabel(props.conflict.localPlacement));
const serverDate = computed(() => dateLabel(props.conflict.serverPlacement));
</script>

<style scoped>
.occurrence-conflict-panel {
  margin: var(--space-2);
}

.conflict-version {
  min-height: 3.5rem;
  padding: var(--space-2);
  overflow-wrap: anywhere;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--text-xs);
}
</style>
