<template>
  <UiModal
    v-model:open="open"
    :title="repeating ? 'Delete repeating action?' : 'Delete action item?'"
    :description="description"
    icon="trash-2"
  >
    <UiParagraph v-if="repeating" size="sm" color="content-secondary">
      Choose whether to remove only this date or archive the whole repeating
      series.
    </UiParagraph>
    <template #footer>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UiButton
          tone="neutral"
          variant="ghost"
          :disabled="loading"
          @click="open = false"
        >
          Cancel
        </UiButton>
        <UiButton
          v-if="repeating"
          tone="error"
          variant="soft"
          :loading="loading"
          @click="$emit('delete-occurrence')"
        >
          This occurrence
        </UiButton>
        <UiButton
          tone="error"
          :loading="loading"
          @click="$emit('delete-series')"
        >
          {{ repeating ? "Entire series" : "Delete" }}
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  title: string;
  repeating: boolean;
  loading?: boolean;
}>();
defineEmits<{
  "delete-occurrence": [];
  "delete-series": [];
}>();

const description = computed(() =>
  props.repeating
    ? `“${props.title}” will keep its history. You can undo immediately after removal.`
    : `“${props.title}” will be removed from your plan. Its history is preserved.`,
);
</script>
