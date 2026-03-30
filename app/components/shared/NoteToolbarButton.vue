<template>
  <UTooltip :text="title" :disabled="!title" :delay-duration="200" :popper="{ placement: 'top' }"
    :disableClosingTrigger="true" :shortcuts="shortcuts">
    <button type="button" :class="[
      'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20',
      active ? 'bg-primary/10 text-primary shadow-sm' : colorClasses,
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      (($slots.default && !iconOnly) || label) ? 'px-2.5 py-1.5' : 'w-8 h-8'
    ]" :aria-label="title || label" :disabled="disabled" @click="emit('click', $event)">
      <UIcon v-if="icon" :name="icon" class="w-[18px] h-[18px] shrink-0" />
      <span v-if="label" :class="{ 'hidden sm:inline': hideLabelOnMobile }">{{ label }}</span>
      <slot />
    </button>
  </UTooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  icon?: string;
  label?: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  hideLabelOnMobile?: boolean;
  iconOnly?: boolean;
  variant?: 'default' | 'danger' | 'primary';
  shortcuts?: string[];
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const colorClasses = computed(() => {
  if (props.variant === 'danger') {
    return 'text-error hover:bg-error/10';
  } else if (props.variant === 'primary') {
    return 'bg-primary text-on-primary hover:bg-primary/90';
  }
  // Default variant
  return 'text-content-on-surface hover:bg-surface-strong hover:text-content-on-surface-strong';
});
</script>
