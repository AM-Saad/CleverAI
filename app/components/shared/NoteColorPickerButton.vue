<template>
  <shared-note-toolbar-button :title="title" class="relative overflow-hidden cursor-pointer" :icon-only="iconOnly">
    <UIcon :name="icon" class="w-[18px] h-[18px] shrink-0"
      :style="{ color: isValidColor ? modelValue : fallbackColor }" />
    <span v-if="!iconOnly && label" class="hidden sm:inline">{{ label }}</span>
    <input type="color" :value="isValidColor ? modelValue : fallbackColor" @input="handleInput"
      class="absolute inset-[-10px] w-[200%] h-[200%] opacity-0 cursor-pointer" />
    <slot />
  </shared-note-toolbar-button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: string | undefined | null;
  icon: string;
  title?: string;
  label?: string;
  iconOnly?: boolean;
  fallbackColor?: string;
}>(), {
  fallbackColor: '#000000'
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isValidColor = computed(() => {
  return props.modelValue && props.modelValue !== 'transparent';
});

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}
</script>
