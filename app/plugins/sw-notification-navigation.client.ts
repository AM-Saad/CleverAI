// NOTE: Functionality moved to useServiceWorkerBridge + layout handling.
// Navigation from NOTIFICATION_CLICK_NAVIGATE is now handled via:
// - useServiceWorkerBridge.notificationUrl reactive ref
// - layout watcher that calls navigateTo() on change
// This eliminates duplicate SW message listeners and centralizes routing logic.

export default defineNuxtPlugin(() => {
  // Plugin disabled - functionality consolidated to useServiceWorkerBridge
});
