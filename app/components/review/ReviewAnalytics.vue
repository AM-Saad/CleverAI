<template>
  <div v-if="show">
    <ReviewAnalyticsSummary
      v-if="analytics"
      :analytics="analytics"
      @close="handleClose"
    />
    <div
      v-else-if="isLoading"
      class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 text-center"
    >
      <Loading />
      <p class="text-gray-600 dark:text-gray-400 mt-4">
        Loading analytics...
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AnalyticsData {
  totalCards: number
  totalReviews: number
  currentStreak: number
  retentionRate: number
  averageGrade: number
  gradeDistribution: Record<string, number>
  performanceMetrics: {
    averageEaseFactor: number
    averageInterval: number
    newCards: number
    learningCards: number
    dueCards: number
    masteredCards: number
  }
}

interface Props {
  show: boolean
  folderId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// Local state
const analytics = ref<AnalyticsData | null>(null)
const isLoading = ref(false)

// Load analytics when shown
const loadAnalytics = async () => {
  if (analytics.value) return // Already loaded

  isLoading.value = true
  try {
    const response = await $fetch('/api/review/analytics', {
      query: props.folderId ? { folderId: props.folderId } : {},
    })
    analytics.value = response.data as AnalyticsData
  } catch (err) {
    console.error('Failed to load analytics:', err)
  } finally {
    isLoading.value = false
  }
}

// Watch for show changes
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      loadAnalytics()
    }
  },
  { immediate: true }
)

// Handle close
const handleClose = () => {
  emit('close')
}
</script>
