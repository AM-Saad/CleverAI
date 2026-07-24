# Daily Feature

Owns the day-planner slice: recurring action items, per-day placements
(reschedule/complete state), and one rich-text note per day. Routed at
`/day/[date]` (app/pages/day/[date].vue) — there is no `/daily` route.

## Boundaries

- `composables/useDaily.ts` owns all CRUD/offline-mutation entry points:
  `loadDay`, `createAction`, `setCompleted`, `reschedule`, `saveNote`,
  `getNoteConflict`/`resolveNoteConflict`. Everything goes through the
  generic Offline V2 queue (`useOfflineRuntime`).
- `domain/projectLocalDay.ts` is a pure function that expands recurrence
  rules and placements/occurrences into one day's projected item list from
  a local snapshot — no I/O.
- `presentation/dailyActionViewModel.ts` maps a projected day item to
  display fields (timing label, overdue, recurrence label, moved-date
  label) for `DailyActionRow.vue`.
- `repositories/dailyLocalRepository.ts` owns the Offline-V2-backed local
  snapshot, server-merge reconciliation (never clobbers entities with a
  pending local mutation), and dailyNote conflict detection/auto-resolve.
- `composables/dailyDraftCommitter.ts` and `dailyEditorRuntimeState.ts` are
  deliberate trimmed mirrors of the Notes feature's draft-commit and
  lifecycle-flush composables (see their header comments) — kept in sync
  with that pattern by convention, not by shared code.
- `components/*`: `DailyDateNavigation` (header/week strip) →
  `DailyActionSection` → `DailyActionList` → `DailyActionRow`;
  `DailyNoteSection` → `DailyNoteConflictPanel` + `DailyRichEditor`;
  `ActionItemSheet` → `ActionItemForm`; `RescheduleActionSheet` →
  `RescheduleActionForm`.

## Sync UX / Conflict Policy

- Actions and notes are optimistic-local via the Offline V2 outbox;
  `useDaily.ts` re-projects the local snapshot immediately, then syncs and
  refreshes from the server in the background.
- Note edits are debounced (mirrors Notes' pattern) and flushed on blur,
  date change, unmount, or tab hide/pagehide (`dailyEditorRuntimeState.ts`).
- A dailyNote conflict is only surfaced when local and server content
  actually differ; equivalent content is auto-resolved to "keep-server"
  without interrupting the user (`autoResolveEquivalentNoteConflicts`).
  Real conflicts render via `DailyNoteConflictPanel.vue` with
  keep-local/keep-server resolution.
- Rescheduling an occurrence materializes explicit source/target placement
  rows rather than mutating one row in place.

## Manual QA

1. Create an action item for today, complete it, then reopen it; refresh
   and confirm state persists.
2. Reschedule an action to another date and confirm it disappears from the
   original day and appears (materialized) on the target day.
3. Edit the day note, navigate away before the debounce fires, and confirm
   the draft still flushes (lifecycle flush on unmount/date change).
4. Edit the same day's note from two sessions to force a genuine content
   conflict; confirm `DailyNoteConflictPanel` offers keep-local/keep-server
   and resolves correctly.
5. Create a recurring action item and confirm it projects onto the correct
   future dates via `projectLocalDay`.
6. Open today, wait a moment, and check the Network tab: two additional
   `/api/daily/day/*` requests should fire (yesterday + tomorrow) once
   today's own load finishes — not before, not in parallel with it. Tap the
   next-day chevron and confirm the note/action items render with no
   empty-flash, with either no new request (prefetch already resolved) or a
   single joined request, never a duplicate. Tap next several times rapidly
   and confirm no console errors and the final landed date shows correct
   content (`useDaily.ts`'s `prefetchAdjacentDays`/`refreshFromServer` guard).
