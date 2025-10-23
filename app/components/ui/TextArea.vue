<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" :for="id" class="text-sm font-medium text-gray-700">
      {{ label }}
    </label>

    <UTextarea :id="id" v-model="modelValue" v-bind="$attrs" size="xs" />

    <span v-if="error" class="text-xs text-red-500">{{ error }}</span>
    <span v-else-if="hint" class="text-xs text-gray-500">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const modelValue = defineModel();

defineProps<{
  label?: string;
  hint?: string;
  error?: string;
  id?: string;
}>();
</script>
