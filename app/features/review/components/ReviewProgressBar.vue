<template>
  <div
    class="w-32 bg-surface-subtle rounded-full h-2 dark:bg-surface"
    role="progressbar"
    :aria-valuenow="progress"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`Review progress: ${progress}% complete`"
  >
    <div
      class="bg-primary h-2 rounded-full transition-all duration-300"
      :style="{ width: `${progress}%` }"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  progress: number
}

defineProps<Props>()
</script>
