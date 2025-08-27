<script setup lang="ts">
defineProps({
  error: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div v-if="error">
    <p
      v-handle-internal-links
      class="bg-gray-100/50 dark:bg-transparent border dark:border-red-400 my-2 px-3 py-2 rounded-lg text-red-400 text-xs"
      v-html="error"
    ></p>
  </div>
</template>
