# Notes and Board Offline V2: historical cutover record

> **Do not use the Notes sections below as the current design.** The V2-only Notes cutover exposed competing ownership and acknowledgement gaps, so Notes were restored to a single hardened feature pipeline. Board remains on its separate current path. See [Notes V1 restoration and sync incident](./NOTES_V1_RESTORATION_INCIDENT.md) for the current Notes flow, defects, fixes, and validation.

Date: 2026-07-16

## Historical decision (superseded for Notes)

Notes and Board now use Offline V2 only.

- All create, update, delete, move, and reorder commands enter the account-scoped V2 outbox.
- The only Notes/Board mutation sync endpoint is `POST /api/offline/sync`.
- The Notes and Board V1 bulk endpoints, feature-specific service-worker handlers, sync tags, and client service methods were removed.
- Notes retain their feature-owned stores. Board uses `offlineEntities` as its only durable projection and `offlineMutations` as its only outbox.
- `boardItems`, `boardColumns`, and `pendingBoardItems` remain in the schema only as one-time Phase 2 migration inputs. No active Board path writes, hydrates, acknowledges, or drains them.

## The invariant

Every Notes/Board command follows the same state machine online and offline:

1. Apply the intended state to reactive memory immediately.
2. Make the recoverable local state durable.
3. Add or coalesce a typed V2 mutation, retaining the original rollback snapshot.
4. If verified online, ask the shared runtime to drain. If offline, leave the mutation pending.
5. Atomically claim the exact mutation revision being sent.
6. Send the claimed batch to `POST /api/offline/sync`.
7. Apply one of four outcomes:
   - `applied`: accept the canonical snapshot/ID and remove only the claimed revision;
   - `retry`: retain the mutation and local projection;
   - `rejected`: restore `rollbackData`, or remove a rejected local create;
   - `conflict`: retain local and server snapshots for explicit resolution.

For a Board delete, the view disappears immediately and the generic entity becomes a tombstone while the mutation retains `rollbackData`. A server rejection restores that snapshot in the same generic transaction. A create followed by delete before sync collapses to no server command and removes its temporary generic entity.

## Why every sync request is POST

`/api/offline/sync` is a command-envelope endpoint, not a REST endpoint for one entity. A single batch can contain ordered creates, updates, and deletes across several entity types. The HTTP transport is therefore always `POST`; each mutation's `operation` field carries the domain verb, for example:

```json
{
  "clientId": "device-id",
  "mutations": [
    { "operation": "note.create", "entity": "note" },
    { "operation": "boardItem.update", "entity": "boardItem" },
    { "operation": "boardColumn.delete", "entity": "boardColumn" }
  ]
}
```

Reads still use `GET`. Specialized collaboration snapshot and upload endpoints are not outbox replay and keep their own HTTP semantics.

## Quick Note Capture: general shell

The general Capture Sheet and the Notes-page Quick Note sheet share `useQuickNoteCapture`; they do not have separate persistence implementations.

1. The user selects Note and a workspace.
2. `begin(null)` first awaits any previous session's create/finalize work, then resets one new capture session. Opening the editor creates nothing.
3. The first non-empty title or body calls the idempotent `ensureCreated()`. Concurrent title/body callbacks share one `createPromise`.
4. The first observed title and body are captured before the asynchronous create starts.
5. `createNote` creates a UUID-backed temporary ID and an optimistic in-memory note.
6. Content/title normalization runs once. The note gets its group, append order, type, tags, and initial position.
7. The complete initial note is written to the Notes IndexedDB view cache. Failure removes the optimistic note and returns no ID.
8. The Notes V2 adapter queues `note.create` with the initial content in the same durable command. It does not create an empty note and then manufacture an unchanged update.
9. The shared runtime atomically claims the mutation and sends it to `/api/offline/sync` when online. Offline, it remains pending and the temporary note survives reload.
10. The server validates the strict create payload, inserts once, advances the entity revision, stores the mutation receipt, and returns a temporary-to-server ID map.
11. The V2 repository remaps the entity and dependent mutations. The Notes cache and every live Notes store replace the temporary ID, while an alias keeps an already-open editor valid.
12. If input changed while create was in flight, only the newer revision enters the shared draft pipeline. A 500 ms trailing save writes the latest note cache and coalesces one `note.update`.
13. `finalize()` is owned by the shared Notes/Board capture-session controller and waits for an in-flight create/commit. A new session cannot reset its source ID or promise until this boundary settles. Stable content produces no extra update. Typed-then-cleared content queues a delete. A sheet opened and closed without input created nothing.

Expected network behavior:

