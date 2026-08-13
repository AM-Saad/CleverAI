# Daily action deletion architecture

Status: implemented 2026-08-14

## Decision

Daily action deletion is a reversible domain state change, not a physical row delete.

| User intent                             | Command              | Durable result                                                              | Placement history                        |
| --------------------------------------- | -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| Delete one-time action                  | `actionItem.archive` | Item lifecycle becomes `ARCHIVED`                                           | Preserved                                |
| Delete one date from a repeating action | `occurrence.cancel`  | Occurrence becomes `CANCELLED`; `currentPlacementId` becomes `null`         | Preserved                                |
| Delete an entire repeating action       | `actionItem.archive` | Series lifecycle becomes `ARCHIVED`                                         | Every occurrence and placement preserved |
| Undo one occurrence                     | `occurrence.restore` | Latest placement is reattached; occurrence returns to `OPEN` or `COMPLETED` | Reused, not recreated                    |
| Undo item/series                        | `actionItem.restore` | Item lifecycle becomes `ACTIVE`                                             | Existing exceptions and history remain   |

“This and future occurrences” is deliberately not offered. `recurrence.untilDate` alone is unsafe: already materialized future moves, completions, and cancellations can survive the rule edit. Supporting that scope needs an explicit series split or a range tombstone model.

## Why this model

`ActionItem` is the definition. `ActionOccurrence` is one dated result or exception. `ActionPlacement` is the append-only location trail. Deleting the latest placement would erase move provenance, weaken conflict recovery, and make undo dependent on reconstruction. Hard-deleting an item would also prevent another offline device from learning that it was removed.

The authoritative visibility gates are:

1. `ActionItem.lifecycle === ACTIVE` for the item/series.
2. `ActionOccurrence.status !== CANCELLED` for an individual date.
3. `ActionOccurrence.currentPlacementId` for the current visible location.

Placement `state` continues to describe the placement’s last physical disposition (`ACTIVE`, `MOVED`, or `COMPLETED`). A cancelled occurrence detaches the pointer but does not rewrite or remove that historical placement. No current query treats placement state alone as visibility.

`SKIPPED` is not used for deletion. A skip is a behavioral outcome and may later affect streaks or completion reporting; cancellation means the user removed that scheduled obligation.

## State transitions and invariants

```text
ActionItem:       ACTIVE <-> ARCHIVED

Occurrence:       OPEN ---------> CANCELLED ---------> OPEN
                    |                  ^
                    v                  |
                 COMPLETED ------------+-------------> COMPLETED

Placement:        preserved through every archive/cancel/restore transition
Current pointer:  placement id -> null -> same/latest placement id
```

Required invariants:

- An occurrence key is stable: `${actionItemId}:${originalDateKey}`.
- At most one occurrence exists for a user and occurrence key.
- Cancellation never deletes a placement.
- A cancelled occurrence has no current placement pointer.
- Restore uses the latest placement; if `completedAt` is present it restores `COMPLETED`, otherwise `OPEN`.
- Archiving a series does not overwrite its occurrence-level exceptions. Restoring the series therefore restores the same plan, including previous moves, completions, and cancellations.
- Recurrence editing does not silently clear cancellations. If a removed date later matches the edited recurrence again, its cancellation remains a durable exception.

## Local-first and multi-device behavior

The UI updates IndexedDB and the Offline V2 outbox atomically, reprojects the day, then syncs in the background.

- Create then archive before first sync coalesces into `actionItem.create` with `lifecycle: ARCHIVED`. The server never briefly exposes it as active.
- Archive then immediate undo coalesces when still pending, or becomes a dependent successor when the archive is already in flight.
- Occurrence cancel/restore commands are sequential and never coalesced because their order is user intent.
- Virtual recurring occurrences have client-generated provisional IDs. The server resolves them by the unique occurrence key before revision checks and returns an ID map for both occurrence and source placement. This prevents two devices from producing duplicate logical occurrences or conflicting against different revision rows.
- Item archive/restore conflicts on `lifecycle`.
- Occurrence cancellation conflicts on `status` and `currentPlacementId`. It therefore correctly conflicts with simultaneous completion/reopen (`status`) and movement (`currentPlacementId`).
- Keep-mine conflict resolution rebases only the changed deletion field(s) onto the newest server snapshot. Keep-server restores the server tombstone or live state locally.

