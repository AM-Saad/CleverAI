<template>
  <DialogModal
    :show="open"
    :title="title"
    :description="description"
    :icon="icon"
    @close="open = false"
  >
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </DialogModal>
</template>

<script setup lang="ts">
/**
 * UiModal — the canonical centered dialog. Thin wrapper over the focus-trapped,
 * tokenized DialogModal. Control with `v-model:open`; content in the default
 * slot, optional `header`/`footer` slots.
 */
import DialogModal from "~/components/shared/DialogModal.vue";
import type { IconName } from "~/utils/icons.generated";

const open = defineModel<boolean>("open", { default: false });
const { title, description, icon } = defineProps<{
  title?: string;
  description?: string;
  icon?: IconName;
}>();
</script>
