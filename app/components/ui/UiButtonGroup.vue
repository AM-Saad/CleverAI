<template>
  <div class="ui-button-group" role="group" v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * UiButtonGroup — connects adjacent UiButtons into a segmented control.
 * Nuxt UI v4 replaced UButtonGroup with UFieldGroup, but the latter applies
 * field-specific context. Keep this small button-only primitive local.
 */
defineOptions({ inheritAttrs: false });
</script>

<style scoped>
.ui-button-group {
  display: inline-flex;
  align-items: stretch;
}

.ui-button-group :deep(button) {
  border-radius: 0;
}

.ui-button-group :deep(button:first-child) {
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
}

.ui-button-group :deep(button:last-child) {
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
}

.ui-button-group :deep(button + button) {
  margin-left: -1px;
}
</style>
