<template>
  <div
    v-if="active"
    class="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-content-secondary"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <UiIcon
      name="i-lucide-loader-circle"
      class="h-5 w-5 animate-spin text-primary"
    />
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ active?: boolean; label?: string }>(), {
  active: true,
  label: "Loading…",
});
</script>