- Stable first input: normally one sync request containing `note.create`.
- Continued editing after the create revision was claimed: one later request containing the necessary successor update.
- Several pending entities may share either request because the endpoint batches commands.
- Three identical stable-state requests are not expected behavior.

## Quick Note Capture: from the Notes page

The Notes-page sheet runs the same steps. The differences are only context:

- `begin(groupId)` can target the group whose Quick Note action was used.
- Done closes and calls the same `finalize()`.
- Open full calls `ensureCreated()`, marks the capture finalized so navigation cannot delete it, flushes the current revision, and navigates using the temporary-or-canonical alias.
- A normal New Note action intentionally creates immediately because it navigates straight to the full editor; the quick sheet remains lazy.

The full editor also uses the same `useNoteDraft` pipeline: immediate memory echo, 500 ms trailing commit, revision tracking, one shared in-flight commit, and page-hide/visibility flushing.

## Note actions

### Update

- Memory is updated immediately.
- The Notes cache write must finish.
- The V2 adapter queues a strict `note.update` payload that does not include create-only `workspaceId`.
- Coalescing preserves the first rollback snapshot while replacing the desired payload with the latest revision.
- An acknowledgement only clears dirty state when the live note still matches the sent payload; a newer edit remains dirty.

### Delete

- Memory removes the note immediately.
- `note.delete` stores the full prior note as `rollbackData`.
- A server-backed cache row remains until `applied`; then it is physically purged.
- `rejected` restores memory and IndexedDB from the snapshot.
- Offline uses exactly the same sequence except network draining waits for reconnect.

### Groups and layout

- Group create/rename/delete/reorder are typed `noteGroup.*` V2 commands.
- Layout changes become per-entity note/group position updates; a layout snapshot can never independently create a note or group.
- Temporary group IDs are remapped in V2 dependencies and in the live/cache Notes projections.

## Board item flow

### Create and Quick Capture

1. Quick Capture is lazy, shares concurrent create calls, and uses the same cross-session lifecycle barrier as Notes.
2. The first non-empty payload creates a UUID-backed temporary card in memory and atomically commits its generic V2 entity plus create mutation.
3. A complete `boardItem.create` is queued in V2.
4. Draft revisions and one in-flight commit prevent Finalize from repeating an unchanged create.
5. Later edits use a 500 ms Quick Capture timer feeding the store's keyed per-item save path.
6. The store uses a 1000 ms keyed debounce: editing item B cannot cancel item A, and an edit during a save produces one latest-state follow-up.
7. Page hide, document hide, reconnect, and explicit refresh flush dirty item keys into V2.

### Update, move, and reorder

- Debounced item drafts are written to the generic entity with `localDirty`; the keyed flush atomically adds/coalesces the mutation and clears that pre-outbox marker.
- Temporary-item updates coalesce into their pending create; they are no longer dropped by an early return.
- Move and reorder use the same V2 adapter online and offline. There is no direct online PATCH path competing with the outbox.
- Reorder keeps one in-flight operation per column and one trailing latest order. Fractional positions avoid rewriting unaffected rows.

### Delete

- Memory removes the card immediately.
- `boardItem.delete` retains the complete prior card as rollback data.
- The generic Board entity is a tombstone while delete is pending and remains deleted on `applied`.
- A rejected delete restores the generic entity and memory from `rollbackData`.

## Board column flow

- Create, rename, reorder, and delete always use `boardColumn.*` V2 commands.
- Column commands atomically update the generic entity and outbox; no column feature cache participates.
- Delete hides the column immediately and projects its cards into Uncategorized.
- The server-side V2 delete now matches the original domain behavior: it normalizes Uncategorized plus moved cards, updates their positions/revisions, and deletes the column in one transaction.
- A pending local column create followed by delete cancels that create. Dependent card projections are restored before cards are re-queued in their visible Uncategorized state.
- A rejected canonical delete restores the column snapshot and refreshes card relationships.

## Board links and comments

Link create/delete and comment create previously used V2 only while offline and direct REST calls while online. They now optimistically update the panel and always queue `boardLink.*` or `boardComment.*`. Ordinary GETs seed their V2 revisions; pending-aware item-scoped reconciliation preserves local relations. Queue failure rolls memory back; V2 rejection removes a rejected create or restores delete rollback data; ID maps, applied canonical snapshots, and Sync Center conflict decisions update the mounted panel immediately.

## Confirmed defects, root causes, and fixes

