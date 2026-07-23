<template>
  <div class="flex flex-col items-center justify-center text-center gap-3 py-12 px-4">
    <Icon v-if="icon" :name="icon" :size="20" class="text-content-disabled" />
    <div class="flex flex-col gap-1">
      <UiSubtitle v-if="title" size="lg" color="content-on-surface-strong">{{ title }}</UiSubtitle>
      <UiParagraph v-if="description" size="sm" color="content-secondary">
        <slot name="description">{{ description }}</slot>
      </UiParagraph>
    </div>
    <div v-if="actionLabel || $slots.actions" class="mt-2 flex items-center justify-center gap-2">
      <UiButton v-if="actionLabel" :icon="actionIcon" :loading="actionLoading" :disabled="actionDisabled" size="sm"
        @click="$emit('action')">
        {{ actionLabel }}
      </UiButton>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * UiEmptyState — the canonical "nothing here yet" block: icon + title +
 * description + an optional primary action (or custom buttons via the `actions`
 * slot). The single empty-state primitive for the app.
 */
defineProps<{
  icon?: string;
  title?: string;
  description?: string;
  /** Primary action button label; omit for no button. */
  actionLabel?: string;
  actionIcon?: string;
  actionLoading?: boolean;
  actionDisabled?: boolean;
}>();

defineEmits<{ action: [] }>();
</script>
