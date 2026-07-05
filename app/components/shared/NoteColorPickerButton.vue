<template>
  <shared-note-toolbar-button :title="title" class="relative overflow-hidden cursor-pointer" :icon-only="iconOnly">
    <shared-icon :name="icon" class="w-[18px] h-[18px] shrink-0"
      :style="{ color: isValidColor ? modelValue : fallbackColor }" />
    <span v-if="!iconOnly && label" class="hidden sm:inline">{{ label }}</span>
    <!-- design-allow: native color picker — no Ui primitive wraps type=color -->
    <input type="color" :value="isValidColor ? modelValue : fallbackColor" @input="handleInput"
      class="absolute inset-[-10px] w-[200%] h-[200%] opacity-0 cursor-pointer" />
    <slot />
  </shared-note-toolbar-button>
</template>

<script setup lang="ts">
import type { IconName } from '#imports';
import { computed } from 'vue';
import { designTokenValues } from '~/design-system/tokens.generated';

// Native `<input type="color">` requires a resolved `#rrggbb` value (CSS custom
// properties do not resolve there), so we read the resolved token value rather
// than hardcoding hex. `withDefaults` may reference module-level imports.
const props = withDefaults(defineProps<{
  modelValue: string | undefined | null;
  icon: IconName;
  title?: string;
  label?: string;
  iconOnly?: boolean;
  fallbackColor?: string;
}>(), {
  fallbackColor: () => designTokenValues['--color-content-on-background']
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
