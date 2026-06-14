<template>
  <UCheckbox v-model="model" :label="label" :description="description" :disabled="disabled" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * UiCheckbox — boolean checkbox with optional label. Thin wrapper over `UCheckbox`.
 */
const model = defineModel<boolean>();
const { label, description, disabled = false } = defineProps<{
  label?: string;
  description?: string;
  disabled?: boolean;
}>();
defineOptions({ inheritAttrs: false });
</script>
