# Language Learning Frontend Feature

This feature module owns the frontend language-learning slice.

Nuxt auto-import guidance:

- Feature internals use explicit imports when they need feature-local code.
- Existing auto-imported composables in `app/composables/language/*` and `app/composables/useSpeechCapture.ts` remain wrappers.
- Shared prediction utilities such as `usePredictionaryInput` stay in `app/composables` because they are also used by the shared editor.

Current public entrypoints:

- `containers/LanguageReviewContainer.vue`
- `/language/settings` (`app/pages/language/settings.vue`) is now a redirect stub to `/account/language`, which implements settings inline via the `languageLearningRuntime`/`useLanguageLearningRuntime` composable directly — settings is no longer a container-owned surface of this feature.
- `components/*`
- `presentation/languageWordRowViewModel.ts` is the view-model mapper feeding `LanguageWordBankList.vue`.

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

Review presentation:

- `shared/utils/language-review-card.ts` is the single presentation policy for
  server queues, Offline V2 queues, enrollment validation, and learning-home
  previews.
- Translated words ask learned-language word -> native-language translation.
  Definition-only words ask word -> learned-language definition. Story cards
  ask the story's exact primary cloze -> lexical answer.
- Cards use the context-matched primary meaning. Extra senses remain in word
  details instead of turning one review card into several ambiguous facts.
- Review queues enforce the active learned/native language pair. They never
  fill an empty pair-specific queue with cards from another language.
- Captured casing is preserved for display. Normalized lowercase text exists
  only for lookup/cache identity.
- Captured context appears on the question side only when it does not contain
  the answer; otherwise it remains available after reveal.
- Each card carries a content version. Meaningful answer or story changes reset
  its schedule so a materially changed card is learned again.
- Auto-enroll controls card creation. Once a card exists, regenerated story
  content updates that card even when auto-enroll is later disabled.
