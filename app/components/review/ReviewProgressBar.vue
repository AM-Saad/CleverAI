<template>
  <div
    class="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700"
    role="progressbar"
    :aria-valuenow="progress"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="`Review progress: ${progress}% complete`"
  >
    <div
      class="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
