# Language Learning Frontend Feature

This feature module owns the frontend language-learning slice.

Nuxt auto-import guidance:

- Feature internals use explicit imports when they need feature-local code.
- Existing `app/components/language/*` component names remain compatibility wrappers so current templates keep working.
- Existing auto-imported composables in `app/composables/language/*` and `app/composables/useSpeechCapture.ts` remain wrappers.
- Shared prediction utilities such as `usePredictionaryInput` stay in `app/composables` because they are also used by the shared editor.

Current public entrypoints:

- `containers/LanguageReviewContainer.vue`
- `containers/LanguageSettingsContainer.vue`
- `components/*`

Page composition:

- `/language` is one continuous page: compact capture first, then the live word
  bank. Capture and bank are not separate page-level tabs.
- The word bank owns search, filters, word details, enrollment, deletion, and
  the due-review entrypoint.
- `composables/useLanguageCapture.ts`
- `composables/useLanguageReview.ts`
- `composables/useLanguageStats.ts`
- `composables/useSpeechCapture.ts`
- `services/languageService.ts`

Runtime notes:

- `languageLearningRuntime.ts` is the feature-local shared runtime for preferences, word-bank state, stats state, invalidation, and latest capture/story state.
- Composables stay as compatibility facades; components should use composables or the runtime instead of browser-level `language:*` events.
- Word-bank fetch, pagination, enroll, delete, and stats refresh are runtime-owned so cards/status panels do not duplicate server state management.
- Capture always saves a lexical entry; native-language translation fields are
  optional and default from `translateOnCapture`.
- Translation and story generation require the server. Preferences, word-bank
  reads, enrollment, deletion, review, grading, and stats use Offline V2.
- Bank cards open `LanguageWordDetailModal`; story generation is only available
  as a deliberate action inside word details.
- Review grading uses stable per-card request IDs so repeated clicks do not grade the same visible card twice.
