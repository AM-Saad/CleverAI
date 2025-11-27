<template>
  <div
    class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400"
  >
    <Icon name="heroicons:clock" class="w-4 h-4" />
    <span>{{ formattedTime }}</span>
  </div>
</template>

<script setup lang="ts">
// Self-contained timer using composable
const { sessionTime, formatTime } = useSessionTimer()

const formattedTime = computed(() => formatTime(sessionTime.value))
</script>
