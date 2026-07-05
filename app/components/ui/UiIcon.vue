<template>
  <UIcon :name="name" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiIcon — the design-system icon primitive. Thin wrapper over Nuxt UI's
 * Iconify-backed `UIcon` so feature/page code references one icon component
 * (and the component-boundary gate stays clean). Use `i-lucide-*` names —
 * lucide is the canonical icon set app-wide.
 */
defineProps<{ name: string }>();
defineOptions({ inheritAttrs: false });
</script>