Removed rows can disappear from the normal list before a sync conflict arrives. The page therefore renders unmatched action/occurrence conflict panels outside the visible rows, so the decision remains discoverable.

## UI behavior

- Every row exposes Delete in its action menu.
- A one-time item gets a normal confirmation.
- A repeating item requires an explicit choice: This occurrence or Entire series.
- No default scope is guessed for a repeating item.
- A success toast offers immediate Undo.
- Copy says history is preserved; it does not promise a permanent archive browser. A future archive-management view can call the already implemented restore command.
- Delete is disabled while that row has an unresolved item conflict.

## Reminders and notifications

Reminder suppression has several gates:

1. Day projection excludes archived items and cancelled occurrences.
2. Due selection accepts only `OPEN` occurrences.
3. The cron task rechecks item lifecycle and occurrence status immediately before creating the scheduled delivery record.
4. Action metadata is included in the Web Push payload.
5. The service worker checks its newest local item/occurrence tombstone before showing an action reminder.

An operating-system notification that was already delivered cannot be recalled. It represents a past delivery, so item deletion does not erase historical in-app notification/audit rows.

In split deployment, only `all` or `platform` surfaces start cron by default. `ENABLE_CRON=true` is the explicit override and `ENABLE_CRON=false` disables it. This prevents duplicate reminders when Platform and Daily run as separate Nitro services.

## Business rules

- Daily deletion is available to every signed-in user. It consumes no credits and does not depend on subscription tier because no LLM or paid resource is used.
- The user can mutate only their own item/occurrence; all server lookups include `userId` ownership.
- Delete does not currently award/remove XP and does not alter billing or generation quotas.
- Completion data is retained during cancellation so undo can faithfully restore a completed occurrence. A cancelled status is authoritative, so it is excluded from reminders and future completion metrics while cancelled.
- Product analytics should distinguish `archived`, `occurrence_cancelled`, and `skipped`; combining them would corrupt completion/retention interpretation. No Daily product analytics event pipeline exists today, so this change does not invent one.
- Account erasure remains the privacy hard-delete boundary through existing user cascades. Normal action deletion is reversible product behavior, not regulatory erasure.

## Data, API, and deployment impact

- No backfill is required. `ActionItemLifecycle.ARCHIVED` and `ActionOccurrenceStatus.CANCELLED` already existed in Prisma and shared contracts.
- No physical delete endpoint is added.
- New Offline V2 operations: `actionItem.restore`, `occurrence.cancel`, and `occurrence.restore`.
- Existing bootstrap and day responses keep archived/cancelled records as sync tombstones where needed, but projection items exclude them.
- Deploy Platform/offline-sync server first, then Daily UI, then the rebuilt service worker. A new UI against an old sync server would reject the new operations and roll back safely, but would be poor user experience.
- Rollback is safe: old clients already hide archived action items, and a cancelled occurrence has a null current pointer. New tombstones remain durable even if the new controls are rolled back.

## Known gaps and follow-ups

1. Archive management: Undo is immediate only. Add a “Recently removed” view if long-lived restoration becomes a user need.
2. This-and-future: design a range exception or series-split model before exposing that scope.
3. Retention/performance: bootstrap currently downloads all historical Daily definitions, occurrences, and placements. Tombstones increase that set. Monitor payload size and add versioned tombstone compaction only after defining the minimum offline-device retention window.
4. Analytics: add explicit domain events before measuring deletion; do not infer it from a missing row.
5. Notification race: server and service-worker checks minimize stale delivery, but no system can recall an OS push already displayed.
6. Bulk actions: future bulk delete must preserve the same per-item scope rules and should be a batch of reversible commands, not a database `deleteMany`.
7. Permanent delete: if later required outside account erasure, it needs retention policy, dependent-notification cleanup, offline-device acknowledgement, audit policy, and a delayed purge job. It must not reuse the current Delete control.

## Verification contract

Regression coverage pins:

- cancelled occurrences are absent from projection while placements remain;
- archived definitions are retained but have no projected appearance;
- create-plus-archive outbox coalescing;
- lifecycle conflict rebasing;
- reminder exclusion for cancelled/completed/moved rows;
- shared create contract accepts coalesced archived lifecycle;
- existing Offline V2 rollback, dependency, ID remap, and conflict tests continue to pass.
