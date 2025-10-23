<script setup lang="ts">
import { APIError } from "~/services/FetchFactory";

defineProps({
  error: {
    type: APIError,
    required: true,
  },
  refresh: {
    type: Function,
  },
});
</script>

<template>
  <div
    v-if="error"
    class="bg-error/20 border border-error/40 dark:border-error my-2 p-3 rounded dark:text-error text-error font-medium text-xs"
  >
    <p v-handle-internal-links v-text="error.message"></p>

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
