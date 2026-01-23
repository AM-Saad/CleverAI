<template>
  <div class="flex flex-col ">
    <div class="flex flex-wrap items-center space-x-4">
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Card Review
      </h1>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {{ currentIndex + 1 }} of {{ totalCards }}
      </div>
      <!-- Study Session Timer -->
      <ReviewProgressBar :progress="progress" />
    </div>

    <ReviewSessionTimer :session-time="sessionTime" />
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
