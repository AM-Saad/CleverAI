# Review Frontend Feature

This is the first frontend feature slice for the modular monolith migration.

Nuxt auto-import guidance:

- Feature internals use explicit imports from `app/features/review`.
- Existing `app/components/review/*` component names stay in place for now so current templates keep working.
- Existing auto-imported composables in `app/composables/review/*` and `app/composables/workspaces/useCardReview.ts` are compatibility wrappers.
- New review workflows should be added here first, then exposed through a small wrapper only when legacy auto-import compatibility is needed.

Current public entrypoints:

- `containers/ReviewPageContainer.vue`
- `components/*`
- `composables/useReviewPage.ts`
- `composables/useReviewQueue.ts`
- `composables/useReviewStats.ts`
- `composables/useSessionSummary.ts`
- `services/reviewService.ts`

Compatibility wrappers:

- `app/components/review/*` re-export feature components so existing Nuxt auto-import names keep working.
- `CardReviewInterface.old.vue` and `CardReviewInterface.refactored.vue` remain legacy files outside this feature slice and should not be used for new work.
