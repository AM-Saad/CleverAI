# Notifications Feature

Owns client-side notification subscription, prompt timing, and notification preferences UI.

## Boundaries

- `components/NotificationSubscriptionModal.vue` handles the opt-in prompt and local dismissal state.
- `components/NotificationPreferences.vue` handles user-facing notification delivery preferences.
- `composables/useNotifications.ts` owns browser Push API registration and subscription refresh.
- `composables/useNotificationPrompt.ts` owns prompt timing and review-session trigger behavior.

Legacy auto-import entrypoints remain in `app/components/modals`, `app/components/settings`, and `app/composables/shared`.
Feature internals should import each other explicitly instead of relying on Nuxt auto-import discovery.
