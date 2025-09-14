/**
 * Plugin to automatically prompt users for notification subscription
 * at optimal times during their app usage
 */

export default defineNuxtPlugin({
  name: 'notification-prompt',
  setup() {
    // Only run on client side
    if (!import.meta.client) return

    // Set up the prompt logic after the app is mounted
    const setupNotificationPrompt = () => {
      const triggerPromptAfterInteraction = async () => {
        // Remove event listeners once triggered
        document.removeEventListener('click', triggerPromptAfterInteraction)
        document.removeEventListener('scroll', triggerPromptAfterInteraction)
        document.removeEventListener('keydown', triggerPromptAfterInteraction)

        // Wait a bit after user interaction to let them settle
        setTimeout(async () => {
          try {
            // Use the sophisticated logic from the composable
            const { useNotificationPrompt } = await import('~/composables/shared/useNotificationPrompt')
            const { shouldPromptUser } = useNotificationPrompt()
            const shouldShow = await shouldPromptUser()

            if (shouldShow) {
              console.log('🔔 Triggering notification modal based on user interaction and engagement')
              window.dispatchEvent(new CustomEvent('showNotificationModal'))
            } else {
              console.log('📋 Notification prompt skipped - conditions not met')
            }
          } catch (error) {
            console.error('Error checking notification prompt status:', error)

            // Fallback to simple logic if composable fails
            const lastPrompted = localStorage.getItem('notificationPrompted')
            if (!lastPrompted) {
              window.dispatchEvent(new CustomEvent('showNotificationModal'))
            }
          }
        }, 2000) // 2 seconds after first interaction
      }

      // Add event listeners for user interaction
      document.addEventListener('click', triggerPromptAfterInteraction, { once: true })
      document.addEventListener('scroll', triggerPromptAfterInteraction, { once: true })
      document.addEventListener('keydown', triggerPromptAfterInteraction, { once: true })

      // Fallback: trigger after 30 seconds even without interaction (for very engaged users)
      setTimeout(async () => {
        document.removeEventListener('click', triggerPromptAfterInteraction)
        document.removeEventListener('scroll', triggerPromptAfterInteraction)
        document.removeEventListener('keydown', triggerPromptAfterInteraction)

        try {
          const { useNotificationPrompt } = await import('~/composables/shared/useNotificationPrompt')
          const { shouldPromptUser } = useNotificationPrompt()
          const shouldShow = await shouldPromptUser()

          if (shouldShow) {
            console.log('🔔 Triggering notification modal via fallback timer')
            window.dispatchEvent(new CustomEvent('showNotificationModal'))
          }
        } catch (error) {
          console.error('Error in fallback notification prompt:', error)
        }
      }, 30000)
    }

    // Set up the prompt logic after a short delay to ensure everything is loaded
    setTimeout(setupNotificationPrompt, 1000)
  }
})
