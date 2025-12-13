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

function handleClose() {
  if (!props.loading) {
    emit("close");
  }
}
</script>

<template>
  <shared-dialog-modal :show="show" @close="handleClose">
    <template #header>
      <div class="flex items-center gap-2">
        <Icon v-if="isDestructive" name="i-lucide-trash-2" class="w-5 h-5 text-error" />
        <span class="font-semibold">{{ title }}</span>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          <slot>Are you sure? This action cannot be undone.</slot>
        </p>

        <!-- Warning if enrolled -->
        <div v-if="isEnrolled" class="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <Icon name="i-lucide-alert-triangle" class="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-warning">{{ enrollmentWarning }}</p>
            <p class="text-muted mt-1">
              Deleting this will also remove all your study progress, including spaced repetition data and review
              history.
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end pt-2">
        <UButton variant="ghost" color="neutral" @click="handleClose" :disabled="loading">
          Cancel
        </UButton>
        <UButton :color="isDestructive ? 'error' : 'primary'" @click="$emit('confirm')" :loading="loading"
          :disabled="loading">
          <Icon v-if="isDestructive" name="i-lucide-trash-2" class="w-4 h-4 mr-1" />
          {{ confirmText }}
        </UButton>
      </div>
    </template>
  </shared-dialog-modal>
</template>
