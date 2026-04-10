<script setup lang="ts">
const props = defineProps<{
  message?: string | null;
}>();
</script>

<template>
  <div v-if="props.message">
    <p class="bg-success/10 border dark:border-success/30 my-2 px-3 py-2 rounded-[var(--radius-md)] text-success text-sm"
      v-html="props.message" />
  </div>
</template>
