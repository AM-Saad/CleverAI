<template>
  <div class="savebar">
    <span class="savebar__lead">
      <span class="savebar__dot" :class="{ 'animate-pulse-soft': syncing > 0 }" />
      {{ label }}
    </span>
    <span v-if="syncing > 0" class="savebar__syncing">{{ syncing }} syncing</span>
  </div>
</template>

<script setup lang="ts">
/**
 * SaveLocalBar — persistent, honest local-first status line. Bound to a store's
 * dirty/sync counts. Never implies the network is required.
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** Items written locally but not yet confirmed on the server. */
    syncing?: number;
    /** Override the leading label. */
    label?: string;
  }>(),
  { syncing: 0, label: "" },
);

const label = computed(() => props.label || "All changes saved locally");
</script>

<style scoped>
.savebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 7px 13px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-success) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 22%, transparent);
}
.savebar__lead {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-success-text);
}
.savebar__dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--color-success);
}
.savebar__syncing {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-content-secondary);
}
</style>
