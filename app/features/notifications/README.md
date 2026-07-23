# Notifications Feature

Owns client-side notification subscription and prompt timing.

## Boundaries

- `components/NotificationSubscriptionModal.vue` handles the opt-in prompt and local dismissal state.
- Delivery-preferences UI now lives directly in `app/pages/account/notifications.vue` (inline `notificationPrefs` state, `loadNotificationPreferences()`/`saveNotificationPreferences()`) — not in this feature.
- `composables/useNotifications.ts` owns browser Push API registration and subscription refresh.
- `composables/useNotificationPrompt.ts` owns prompt timing and review-session trigger behavior.

Legacy auto-import entrypoints remain in `app/components/modals`, `app/components/settings`, and `app/composables/shared`.
Feature internals should import each other explicitly instead of relying on Nuxt auto-import discovery.
