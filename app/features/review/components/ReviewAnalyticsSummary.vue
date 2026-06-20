<template>
  <UiPanel variant="surface" size="lg" class-name="mb-6 animate-fade-in shadow-[var(--shadow-card-hover)]">
    <div class="flex justify-between items-start mb-6">
      <h2 class="text-xl font-bold text-content-on-surface-strong">
        Review Analytics
      </h2>
      <UiIconButton icon="i-lucide-x" label="Close analytics" size="sm" variant="ghost" @click="$emit('close')" />
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
      <!-- Total Cards -->
      <div class="text-center">
        <div class="text-3xl font-bold text-primary">
          {{ analytics.totalCards }}
        </div>
        <div class="text-sm text-content-secondary">Total Cards</div>
      </div>

      <!-- Total Reviews -->
      <div class="text-center">
        <div class="text-3xl font-bold text-success-text">
          {{ analytics.totalReviews }}
        </div>
        <div class="text-sm text-content-secondary">Reviews Done</div>
      </div>

      <!-- Current Streak -->
      <div class="text-center">
        <div class="text-3xl font-bold text-warning-text">
          {{ analytics.currentStreak }}
        </div>
        <div class="text-sm text-content-secondary">
          Current Streak
        </div>
      </div>

      <!-- Retention Rate -->
      <div class="text-center">
        <div class="text-3xl font-bold text-info-text">
          {{ Math.round(analytics.retentionRate * 100) }}%
        </div>
        <div class="text-sm text-content-secondary">
          Retention Rate
        </div>
      </div>
    </div>

    <!-- Performance Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Grade Distribution -->
      <div>
        <h3 class="text-lg font-medium text-content-on-surface-strong mb-4">
          Grade Distribution
        </h3>
        <div class="space-y-2">
          <div v-for="(count, grade) in analytics.gradeDistribution" :key="grade"
            class="flex items-center justify-between">
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
        <h3 class="text-lg font-medium text-content-on-surface-strong mb-4">
          Performance Summary
        </h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-content-secondary">Average Grade:</span>
            <span class="text-sm font-medium">{{ analytics.averageGrade }}/5</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-content-secondary">Average Ease Factor:</span>
            <span class="text-sm font-medium">{{
              analytics.performanceMetrics.averageEaseFactor
              }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-content-secondary">Average Interval:</span>
            <span class="text-sm font-medium">{{ analytics.performanceMetrics.averageInterval }} days</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Card Categories -->
    <div class="mt-6 pt-6 border-t border-secondary">
      <h3 class="text-lg font-medium text-content-on-surface-strong mb-4">
        Card Categories
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <UiPanel variant="subtle" size="sm" class-name="bg-primary/10" content-class="text-center">
          <div class="text-xl font-bold text-primary">
            {{ analytics.performanceMetrics.newCards }}
          </div>
          <div class="text-xs text-primary">New</div>
        </UiPanel>
        <UiPanel variant="subtle" size="sm" class-name="bg-warning/10" content-class="text-center">
          <div class="text-xl font-bold text-warning-text">
            {{ analytics.performanceMetrics.learningCards }}
          </div>
          <div class="text-xs text-warning-text">
            Learning
          </div>
        </UiPanel>
        <UiPanel variant="subtle" size="sm" class-name="bg-error/10" content-class="text-center">
          <div class="text-xl font-bold text-error-text">
            {{ analytics.performanceMetrics.dueCards }}
          </div>
          <div class="text-xs text-error-text">Due</div>
        </UiPanel>
        <UiPanel variant="subtle" size="sm" class-name="bg-success/10" content-class="text-center">
          <div class="text-xl font-bold text-success-text">
            {{ analytics.performanceMetrics.masteredCards }}
          </div>
          <div class="text-xs text-success-text">Mastered</div>
        </UiPanel>
      </div>
    </div>
  </UiPanel>
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
    "0": "bg-error",
    "1": "bg-warning",
    "2": "bg-warning",
    "3": "bg-warning",
    "4": "bg-primary",
    "5": "bg-success",
  };
  return colors[grade] || "bg-content-secondary";
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
