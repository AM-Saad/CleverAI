/**
 * Composable for managing notification subscription modal display logic
 * Handles when to show the modal, user preferences, and timing logic
 */

interface NotificationPromptPreference {
  timestamp: number
  action: 'subscribed' | 'dismissed'
  dontAskAgain?: boolean
}

export function useNotificationPrompt() {
  const { isSubscribed, checkSubscriptionStatus } = useNotifications()
  const showModal = ref(false)

  // Constants for timing logic
  const PROMPT_DELAY_AFTER_DISMISSAL = 7 * 24 * 60 * 60 * 1000 // 7 days
  const PROMPT_DELAY_INITIAL = 2 * 60 * 1000 // 2 minutes after first visit
  const MIN_VISITS_BEFORE_PROMPT = 2 // Show after 2nd visit

  /**
   * Check if user should be prompted for notifications
   */
  const shouldPromptUser = async (): Promise<boolean> => {
    // Client-side only
    if (!import.meta.client) return false

    try {
      // Check if already subscribed
      await checkSubscriptionStatus()
      if (isSubscribed.value) {
        return false
      }

      // Check stored preference
      const storedPref = localStorage.getItem('notificationPrompted')
      if (storedPref) {
        const preference: NotificationPromptPreference = JSON.parse(storedPref)

        // If user said "don't ask again", respect that
        if (preference.dontAskAgain) {
          return false
        }

        // If user subscribed, don't prompt again
        if (preference.action === 'subscribed') {
          return false
        }

        // If user dismissed, check if enough time has passed
        if (preference.action === 'dismissed') {
          const timeSinceDismissal = Date.now() - preference.timestamp
          if (timeSinceDismissal < PROMPT_DELAY_AFTER_DISMISSAL) {
            return false
          }
        }
      }

      // Check visit count to avoid being too aggressive
      const visitCount = getVisitCount()
      if (visitCount < MIN_VISITS_BEFORE_PROMPT) {
        return false
      }

      // Check if user has cards due (more relevant to show prompt)
      const hasCardsDue = await checkIfUserHasCardsDue()

      // Show prompt if:
      // 1. Not subscribed
      // 2. Haven't been prompted recently or said "don't ask"
      // 3. Has visited enough times
      // 4. (Bonus) Has cards due for better relevance
      return hasCardsDue || visitCount >= MIN_VISITS_BEFORE_PROMPT + 2

    } catch (error) {
      console.error('Error checking notification prompt status:', error)
      return false
    }
  }

  /**
   * Get and increment visit count
   */
  const getVisitCount = (): number => {
    if (!import.meta.client) return 0

    const visitKey = 'userVisitCount'
    const currentCount = parseInt(localStorage.getItem(visitKey) || '0', 10)
    const newCount = currentCount + 1

    localStorage.setItem(visitKey, newCount.toString())
    return newCount
  }

  /**
   * Check if user has cards due for review
   */
  const checkIfUserHasCardsDue = async (): Promise<boolean> => {
    try {
      // This is a simplified check - you might want to call a specific API
      // For now, check if user has any folders (indicates they're actively using the app)
      const response = await $fetch('/api/folders/count')
      return response.count > 0
    } catch (error) {
      console.error('Error checking cards due:', error)
      // Default to true if we can't check (better to show modal than miss opportunity)
      return true
    }
  }

  /**
   * Show the notification prompt modal with optimal timing
   */
  const promptUserForNotifications = async (): Promise<void> => {
    const shouldShow = await shouldPromptUser()
    if (shouldShow) {
      // Small delay to let page settle
      setTimeout(() => {
        showModal.value = true
      }, PROMPT_DELAY_INITIAL)
    }
  }

  /**
   * Handle modal events
   */
  const handleModalClose = () => {
    showModal.value = false
  }

  const handleUserSubscribed = () => {
    showModal.value = false
    console.log('✅ User subscribed to notifications')
  }

  const handleUserDismissed = () => {
    showModal.value = false
    console.log('📋 User dismissed notification prompt')
  }

  /**
   * Force show the modal (for testing or specific triggers)
   */
  const forceShowModal = () => {
    showModal.value = true
  }

  /**
   * Check if it's a good time to show notification prompt
   * (e.g., after user completes a review session)
   */
  const isGoodTimingForPrompt = (): boolean => {
    if (!import.meta.client) return false

    // Check if user just completed a review session
    const lastReviewSession = localStorage.getItem('lastReviewSession')
    if (lastReviewSession) {
      const sessionTime = parseInt(lastReviewSession, 10)
      const timeSinceSession = Date.now() - sessionTime

      // Show prompt 30 seconds after completing a review
      return timeSinceSession > 30 * 1000 && timeSinceSession < 5 * 60 * 1000
    }

    return false
  }

  /**
   * Mark that user completed a review session (for timing logic)
   */
  const markReviewSessionCompleted = () => {
    if (import.meta.client) {
      localStorage.setItem('lastReviewSession', Date.now().toString())
    }
  }

  /**
   * Reset prompt preferences (for testing)
   */
  const resetPromptPreferences = () => {
    if (import.meta.client) {
      localStorage.removeItem('notificationPrompted')
      localStorage.removeItem('userVisitCount')
      localStorage.removeItem('lastReviewSession')
      console.log('🔄 Notification prompt preferences reset')
    }
  }

  /**
   * Get debug information about prompt status
   */
  const getDebugInfo = () => {
    if (!import.meta.client) return {}

    return {
      visitCount: localStorage.getItem('userVisitCount') || '0',
      lastPrompted: localStorage.getItem('notificationPrompted') || 'Never',
      lastReview: localStorage.getItem('lastReviewSession') || 'Never',
      isSubscribed: isSubscribed.value,
      showModal: showModal.value
    }
  }

  return {
    // State
    showModal: readonly(showModal),
    isSubscribed: readonly(isSubscribed),

    // Methods
    shouldPromptUser,
    promptUserForNotifications,
    forceShowModal,
    isGoodTimingForPrompt,
    markReviewSessionCompleted,
    resetPromptPreferences,
    getDebugInfo,

    // Event handlers
    handleModalClose,
    handleUserSubscribed,
    handleUserDismissed
  }
}

// Global function to trigger prompt after review sessions
export const triggerNotificationPromptAfterReview = () => {
  const { markReviewSessionCompleted, promptUserForNotifications, isGoodTimingForPrompt } = useNotificationPrompt()

  markReviewSessionCompleted()

  // Delayed check for good timing
  setTimeout(async () => {
    if (isGoodTimingForPrompt()) {
      await promptUserForNotifications()
    }
  }, 30 * 1000) // 30 seconds after review completion
}
