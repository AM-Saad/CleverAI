<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 animate-fade-in"
  >
    <div class="flex justify-between items-start mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
        Review Analytics
      </h2>
      <button
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded"
        @click="$emit('close')"
      >
        <Icon name="heroicons:x-mark" class="w-5 h-5" />
      </button>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
      <!-- Total Cards -->
      <div class="text-center">
        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
          {{ analytics.totalCards }}
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Total Cards</div>
      </div>

      <!-- Total Reviews -->
      <div class="text-center">
        <div class="text-3xl font-bold text-green-600 dark:text-green-400">
          {{ analytics.totalReviews }}
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">Reviews Done</div>
      </div>

      <!-- Current Streak -->
      <div class="text-center">
        <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
          {{ analytics.currentStreak }}
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Current Streak
        </div>
      </div>

      <!-- Retention Rate -->
      <div class="text-center">
        <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">
          {{ Math.round(analytics.retentionRate * 100) }}%
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Retention Rate
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Grade Distribution -->
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Grade Distribution
        </h3>
        <div class="space-y-2">
          <div
            v-for="(count, grade) in analytics.gradeDistribution"
            :key="grade"
            class="flex items-center justify-between"
          >
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 rounded-full" :class="getGradeColor(grade)" />
              <span class="text-sm">{{ getGradeLabel(grade) }}</span>
            </div>
            <span class="text-sm font-medium">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Performance Summary -->
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Performance Summary
        </h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400"
              >Average Grade:</span
            >
            <span class="text-sm font-medium"
              >{{ analytics.averageGrade }}/5</span
            >
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400"
              >Average Ease Factor:</span
            >
            <span class="text-sm font-medium">{{
              analytics.performanceMetrics.averageEaseFactor
            }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400"
              >Average Interval:</span
            >
            <span class="text-sm font-medium"
              >{{ analytics.performanceMetrics.averageInterval }} days</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Card Categories -->
    <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        Card Categories
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div class="text-xl font-bold text-blue-600 dark:text-blue-400">
            {{ analytics.performanceMetrics.newCards }}
          </div>
          <div class="text-xs text-blue-700 dark:text-blue-300">New</div>
        </div>
        <div
          class="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
        >
          <div class="text-xl font-bold text-orange-600 dark:text-orange-400">
            {{ analytics.performanceMetrics.learningCards }}
          </div>
          <div class="text-xs text-orange-700 dark:text-orange-300">
            Learning
          </div>
        </div>
        <div class="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div class="text-xl font-bold text-red-600 dark:text-red-400">
            {{ analytics.performanceMetrics.dueCards }}
          </div>
          <div class="text-xs text-red-700 dark:text-red-300">Due</div>
        </div>
        <div
          class="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
        >
          <div class="text-xl font-bold text-green-600 dark:text-green-400">
            {{ analytics.performanceMetrics.masteredCards }}
          </div>
          <div class="text-xs text-green-700 dark:text-green-300">Mastered</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  analytics: {
    totalCards: number;
    totalReviews: number;
    currentStreak: number;
    retentionRate: number;
    averageGrade: number;
    gradeDistribution: Record<string, number>;
    performanceMetrics: {
      averageEaseFactor: number;
      averageInterval: number;
      newCards: number;
      learningCards: number;
      dueCards: number;
      masteredCards: number;
    };
  };
}

defineProps<Props>();

defineEmits<{
  close: [];
}>();

const getGradeColor = (grade: string) => {
  const colors: Record<string, string> = {
    "0": "bg-red-500",
    "1": "bg-orange-500",
    "2": "bg-orange-400",
    "3": "bg-yellow-500",
    "4": "bg-blue-500",
    "5": "bg-green-500",
  };
  return colors[grade] || "bg-gray-500";
};

const getGradeLabel = (grade: string) => {
  const labels: Record<string, string> = {
    "0": "Again (0)",
    "1": "Hard (1)",
    "2": "Hard (2)",
    "3": "Good (3)",
    "4": "Good (4)",
    "5": "Easy (5)",
  };
  return labels[grade] || `Grade ${grade}`;
};
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
