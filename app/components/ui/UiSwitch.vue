<template>
  <USwitch v-model="model" :label="label" :description="description" :disabled="disabled" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiSwitch — boolean toggle. Thin wrapper over the themed `USwitch`. Replaces
 * the deprecated `UToggle`.
 */
const model = defineModel<boolean>();
const { label, description, disabled = false } = defineProps<{
  label?: string;
  description?: string;
  disabled?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>