| Defect                                                      | Root cause                                                                                               | Fix                                                                                                  | Why the fix is correct                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `position` expected string but received `null`              | Prisma/legacy rows allowed null while response validation required a present string                      | Normalize null to omitted at contracts/API boundary and derive a legacy position                     | Valid old absence is repaired; malformed non-null keys remain rejected             |
| Quick Note made repeated sync requests and appeared unsaved | Empty create, stacked debounces, duplicate Finalize commits, plus a failing Notes-list validation        | Put initial input in create; revision/in-flight dedupe; one 500 ms draft commit; normalize list rows | One logical revision becomes one durable mutation; later input is a real successor |
| Notes refresh still called V1 after V1 removal              | The call was hidden behind `NoteService.sync()` inside the refresh runtime                               | Inject and call the shared Offline V2 runtime; remove the service method and endpoint                | Every Notes drain now uses the same claim/receipt/rollback machinery               |
| Notes refresh deleted an active temp cache row              | Cleanup iterated the preserved active temp list instead of stale temps                                   | Track all temps, preserve active mutation IDs, delete only temps with no active command              | A refresh cannot remove the durable row still backing an unresolved create         |
| V1 and V2 competed                                          | Online and offline paths selected different queues/endpoints                                             | Remove V1 endpoints, handlers, tags, and service methods; adapt Notes/Board queues directly to V2    | There is one mutation authority and one acknowledgement owner                      |
| Definitive server errors left optimistic data               | Outbox had desired data but no pre-command snapshot                                                      | Add `rollbackData`; retain the earliest snapshot through coalescing; restore on rejection            | Rollback returns to the state immediately before the logical command chain         |
| Delete purged local data too early                          | Optimistic visibility and canonical cache lifetime were treated as the same thing                        | Hide in memory, retain cache until acknowledgement, purge on applied                                 | Rejection has an exact durable source for restoration                              |
| Cancelling a temp parent erased canonical child state       | Dependency cancellation deleted every child projection                                                   | Restore dependent updates from rollback data; delete only dependent creates                          | Cancelling a local relation cannot destroy a known server snapshot                 |
| Board temp edits disappeared                                | Temp updates returned before entering any queue                                                          | Queue temp updates so they coalesce into create                                                      | Edits made before ID acknowledgement stay attached to the logical card             |
| Board item debounce lost other cards                        | One global timer was shared by all item IDs                                                              | Store-owned keyed async debounce                                                                     | Timer ownership matches entity ownership                                           |
| Quick Board Finalize duplicated writes                      | Create was not marked as the durable draft revision                                                      | Track draft/durable revisions and share commit promise                                               | Stable Finalize observes that create already contains that revision                |
| Rapid capture reopen could allocate another entity          | The previous async create/finalize resumed after the next session reset shared source and promise fields | Shared capture-session controller, generation checks, and guarded UI transitions                     | Old work cannot clear or commit state owned by the new capture session             |
| Board columns bypassed V2 online                            | Online rename/delete/reorder called direct REST endpoints                                                | Always persist and queue V2 commands                                                                 | Online/offline differ only in when drain starts                                    |
| V2 column delete differed from direct API                   | V2 only deleted the column and relied on relation behavior                                               | Normalize affected cards and advance related entity revisions in the V2 transaction                  | Both command paths preserve the Board ordering invariant and conflict space        |
| Board link/comment behavior split by connectivity           | Components selected direct REST online and V2 offline                                                    | Always optimistic + V2 + rollback/remap listeners                                                    | Connectivity no longer changes semantics or acknowledgement ownership              |

## Validation

- 142 deterministic unit tests pass in the current combined suite.
- Nuxt typecheck passes.
- The service worker builds successfully and retains the Workbox injection placeholder.
- Source and built worker contain no Notes/Board V1 endpoint, message, tag, or migration call.

## Confidence boundary

This is a consistent design, but not a mathematical guarantee that no browser defect remains.

1. A hard process kill inside the 500 ms editor debounce can still prevent the browser's page-hide flush. Once a local/cache write or V2 mutation completes, recovery is durable.
2. Temporary-to-canonical route aliases are held in live store memory. Durable cache IDs are correct, but reopening a bookmarked temporary URL after a background acknowledgement may still require redirect work.
3. Cross-tab and service-worker ownership is protected by atomic leases; a visible window owns live reconciliation and the worker is the no-window recovery owner. A real multi-tab browser test remains valuable.
4. Historical V1 pending-store declarations and test-only helpers are source/schema cleanup debt, not active runtime paths.
5. This document's V2-only claim covers Notes and Board. Some other domains, notably workspace/material/tag UI mutations, still choose direct REST online and V2 offline and should be converted separately before claiming the invariant for the entire application.
