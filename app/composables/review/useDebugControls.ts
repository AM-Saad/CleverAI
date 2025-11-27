import type { ReviewCard } from '~/shared/utils/review.contract'

/**
 * Debug control state interface
 */
export interface DebugValues {
  easeFactor: number
  intervalDays: number
  repetitions: number
  streak: number
  nextReviewAt: string
  lastGrade: number | undefined
}

/**
 * Debug preset types
 */
export type DebugPreset = 'new' | 'learning' | 'mastered' | 'struggling'

/**
 * Composable for managing debug controls in review interface
 * DEV ONLY - Provides manual manipulation of card review state for testing
 */
export const useDebugControls = (currentCard: Ref<ReviewCard | null>) => {
  const isDev = process.env.NODE_ENV === 'development'
  
  // Debug panel visibility
  const isVisible = ref(false)
  const isApplying = ref(false)

  // Debug values state
  const debugValues = reactive<DebugValues>({
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    streak: 0,
    nextReviewAt: '',
    lastGrade: undefined,
  })

  /**
   * Format date for datetime-local input
   */
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 16)
  }

  /**
   * Get streak value from review state
   */
  const getStreak = (reviewState: Record<string, unknown>): number => {
    return (reviewState.streak as number) || 0
  }

  /**
   * Reset debug values to match current card
   */
  const resetToCurrentValues = () => {
    if (!currentCard.value) return

    debugValues.easeFactor = currentCard.value.reviewState.easeFactor
    debugValues.intervalDays = currentCard.value.reviewState.intervalDays
    debugValues.repetitions = currentCard.value.reviewState.repetitions
    debugValues.streak = getStreak(currentCard.value.reviewState as Record<string, unknown>)
    debugValues.nextReviewAt = formatDateTime(currentCard.value.reviewState.nextReviewAt)
    debugValues.lastGrade = undefined
  }

  /**
   * Apply debug values to current card via API
   */
  const applyDebugValues = async (onSuccess?: () => Promise<void>) => {
    if (!currentCard.value || !isDev) return

    isApplying.value = true

    try {
      const updateData: {
        cardId: string
        easeFactor: number
        intervalDays: number
        repetitions: number
        streak: number
        nextReviewAt?: string
        lastGrade?: number
      } = {
        cardId: currentCard.value.cardId,
        easeFactor: debugValues.easeFactor,
        intervalDays: debugValues.intervalDays,
        repetitions: debugValues.repetitions,
        streak: debugValues.streak,
      }

      if (debugValues.nextReviewAt) {
        updateData.nextReviewAt = new Date(debugValues.nextReviewAt).toISOString()
      }

      if (debugValues.lastGrade !== undefined) {
        updateData.lastGrade = debugValues.lastGrade
      }

      await $fetch('/api/review/debug/update', {
        method: 'POST',
        body: updateData,
      })

      // Call success callback if provided (typically to refresh queue)
      if (onSuccess) {
        await onSuccess()
      }

      console.log('✅ Debug values applied successfully')
    } catch (err) {
      console.error('❌ Failed to apply debug values:', err)
      throw err
    } finally {
      isApplying.value = false
    }
  }

  /**
   * Load a preset configuration for testing different card states
   */
  const loadPreset = (preset: DebugPreset) => {
    switch (preset) {
      case 'new':
        debugValues.easeFactor = 2.5
        debugValues.intervalDays = 0
        debugValues.repetitions = 0
        debugValues.streak = 0
        debugValues.nextReviewAt = formatDateTime(new Date().toISOString())
        debugValues.lastGrade = undefined
        break

      case 'learning':
        debugValues.easeFactor = 2.3
        debugValues.intervalDays = 6
        debugValues.repetitions = 2
        debugValues.streak = 2
        debugValues.nextReviewAt = formatDateTime(
          new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString()
        )
        debugValues.lastGrade = 3
        break

      case 'mastered':
        debugValues.easeFactor = 3.2
        debugValues.intervalDays = 45
        debugValues.repetitions = 8
        debugValues.streak = 15
        debugValues.nextReviewAt = formatDateTime(
          new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
        )
        debugValues.lastGrade = 5
        break

      case 'struggling':
        debugValues.easeFactor = 1.4
        debugValues.intervalDays = 1
        debugValues.repetitions = 0
        debugValues.streak = 0
        debugValues.nextReviewAt = formatDateTime(new Date().toISOString())
        debugValues.lastGrade = 1
        break
    }
  }

  /**
   * Toggle debug panel visibility
   */
  const toggle = () => {
    isVisible.value = !isVisible.value
  }

  /**
   * Show debug panel
   */
  const show = () => {
    isVisible.value = true
  }

  /**
   * Hide debug panel
   */
  const hide = () => {
    isVisible.value = false
  }

  // Watch for current card changes to auto-sync debug values
  watch(
    currentCard,
    (newCard) => {
      if (newCard && isDev) {
        resetToCurrentValues()
      }
    },
    { immediate: true }
  )

  return {
    // State
    isVisible: readonly(isVisible),
    isApplying: readonly(isApplying),
    debugValues: readonly(debugValues),
    isDev,

    // Methods
    resetToCurrentValues,
    applyDebugValues,
    loadPreset,
    toggle,
    show,
    hide,
    formatDateTime,
    getStreak,
  }
}
