# Review Frontend Feature

This is the first frontend feature slice for the modular monolith migration.

Nuxt auto-import guidance:

- Feature internals use explicit imports from `app/features/review`.
- `app/composables/workspaces/useCardReview.ts` is a compatibility wrapper. `app/composables/review/*` is a mixed directory, not purely compatibility shims: `useWorkspaceEnrollment.ts`, `useContentFormatter.ts`, `useDebugControls.ts`, and `useKeyboardShortcuts.ts` are compatibility-era auto-imported composables, but `useSm2Preview.ts` is directly imported by the live `ReviewSessionView.vue`, `ReviewSessionCard.vue`, and `Sm2GradeBar.vue`.
- New review workflows should be added here first, then exposed through a small wrapper only when legacy auto-import compatibility is needed.

Current public entrypoints:

- `containers/ReviewPageContainer.vue`
- `components/*`
- `composables/useReviewQueue.ts`
- `composables/useReviewStats.ts`
- `composables/useSessionSummary.ts`
- `services/reviewService.ts`

Runtime notes:

- Standard and language review use the shared SM-2 grade mapping and interval
  projection from `shared/utils/sm2.ts`.
- Review grades are optimistic in memory, serialized per session, and
  idempotent across ambiguous online retries.
- Offline grades persist the provisional schedule with the outbox mutation and
  reconcile through the same server grading application service.
- See `docs/FLASHCARD_REVIEW_SESSION_AUDIT.md` for the end-to-end flow and
  resolved failure modes.
