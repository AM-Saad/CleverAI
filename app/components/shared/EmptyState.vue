<template>
  <div class="flex flex-col gap-2 items-center justify-center flex-1" :class="containerClass">
    <div v-if="title" class="flex items-center gap-2 mb-0">
      <u-icon :name="icon" class="w-12 h-12 text-muted dark:text-light" />
      <ui-subtitle size="sm">
        {{ title }}
      </ui-subtitle>
    </div>

    <ui-paragraph color="muted" size="xs" :center="centerDescription">
      <slot name="description">
        {{ description }}
      </slot>
    </ui-paragraph>

    <u-tooltip v-if="buttonText && isBlocked && blockedTooltip" :text="blockedTooltip" :popper="{ placement: 'top' }">
      <u-button color="primary" size="sm" :loading="buttonLoading" :disabled="true">
        <u-icon v-if="buttonIcon" :name="buttonIcon" />
        {{ buttonText }}
      </u-button>
    </u-tooltip>

    <u-button v-else-if="buttonText" color="primary" size="sm" :loading="buttonLoading" :disabled="buttonDisabled"
      @click="$emit('action')">
      <u-icon v-if="buttonIcon" :name="buttonIcon" />
      {{ buttonText }}
    </u-button>

    <!-- Optional additional actions slot -->
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** The icon to display (heroicons name) */
  icon?: string;
  /** The main title text */
  title?: string;
  /** The description text (can also use description slot) */
  description?: string;
  /** Whether to center the description text */
  centerDescription?: boolean;
  /** The button text (if not provided, no button is shown) */
  buttonText?: string;
  /** The button icon (heroicons name) */
  buttonIcon?: string;
  /** Whether the button is in a loading state */
  buttonLoading?: boolean;
  /** Whether the button is disabled */
  buttonDisabled?: boolean;
  /** Whether the button is blocked (disabled with tooltip) */
  isBlocked?: boolean;
  /** Tooltip text to show when button is blocked */
  blockedTooltip?: string;
  /** Additional classes for the container */
  containerClass?: string;
}

withDefaults(defineProps<Props>(), {
  icon: 'i-heroicons-document-text',
  centerDescription: false,
  buttonIcon: 'i-heroicons-plus',
  buttonLoading: false,
  buttonDisabled: false,
  isBlocked: false,
  blockedTooltip: '',
  containerClass: '',
});

defineEmits<{
  action: [];
}>();
</script>
