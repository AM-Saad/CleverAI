<script setup lang="ts">
import { APIError } from "~/services/FetchFactory";

const props = defineProps<{
  error: APIError | string | null;
  refresh?: () => void;
}>();

const errorMessage = computed(() => {
  if (!props.error) return '';
  if (typeof props.error === 'string') {
    return props.error;
  }
  return props.error?.message || 'An error occurred';
});
</script>

<template>
  <div
    v-if="error"
    class="bg-error/20 border border-error/40 dark:border-error my-2 p-3 rounded dark:text-error text-error font-medium text-xs"
  >
    <p v-handle-internal-links v-text="errorMessage"></p>

    <UButton
      size="sm"
      color="error"
      variant="subtle"
      class="mt-3"
      @click="() => refresh?.()"
      v-if="refresh"
    >
      Try Again
    </UButton>
  </div>
</template>
