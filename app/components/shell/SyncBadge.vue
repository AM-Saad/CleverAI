<template>
  <UiPill
    size="sm"
    :label="state === 'local' ? 'Local' : 'synced'"
    :color="
      state === 'local'
        ? 'var(--color-success)'
        : 'var(--color-content-disabled)'
    "
    :variant="state === 'local' ? 'outline' : 'soft'"
    :active="state === 'local'"
    max-width="120px"
  >
    <template #indicator>
      <UiPillIndicator
        :color="
          state === 'local'
            ? 'var(--color-success)'
            : 'var(--color-content-disabled)'
        "
        size="sm"
        :class-name="state === 'local' ? 'ds-save-pulse' : ''"
      />
    </template>
  </UiPill>
</template>

<script setup lang="ts">
/**
 * SyncBadge — per-item honest sync state. `local` = persisted to IndexedDB but
 * not yet on the server (green-tinted, with a one-shot save-pulse); `synced` =
 * confirmed on the server (neutral).
 */
withDefaults(defineProps<{ state?: "local" | "synced" }>(), { state: "local" });
</script>

<style scoped>
/* Save-local ripple: one pulse per IndexedDB persist (module 09). */
.ds-save-pulse {
  animation: ds-save-pulse var(--duration-slow) var(--ease-standard);
}
@keyframes ds-save-pulse {
  0% {
    box-shadow: 0 0 0 0
      color-mix(in srgb, var(--color-success) 60%, transparent);
  }
  100% {
    box-shadow: 0 0 0 6px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ds-save-pulse {
    animation: none;
  }
}
</style>
