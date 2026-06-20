<template>
  <div v-if="show">
    <ReviewAnalyticsSummary v-if="analytics" :analytics="analytics" @close="handleClose" />
    <UiPanel v-else-if="isLoading" variant="surface" size="lg" class-name="mb-6 shadow-[var(--shadow-card-hover)]" content-class="text-center">
      <Loading />
      <p class="text-content-secondary mt-4">
        Loading analytics...
      </p>
    </UiPanel>
  </div>
</template>

<script setup lang="ts">
import ReviewAnalyticsSummary from "~/features/review/components/ReviewAnalyticsSummary.vue";
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
  workspaceId?: string
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
      query: props.workspaceId ? { workspaceId: props.workspaceId } : {},
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
