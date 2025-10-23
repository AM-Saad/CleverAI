<template>
  <div v-if="isFetching" class="flex items-center justify-center p-8">
    <div class="flex items-center gap-2 text-gray-500">
      <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
      <span>{{ label }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
interface Props {
  /**
   * Whether the notes are being fetched
   */
  isFetching?: boolean;
  label?: string;
}
const props = withDefaults(defineProps<Props>(), {
  isFetching: false,
  label: "Loading...",
});
</script>
