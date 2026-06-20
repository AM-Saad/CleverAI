<script setup lang="ts">
interface Props {
  show: boolean;
  title: string;
  confirmText?: string;
  isDestructive?: boolean;
  isEnrolled?: boolean;
  enrollmentWarning?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: "Delete",
  isDestructive: true,
});

const emit = defineEmits<{
  (event: "close"): void;
  (event: "confirm"): void;
}>();

const open = computed({
  get: () => props.show,
  set: (value: boolean) => {
    if (!value) handleClose();
  },
});

const confirmTone = computed(() => (props.isDestructive ? "error" : "primary"));
const dialogIcon = computed(() => (props.isDestructive ? "delete" : "info"));

function handleClose() {
  if (!props.loading) {
    emit("close");
  }
}
</script>

<template>
  <UiConfirmDialog
    v-model:open="open"
    :title="title"
    :icon="dialogIcon"
    :confirm-label="confirmText"
    cancel-label="Cancel"
    :tone="confirmTone"
    :loading="loading"
    @cancel="handleClose"
    @confirm="$emit('confirm')"
  >
    <div class="space-y-4">
      <UiParagraph size="sm" color="content-secondary">
        <slot>Are you sure? This action cannot be undone.</slot>
      </UiParagraph>

      <UiPanel
        v-if="isEnrolled"
        variant="subtle"
        size="sm"
        class-name="border-warning/20 bg-warning/10"
        content-class="flex items-start gap-3"
      >
        <Icon
          name="i-lucide-alert-triangle"
          class="mt-0.5 h-5 w-5 shrink-0 text-warning-text"
        />
        <div class="text-sm">
          <p class="font-medium text-warning-text">{{ enrollmentWarning }}</p>
          <p class="mt-1 text-content-secondary">
            Deleting this will also remove all your study progress, including
            spaced repetition data and review history.
          </p>
        </div>
      </UiPanel>
    </div>
  </UiConfirmDialog>
</template>
