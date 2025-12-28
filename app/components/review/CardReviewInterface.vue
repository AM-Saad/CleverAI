<template>
  <div class="max-w-4xl mx-auto p-6 space-y-6" tabindex="0" role="application"
    aria-label="Spaced repetition card review interface" @keydown="handleKeydown">
    <!-- Analytics Summary -->
    <ReviewAnalytics :show="showAnalytics" :folder-id="folderId" @close="showAnalytics = false" />

    <!-- Keyboard Shortcuts Help -->
    <review-keyboard-shortcuts :show="showShortcuts" @close="showShortcuts = false" />

    <!-- Debug Panel (Dev Only) -->
    <dev-only>
      <div v-if="showDebugPanel"
        class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-semibold text-yellow-900 dark:text-yellow-100">Debug Panel</h3>
          <button @click="showDebugPanel = false" class="text-yellow-600 hover:text-yellow-800">
            ✕
          </button>
        </div>
        <div class="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
          <div><strong>Queue Length:</strong> {{ reviewQueue.length }}</div>
          <div><strong>Current Index:</strong> {{ currentCardIndex }}</div>
          <div><strong>Is Loading:</strong> {{ isLoading }}</div>
          <div><strong>Has Error:</strong> {{ error ? 'Yes' : 'No' }}</div>
          <template v-if="currentCard">
            <div class="border-t border-yellow-300 dark:border-yellow-700 pt-2 mt-2">
              <div><strong>Card ID:</strong> {{ currentCard.cardId }}</div>
              <div><strong>Resource Type:</strong> {{ currentCard.resourceType }}</div>
              <div><strong>Review State:</strong></div>
              <ul class="ml-4 space-y-1">
                <li>Repetitions: {{ currentCard.reviewState.repetitions }}</li>
                <li>Ease Factor: {{ currentCard.reviewState.easeFactor }}</li>
                <li>Interval: {{ currentCard.reviewState.intervalDays }} days</li>
                <li>Next Review: {{ new Date(currentCard.reviewState.nextReviewAt).toLocaleString() }}</li>
              </ul>
            </div>
          </template>
          <div v-else class="text-yellow-600 dark:text-yellow-300 italic">
            No current card (queue is empty)
          </div>
        </div>
      </div>
    </dev-only>

    <!-- Header with Progress -->
    <div class="flex justify-between items-center">
      <review-header :current-index="currentCardIndex" :total-cards="reviewQueue.length" :progress="progress"
        :session-time="sessionTime" />

      <review-stats :queue-stats="queueStats" @toggle-analytics="showAnalytics = !showAnalytics"
        @toggle-debug="showDebugPanel = !showDebugPanel" />
    </div>

    <!-- Card Display -->
    <review-card-display v-if="currentCard && !isLoading && !error" :card="currentCard" :show-answer="showAnswer" />

    <!-- Action Buttons -->
    <div v-if="currentCard && !isLoading && !error" class="border-t bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
      <!-- Show Answer Button -->
      <review-answer-reveal-button v-if="!showAnswer" :is-submitting="isSubmitting" @reveal="revealAnswer" />

      <!-- Grade & Navigation -->
      <div v-else class="space-y-4">
        <review-grade-buttons :is-submitting="isSubmitting" @grade="gradeCard" />
        <review-navigation-controls :is-first-card="isFirstCard" :is-last-card="isLastCard"
          :is-submitting="isSubmitting" @previous="previousCard" @next="nextCard" @skip="skipCard" />
      </div>
    </div>

    <!-- Empty State - only show when not loading, no error, and no cards -->
    <review-states-empty-state v-else-if="!isLoading && !error && !currentCard" :study-session-reviews="reviewCount"
      @refresh="$emit('refresh')" @show-analytics="showAnalytics = true" />

    <!-- Loading State -->
    <review-states-loading-state v-if="isLoading" />

    <!-- Error State -->
    <review-states-error-state v-if="error && !isLoading" :error="error" @clear-error="clearError" />

    <!-- Session Summary Modal/Overlay (Minimal Implementation) -->
    <div v-if="showSummaryModal && sessionSummary"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        class="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full space-y-6 text-center border dark:border-gray-700">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Session Complete!</h2>

        <div class="space-y-4">
          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="text-sm text-gray-500 dark:text-gray-400">XP Gained</div>
            <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">+{{ sessionSummary.xpGained }}</div>
          </div>

          <div v-if="sessionSummary.leveledUp"
            class="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg animate-pulse">
            <div class="text-lg font-bold text-yellow-700 dark:text-yellow-400">🎉 Level Up!</div>
            <div class="text-sm text-yellow-600 dark:text-yellow-300">
              Level {{ sessionSummary.levelBefore }} → <span class="font-meduim">{{ sessionSummary.levelAfter }}</span>
            </div>
          </div>

          <div v-if="sessionSummary.stageUnlocked"
            class="p-4 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg">
            <div class="text-lg font-bold text-purple-700 dark:text-purple-400">🌟 New Stage Unlocked!</div>
            <div class="text-sm text-purple-600 dark:text-purple-300">
              {{ sessionSummary.stageAfter }}
            </div>
          </div>


        </div>

        <u-button @click="showSummaryModal = false" size="lg"
          class="w-full text-center justify-center transition-opacity">
          Continue
        </u-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReviewGrade } from '~/shared/utils/review.contract'

