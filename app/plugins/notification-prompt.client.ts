/**
 * Plugin to automatically prompt users for notification subscription
 * at optimal times during their app usage
 */

export default defineNuxtPlugin({
  name: "notification-prompt",
  setup() {
    // Only run on client side
    if (!import.meta.client) return;

    // Flag to prevent duplicate triggers
    let hasTriggered = false;

    const triggerPromptCheck = async (source: string) => {
      // Prevent duplicate triggers
      if (hasTriggered) return;
      hasTriggered = true;

      // Clean up all listeners
      document.removeEventListener("click", onInteraction);
      document.removeEventListener("scroll", onInteraction);
      document.removeEventListener("keydown", onInteraction);
      if (fallbackTimerId) clearTimeout(fallbackTimerId);

      // Wait a bit after user interaction to let them settle
      setTimeout(async () => {
        try {
          const { useNotificationPrompt } = await import(
            "@/composables/shared/useNotificationPrompt"
          );
          const { shouldPromptUser } = useNotificationPrompt();
          const shouldShow = await shouldPromptUser();

          if (shouldShow) {
            console.log(`🔔 Triggering notification modal (${source})`);
            window.dispatchEvent(new CustomEvent("showNotificationModal"));
          } else {
            console.log("📋 Notification prompt skipped - conditions not met");
          }
        } catch (error) {
          console.error("Error checking notification prompt status:", error);

          // Fallback to simple logic if composable fails
          const lastPrompted = localStorage.getItem("notificationPrompted");
          if (!lastPrompted) {
            window.dispatchEvent(new CustomEvent("showNotificationModal"));
          }
        }
      }, source === "interaction" ? 2000 : 0);
    };

    const onInteraction = () => triggerPromptCheck("interaction");

    let fallbackTimerId: ReturnType<typeof setTimeout> | null = null;

    const setupNotificationPrompt = () => {
      // Add event listeners for user interaction
      document.addEventListener("click", onInteraction);
      document.addEventListener("scroll", onInteraction);
      document.addEventListener("keydown", onInteraction);

      // Fallback: trigger after 30 seconds even without interaction
      fallbackTimerId = setTimeout(() => {
        triggerPromptCheck("fallback-timer");
      }, 30000);
    };

    // Set up the prompt logic after a short delay to ensure everything is loaded
    setTimeout(setupNotificationPrompt, 1000);
  },
});
