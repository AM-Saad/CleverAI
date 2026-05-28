# Language Learning Frontend Feature

This feature module owns the frontend language-learning slice.

Nuxt auto-import guidance:

- Feature internals use explicit imports when they need feature-local code.
- Existing `app/components/language/*` component names remain compatibility wrappers so current templates keep working.
- Existing auto-imported composables in `app/composables/language/*` and `app/composables/useSpeechCapture.ts` remain wrappers.
- Shared prediction utilities such as `usePredictionaryInput` stay in `app/composables` because they are also used by the shared editor.

Current public entrypoints:

- `containers/LanguageHomeContainer.vue`
- `containers/LanguageReviewContainer.vue`
- `containers/LanguageSettingsContainer.vue`
- `components/*`
- `composables/useLanguageCapture.ts`
- `composables/useLanguageReview.ts`
- `composables/useLanguageStats.ts`
- `composables/useSpeechCapture.ts`
- `services/languageService.ts`

Runtime notes:

- `languageLearningRuntime.ts` is the feature-local shared runtime for preferences, word-bank state, stats state, invalidation, and latest capture/story state.
- Composables stay as compatibility facades; components should use composables or the runtime instead of browser-level `language:*` events.
- Word-bank fetch, pagination, enroll, delete, and stats refresh are runtime-owned so cards/status panels do not duplicate server state management.
- Language Learning is online-first in v1. Translation and story generation require the server; review-offline queues are a later slice.
- Review grading uses stable per-card request IDs so repeated clicks do not grade the same visible card twice.
