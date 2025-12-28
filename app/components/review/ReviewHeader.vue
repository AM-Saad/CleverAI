<template>
  <div class="flex justify-between items-center">
    <div class="flex items-center space-x-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Card Review
      </h1>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {{ currentIndex + 1 }} of {{ totalCards }}
      </div>
      <!-- Study Session Timer -->
      <ReviewSessionTimer :session-time="sessionTime" />
    </div>

    <ReviewProgressBar :progress="progress" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentIndex: number
  totalCards: number
  progress: number
  /** Session time in seconds - passed from parent to ensure single timer source */
  sessionTime: number
}

defineProps<Props>()
</script>
