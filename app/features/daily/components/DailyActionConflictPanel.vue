<template>
  <UiPanel
    variant="subtle"
    size="sm"
    tone="warning"
    class="action-conflict-panel"
    content-class="overflow-auto text-content-on-surface"
  >
    <p class="mb-2 text-xs font-semibold text-warning-text">
      Couldn’t sync this action item
    </p>
    <div class="grid gap-3 md:grid-cols-2">
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Your version
        </div>
        <div class="conflict-version">
          <p class="font-medium">{{ localTitle }}</p>
          <p class="text-content-secondary">
            {{ localTiming }} · {{ localRecurrence }}
          </p>
        </div>
      </div>
      <div class="min-w-0">
        <div class="mb-1 text-xs font-semibold text-warning-text">
          Server version
        </div>
        <div class="conflict-version">
          <p class="font-medium">{{ serverTitle }}</p>
          <p class="text-content-secondary">
            {{ serverTiming }} · {{ serverRecurrence }}
          </p>
        </div>
      </div>
    </div>
    <p v-if="changedFieldsLabel" class="mt-2 text-xs text-content-secondary">
      Your changed fields: {{ changedFieldsLabel }}
    </p>
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
import type { DailyActionConflict } from "../repositories/dailyLocalRepository";

const props = defineProps<{
  conflict: DailyActionConflict;
  resolving?: boolean;
}>();
defineEmits<{ resolve: [strategy: "keep-local" | "keep-server"] }>();

const localTitle = computed(() =>
  String(props.conflict.localItem.title ?? "Untitled action"),
);
const serverTitle = computed(() =>
  String(props.conflict.serverItem.title ?? "Untitled action"),
);
const changedFieldsLabel = computed(() =>
  props.conflict.changedFields
    .map((field) => field.replace(/([A-Z])/g, " $1").toLowerCase())
    .join(", "),
);

function timingLabel(item: Record<string, unknown>) {
  if (item.timingMode !== "TIMED") return "All day";
  return typeof item.localTime === "string" ? item.localTime : "Timed";
}

function recurrenceLabel(item: Record<string, unknown>) {
  const recurrence = item.recurrence;
  if (!recurrence || typeof recurrence !== "object") return "Doesn’t repeat";
  const frequency = (recurrence as Record<string, unknown>).frequency;
  if (typeof frequency !== "string") return "Repeats";
  return frequency.charAt(0) + frequency.slice(1).toLowerCase();
}

const localTiming = computed(() => timingLabel(props.conflict.localItem));
const serverTiming = computed(() => timingLabel(props.conflict.serverItem));
const localRecurrence = computed(() =>
  recurrenceLabel(props.conflict.localItem),
);
const serverRecurrence = computed(() =>
  recurrenceLabel(props.conflict.serverItem),
);
</script>

<style scoped>
.action-conflict-panel {
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
