# Flashcard Review Session Audit

## Scope

This audit follows both review surfaces end to end:

- standard flashcards, questions, and materials;
- language-word review;
- online grading;
- offline optimistic grading and later synchronization;
- reveal, grade, queue transition, retry, and session completion;
- desktop keyboard and mobile touch/swipe behavior.

The current full-screen review experience was introduced in commit `d761d83`
(`feat(mobile): full mobile PWA redesign and design-system hardening`). It
reused the review server domain, but added a second client grade mapping and a
separate interval projection.

## Correct flow

### Queue load

1. Start the session summary baseline and fetch the due queue in parallel.
2. Ignore a response if a newer queue request has started.
3. Use the server queue while online.
4. Use due Offline V2 projections while offline.
5. For language review, apply the active language pair when it has matches and
   fall back to all due language cards when it does not, matching the server.

### Reveal and grade

1. The user reveals one answer.
2. One of four labels maps to one canonical SM-2 grade:
   `Again → 1`, `Hard → 3`, `Good → 4`, `Easy → 5`.
3. The card is removed from the in-memory queue optimistically.
4. All grade controls remain locked until that grade is durable on the server
   or in the offline outbox.
5. On success, the next card remains visible and the session count advances.
6. On failure, the card is restored to the queue and the count rolls back.
7. The final summary appears only after the last grade has completed.

### Online write

1. The client creates one stable request ID per card attempt.
2. A retry reuses that ID.
3. The server creates the idempotency record inside the same transaction as
   XP and the SM-2 schedule update.
4. A duplicate request ID returns the persisted schedule without awarding XP
   or advancing repetitions again.

### Offline write

1. The client calculates the provisional schedule with the shared SM-2 code.
2. It atomically stores the grade mutation and updated Offline V2 projection.
3. The card stays out of the offline due queue after reload.
4. Sync later replays the ordered grade through the same server grading
   application service.
5. The server response replaces the provisional projection with canonical
   state.

## Findings and fixes

| Finding                                                               | Root cause                                                                                  | Fix                                                                                                         | Why this is correct                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The next card could be graded while the previous request was running. | Pending state followed `currentCard`; optimistic removal immediately changed `currentCard`. | Submission state now uses the entire pending-grade set, and both review surfaces reject overlapping grades. | XP and schedule writes are serialized from one session, removing avoidable transaction conflicts. |
| A retry could apply a committed grade twice.                          | Standard review generated a new request ID on every click.                                  | The queue owns a stable per-card request ID and retains it across ambiguous failures.                       | A lost response becomes a replay, not a second grade.                                             |
| A crash could consume the idempotency key without applying the grade. | `GradeRequest` was committed before the schedule transaction.                               | The idempotency claim, XP award, and schedule update now share one transaction.                             | They commit or roll back together.                                                                |
| Interval labels could disagree with the saved schedule.               | The UI implemented separate learning-step math not used by the server.                      | Preview uses the shared server/offline SM-2 function.                                                       | The displayed interval is now the interval that will be persisted.                                |
| Grade labels had different numeric meanings in two UI kits.           | The newer review UI and legacy review kit each declared mappings.                           | Both consume `REVIEW_GRADE_BY_KEY` from the shared SM-2 module.                                             | “Hard” and “Good” now have one meaning everywhere.                                                |
| Old queue responses could replace a newer workspace queue.            | Queue requests had no response epoch.                                                       | Both queue composables discard stale responses.                                                             | Route/workspace changes cannot install an obsolete queue.                                         |
| Language offline review could be empty while online review was not.   | Offline filtering lacked the server's language-pair fallback.                               | Offline review now scopes when possible and otherwise returns all due language cards.                       | Online and offline queue selection are coherent.                                                  |
| Keyboard review was absent from the new full-screen session.          | Keyboard ownership remained in the unused legacy shell.                                     | Space/Enter reveals; keys 1–4 grade; editable fields and repeated keydown are ignored.                      | Desktop behavior is efficient without producing duplicate native-button actions.                  |
| The legacy review interface counted failed grades as completed.       | It incremented before checking the grade result.                                            | It now counts and emits only successful/durable grades.                                                     | Summary totals describe committed work.                                                           |

## Language page integration

The Language page no longer has page-level Capture and Word Bank tabs.

- Capture is a compact, always-available section at the top.
- The word bank is continuously visible below it.
- The bank owns the due-review action.
- Capture and story generation invalidate the shared runtime once; the page no
  longer performs a second explicit bank/stats fetch.
- An open word-detail modal follows the refreshed shared word-bank record.
- Coarse-pointer navigation still avoids automatically opening the mobile
  keyboard.

## Validation

- `163` unit tests pass, including canonical grade mapping, interval projection,
  idempotent replay, transaction retry, and shared SM-2 behavior.
- Nuxt type checking passes.
- Architecture boundaries pass.
- Design-token, component-boundary, and interactive-state checks pass.
- The local browser reached the running app, but its isolated browser profile
  was unauthenticated and was correctly redirected by auth middleware. A signed-
  in visual pass is therefore still required for screenshot-level QA.
