<template>
  <div class="text-center py-12 animate-fade-in">
    <div class="text-6xl mb-4">🎉</div>
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
      All caught up!
    </h2>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      No cards are due for review right now. Great job!
      <span v-if="studySessionReviews && studySessionReviews > 0">
        You reviewed {{ studySessionReviews }} cards this session.
      </span>
    </p>
    <div class="flex justify-center space-x-4">
      <button
        @click="$emit('refresh')"
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Icon name="heroicons:arrow-path" class="w-5 h-5 inline mr-2" />
        Check Again
      </button>
      <button
        @click="$emit('showAnalytics')"
        class="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        <Icon name="heroicons:chart-bar" class="w-5 h-5 inline mr-2" />
        View Analytics
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  studySessionReviews?: number
}

defineProps<Props>()

defineEmits<{
  refresh: []
  showAnalytics: []
}>()
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