interface Props {
  folderId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  cardGraded: [cardId: string, grade: ReviewGrade]
}>()

// Core review composable
const {
  reviewQueue,
  currentCard,
  currentCardIndex,
  queueStats,
  isLoading,
  isSubmitting,
  error,
  isFirstCard,
  isLastCard,
  progress,
  grade,
  fetchQueue,
  nextCard: goToNextCardInQueue,
  previousCard: goToPreviousCardInQueue,
  clearError,
} = useCardReview()

// Session timer composable
const { sessionTime, reviewCount, incrementReviews, reset: resetSession } = useSessionTimer()

// Session summary composable
const { startSession, endSession, summary: sessionSummary } = useSessionSummary()

// Local UI state
const showAnswer = ref(false)
const showAnalytics = ref(false)
const showShortcuts = ref(false)
const showDebugPanel = ref(false)
const showSummaryModal = ref(false)

// Keyboard shortcuts composable
const { handleKeydown: handleKey } = useKeyboardShortcuts({
  onRevealAnswer: () => {
    if (!showAnswer.value && currentCard.value) {
      revealAnswer()
    }
  },
  onGrade: (gradeValue: string) => {
    if (showAnswer.value && currentCard.value) {
      gradeCard(gradeValue as ReviewGrade)
    }
  },
  onNavigatePrevious: () => previousCard(),
  onNavigateNext: () => nextCard(),
  onSkip: () => skipCard(),
  onToggleShortcuts: () => {
    showShortcuts.value = !showShortcuts.value
  },
  onToggleAnalytics: () => {
    showAnalytics.value = !showAnalytics.value
  },
  onCloseAll: () => {
    showShortcuts.value = false
    showAnalytics.value = false
    showDebugPanel.value = false
    showSummaryModal.value = false
  },
})

// Methods
const revealAnswer = () => {
  showAnswer.value = true
}

const gradeCard = async (gradeValue: ReviewGrade) => {
  if (!currentCard.value) return

  try {
    console.log(currentCard.value)
    emit('cardGraded', currentCard.value.cardId, gradeValue)
    await grade(currentCard.value.cardId, gradeValue)

    // Track session stats
    incrementReviews()

    // Reset for next card
    showAnswer.value = false

    // If no more cards, emit refresh AND end session
    if (reviewQueue.value.length === 0) {
      await endSession()
      showSummaryModal.value = true
      emit('refresh')
    }
  } catch (err) {
    console.error('Failed to grade card:', err)
  }
}

const nextCard = () => {
  showAnswer.value = false
  goToNextCardInQueue()
}

const previousCard = () => {
  showAnswer.value = false
  goToPreviousCardInQueue()
}

const skipCard = () => {
  showAnswer.value = false
  nextCard()
}

const handleKeydown = (event: KeyboardEvent) => {
  handleKey(event)
}

// Watch for prop changes
watch(
  () => props.folderId,
  () => {
    fetchQueue(props.folderId)
    resetSession()
    startSession()
  },
  { immediate: true }
)

// Reset answer visibility when card changes
watch(currentCard, () => {
  showAnswer.value = false
})
watch(sessionSummary, () => {
  console.log('Session summary:', sessionSummary.value)
})

// Focus management for accessibility
onMounted(() => {
  nextTick(() => {
    const container = document.querySelector('[role="application"]') as HTMLElement
    container?.focus()
  })
})
</script>
