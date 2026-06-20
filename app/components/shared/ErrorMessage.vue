<script setup lang="ts">
import { APIError } from "~/services/FetchFactory";

const props = defineProps<{
  error: APIError | string | null;
  refresh?: () => void;
}>();

const errorMessage = computed(() => {
  if (!props.error) return "";
  if (typeof props.error === "string") {
    return props.error;
  }
  return props.error?.message || "An error occurred";
});
</script>

<template>
  <UiPanel
    v-if="error"
    variant="subtle"
    size="sm"
    role="alert"
    class-name="my-2 rounded-[var(--radius-md)] border-error/40 bg-error/20 dark:border-error"
    content-class="text-sm font-medium text-error-text"
  >
    <p v-handle-internal-links v-html="errorMessage"></p>

    <UiButton
      v-if="refresh"
      size="sm"
      tone="error"
      variant="subtle"
      class="mt-3"
      @click="() => refresh?.()"
    >
      Try Again
    </UiButton>
  </UiPanel>
</template>
