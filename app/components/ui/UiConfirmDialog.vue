<template>
  <UiModal
    v-model:open="open"
    :title="title"
    :description="description"
    :icon="icon"
  >
    <slot />
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <UiButton
          tone="neutral"
          variant="ghost"
          :disabled="loading"
          @click="cancel"
          >{{ cancelLabel }}</UiButton
        >
        <UiButton :tone="tone" :loading="loading" @click="$emit('confirm')">{{
          confirmLabel
        }}</UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
/**
 * UiConfirmDialog — confirm/cancel dialog. Composes UiModal + UiButton. The
 * single primitive for destructive/confirmation prompts (consolidates the
 * various DeleteConfirmationModal-style components). Control with `v-model:open`.
 */
import type { Tone } from "./variants";
import type { IconName } from "~/utils/icons.generated";

const open = defineModel<boolean>("open", { default: false });
const {
  title,
  description,
  icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "error",
  loading = false,
} = defineProps<{
  title?: string;
  description?: string;
  icon?: IconName;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tone of the confirm button (error for destructive, primary otherwise). */
  tone?: Tone;
  loading?: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();
function cancel() {
  emit("cancel");
  open.value = false;
}
</script>
