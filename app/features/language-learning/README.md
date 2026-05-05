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
