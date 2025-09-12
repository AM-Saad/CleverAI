import type { 
  EnrollCardRequest,
  EnrollCardResponse,
  GradeCardRequest,
  GradeCardResponse,
  ReviewQueueResponse,
  ReviewCard,
  ReviewGrade
} from '~/shared/review.contract'

export const useCardReview = () => {
  // Reactive state
  const reviewQueue = ref<ReviewCard[]>([])
  const currentCard = ref<ReviewCard | null>(null)
  const currentCardIndex = ref(0)
  const queueStats = ref({
    total: 0,
    new: 0,
    due: 0,
    learning: 0
  })
  
  // Loading and error states
  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  // Enroll a material as a review card
  const enroll = async (materialId: string): Promise<EnrollCardResponse> => {
    isSubmitting.value = true
    error.value = null
    
    try {
      const response = await $fetch<EnrollCardResponse>('/api/review/enroll', {
        method: 'POST',
        body: { materialId } satisfies EnrollCardRequest
      })
      
      return response
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'data' in err 
        ? (err as { data?: { message?: string } }).data?.message 
        : 'Failed to enroll card'
      error.value = errorMsg || 'Failed to enroll card'
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  // Grade a card
  const grade = async (cardId: string, grade: ReviewGrade): Promise<GradeCardResponse> => {
    isSubmitting.value = true
    error.value = null
    
    try {
      const response = await $fetch<GradeCardResponse>('/api/review/grade', {
        method: 'POST',
        body: { cardId, grade } satisfies GradeCardRequest
      })
      
      // Remove the graded card from the queue
      const cardIndex = reviewQueue.value.findIndex(card => card.cardId === cardId)
      if (cardIndex !== -1) {
        reviewQueue.value.splice(cardIndex, 1)
        queueStats.value.due = Math.max(0, queueStats.value.due - 1)
        
        // Update current card index if needed
        if (currentCardIndex.value >= reviewQueue.value.length) {
          currentCardIndex.value = Math.max(0, reviewQueue.value.length - 1)
        }
        
        // Update current card
        if (reviewQueue.value.length > 0) {
          currentCard.value = reviewQueue.value[currentCardIndex.value] || null
        } else {
          currentCard.value = null
          currentCardIndex.value = 0
        }
      }
      
      return response
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'data' in err 
        ? (err as { data?: { message?: string } }).data?.message 
        : 'Failed to grade card'
      error.value = errorMsg || 'Failed to grade card'
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  // Fetch review queue
  const fetchQueue = async (folderId?: string, limit: number = 20): Promise<void> => {
    isLoading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      if (folderId) params.append('folderId', folderId)
      params.append('limit', limit.toString())
      
      const response = await $fetch<ReviewQueueResponse>(`/api/review/queue?${params}`)
      
      reviewQueue.value = response.cards
      queueStats.value = response.stats
      
      // Set current card
      if (reviewQueue.value.length > 0) {
        currentCardIndex.value = 0
        currentCard.value = reviewQueue.value[0] || null
      } else {
        currentCard.value = null
        currentCardIndex.value = 0
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'data' in err 
        ? (err as { data?: { message?: string } }).data?.message 
        : 'Failed to fetch review queue'
      error.value = errorMsg || 'Failed to fetch review queue'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Navigate to next card
  const nextCard = (): void => {
    if (currentCardIndex.value < reviewQueue.value.length - 1) {
      currentCardIndex.value++
      currentCard.value = reviewQueue.value[currentCardIndex.value] || null
    }
  }

  // Navigate to previous card
  const previousCard = (): void => {
    if (currentCardIndex.value > 0) {
      currentCardIndex.value--
      currentCard.value = reviewQueue.value[currentCardIndex.value] || null
    }
  }

  // Jump to specific card
  const goToCard = (index: number): void => {
    if (index >= 0 && index < reviewQueue.value.length) {
      currentCardIndex.value = index
      currentCard.value = reviewQueue.value[index] || null
    }
  }

  // Clear error
  const clearError = (): void => {
    error.value = null
  }

  // Reset state
  const reset = (): void => {
    reviewQueue.value = []
    currentCard.value = null
    currentCardIndex.value = 0
    queueStats.value = { total: 0, new: 0, due: 0, learning: 0 }
    error.value = null
    isLoading.value = false
    isSubmitting.value = false
  }

  // Computed properties
  const hasCards = computed(() => reviewQueue.value.length > 0)
  const isFirstCard = computed(() => currentCardIndex.value === 0)
  const isLastCard = computed(() => currentCardIndex.value === reviewQueue.value.length - 1)
  const progress = computed(() => {
    if (reviewQueue.value.length === 0) return 0
    return Math.round(((currentCardIndex.value + 1) / reviewQueue.value.length) * 100)
  })

  return {
    // State
    reviewQueue: readonly(reviewQueue),
    currentCard: readonly(currentCard),
    currentCardIndex: readonly(currentCardIndex),
    queueStats: readonly(queueStats),
    isLoading: readonly(isLoading),
    isSubmitting: readonly(isSubmitting),
    error: readonly(error),
    
    // Computed
    hasCards,
    isFirstCard,
    isLastCard,
    progress,
    
    // Actions
    enroll,
    grade,
    fetchQueue,
    nextCard,
    previousCard,
    goToCard,
    clearError,
    reset
  }
}
