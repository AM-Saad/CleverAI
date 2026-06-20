<script setup lang="ts">
const props = defineProps<{
  message?: string | null;
}>();
</script>

<template>
  <UiPanel
    v-if="props.message"
    variant="subtle"
    size="sm"
    role="status"
    class-name="my-2 rounded-[var(--radius-md)] border-success/30 bg-success/10"
    content-class="text-success-text text-sm"
  >
    <p
      v-html="props.message" />
  </UiPanel>
</template>
