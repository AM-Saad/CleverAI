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
        <UiDoubleTapDeleteButton
          v-if="requiresDoubleTap"
          :tone="tone"
          :loading="loading"
          :label="confirmLabel"
          :armed-label="effectiveConfirmArmedLabel"
          @confirm="$emit('confirm')"
        />
        <UiButton v-else :tone="tone" :loading="loading" @click="$emit('confirm')">{{
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
import { computed } from "vue";

const open = defineModel<boolean>("open", { default: false });
const {
  title,
  description,
  icon,
  confirmLabel = "Confirm",
  confirmArmedLabel,
  cancelLabel = "Cancel",
  tone = "error",
  loading = false,
  requiresDoubleTap = false,
} = defineProps<{
  title?: string;
  description?: string;
  icon?: IconName;
  confirmLabel?: string;
  confirmArmedLabel?: string;
  cancelLabel?: string;
  /** Tone of the confirm button (error for destructive, primary otherwise). */
  tone?: Tone;
  loading?: boolean;
  /** Require two activations on the confirm button before emitting confirm. */
  requiresDoubleTap?: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();
const effectiveConfirmArmedLabel = computed(
  () => confirmArmedLabel ?? `Tap again to ${confirmLabel.toLowerCase()}`,
);
function cancel() {
  emit("cancel");
  open.value = false;
}
</script>
