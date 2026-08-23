<template>
  <UiPanel
    variant="surface"
    size="md"
    radius="2xl"
    shadow="sm"
    :tone="resolvedTone"
    :class-name="['learning-pulse', status ? `learning-pulse--${status}` : '', customClass].filter(Boolean).join(' ')"
  >
    <div class="learning-pulse__content">
      <div v-if="$slots.topline" class="learning-pulse__topline">
        <slot name="topline" />
      </div>

      <div v-if="$slots.copy" class="learning-pulse__copy" aria-live="polite">
        <slot name="copy" />
      </div>

      <div v-if="$slots.signals" class="learning-pulse__signals">
        <slot name="signals" />
      </div>

      <div v-if="$slots.action" class="learning-pulse__action">
        <slot name="action" />
      </div>

      <slot />
    </div>
  </UiPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type PulseStatus =
  | "workspace"
  | "language"
  | "done"
  | "empty"
  | "error"
  | string;

const props = withDefaults(
  defineProps<{
    status?: PulseStatus;
    tone?: "neutral" | "info" | "success" | "warning" | "error" | "brand";
    customClass?: string;
  }>(),
  {
    status: "workspace",
    tone: undefined,
    customClass: "",
  },
);

const resolvedTone = computed(() => {
  if (props.tone) return props.tone;
  if (props.status === "error") return "error" as const;
  if (props.status === "done") return "success" as const;
  if (props.status === "workspace" || props.status === "language") {
    return "info" as const;
  }
  return "neutral" as const;
});
</script>

<style scoped>
.learning-pulse {
  --pulse-accent: var(--color-accent-indigo);
  position: relative;
  isolation: isolate;
  border: 0;
  border-color: color-mix(
    in srgb,
    var(--pulse-accent) 24%,
    var(--color-secondary)
  );
  background:
    radial-gradient(
      circle at 92% 8%,
      color-mix(in srgb, var(--pulse-accent) 18%, transparent),
      transparent 38%
    ),
    var(--color-surface);
}

.learning-pulse--language {
  --pulse-accent: var(--color-accent-purple);
}

.learning-pulse--done {
  --pulse-accent: var(--color-success);
}

.learning-pulse--error {
  --pulse-accent: var(--color-error);
}

.learning-pulse__content {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  gap: var(--space-4);
}

.learning-pulse__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.learning-pulse__copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 34rem;
}

.learning-pulse__signals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.learning-pulse__signals :deep(span),
.learning-pulse__signals span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
}
</style>
