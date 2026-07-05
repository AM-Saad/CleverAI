<template>
  <UButtonGroup v-bind="$attrs">
    <slot />
  </UButtonGroup>
</template>

<script setup lang="ts">
/**
 * UiButtonGroup — connects adjacent UiButtons into a single segmented control
 * (shared borders, joined corners). Thin wrapper over the themed
 * `UButtonGroup`.
 */
defineOptions({ inheritAttrs: false });
</script>
