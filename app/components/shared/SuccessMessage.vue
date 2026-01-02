<script setup lang="ts">
const props = defineProps<{
  message?: string | null;
}>();
</script>

<template>
  <div v-if="props.message">
    <p class="bg-green-200/80  border dark:border-green-400 my-2 px-3 py-2 rounded-lg text-green-800 text-sm"
      v-html="props.message" />
  </div>
</template>
