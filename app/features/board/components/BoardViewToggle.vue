<script setup lang="ts">
const props = defineProps<{
  modelValue: "board" | "list";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: "board" | "list"): void;
}>();

const options = [
  { value: "board" as const, icon: "i-lucide-columns-3", label: "Board" },
  { value: "list" as const, icon: "i-lucide-list", label: "List" },
];
</script>

<template>
  <UiToolbar size="sm">
    <UiToolbarButton
      v-for="option in options"
      :key="option.value"
      :icon="option.icon"
      :label="option.label"
      :active="modelValue === option.value"
      size="xs"
      @click="emit('update:modelValue', option.value)"
    />
  </UiToolbar>
</template>
