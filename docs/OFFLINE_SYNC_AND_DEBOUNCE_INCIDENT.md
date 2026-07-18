# Offline Sync and Debounce Incident

Date investigated: 2026-07-13; V2-only follow-up completed 2026-07-16

## Scope

This investigation followed the local-first flow in both directions:

- Top-down: editor action → reactive state → IndexedDB → outbox → browser/service worker → API → receipt → local acknowledgement.
- Bottom-up: server canonical result/conflict → receipt → outbox transition → ID remap → legacy cache → reactive store → route/editor.

The review covered Notes, note groups, Board items/columns/links/comments, workspaces, materials, tags, preferences, language words, and review events.

## Why the earlier creation audit did not find these defects

The earlier audit followed create/remap paths one entity at a time. The defects in this document require adversarial timing or cross-entity behavior:

- a write lands between the outbox read and the status update;
- a second browser context opens while a service worker request is active;
- item B is edited while item A owns a shared timer;
- a new edit occurs while the previous HTTP request is in flight;
- the service worker remaps a group while no Notes view owns the live group map.

Happy-path creation tests cannot exercise those interleavings. The missing test dimension was concurrency and lifecycle ownership, not another create payload field.

## Introduction history

`git blame` identifies when each behavior entered the current branch:

| Defect | Introduced by | Date |
| --- | --- | --- |
| Offline V2 snapshot/status split and in-place coalescing | `203fe8d` (`ui:fixes`) | 2026-07-11 |
| Missing Offline V2 note-group live acknowledgement | `203fe8d` (`ui:fixes`) | 2026-07-11 |
| One Board debounce shared by every item | `6ffb88a` (`major breakdown into feature scoped`) | 2026-05-05 |
| Board reorder persisted behind an uncommitted timer | `d761d83` (`feat(mobile): full mobile PWA redesign and design-system hardening`) | 2026-07-05 |
| Fire-and-forget Notes group and layout durability | `4faf376` (`chore: notes enhancments`) | 2026-05-26 |
| Duplicate TextNote flush invocation | `3e51e82` / `1866b12`; collaboration equivalent `b387c02` | 2026-05-09 to 2026-06-11 |

These commits introduced useful local-first behavior, but their completion contracts did not cover multiple execution contexts, stale responses, or crash boundaries.

## Confirmed defects and fixes

### 1. Newer outbox payload could be deleted by an older acknowledgement

#### Root cause

The synchronizer read a pending batch, then changed those mutation IDs to `syncing` in a second transaction. Pending writes coalesced into the same mutation ID. A write between those operations could update IndexedDB while the network sent the older in-memory payload. The older response then deleted the shared mutation ID.

#### Fix

- Added an atomic `claimOfflineMutations` transaction that changes status and returns the exact payload revision to send.
- Added `localRevision`, `claimToken`, and `claimedAt` to stored outbox rows.
- Acknowledgements and error releases now require the matching claim token/revision.
- Recovery only takes an absent or stale lease; a newly opened tab cannot steal a live worker request.
- The browser and service worker use the same repository claim operation.

#### Why this is correct

The mutation revision sent over the network is now the same revision leased in IndexedDB. A response can only remove that revision. A later local revision survives even if an older request completes afterward.

### 2. Same-entity successor could conflict with its own predecessor

#### Root cause

Dependency selection excluded `syncing` mutations. A second tab could treat a dependency outside its pending snapshot as complete, or send another update to the same entity while the first update was active.

#### Fix

- Atomic claims reject a candidate when the same entity has another syncing mutation.
- Dependencies that still exist outside the requested claim remain unresolved.
- Applying a predecessor rebases a queued same-entity successor to the returned server version.
- Canonical acknowledgement data does not overwrite a newer local snapshot.

#### Why this is correct

Only one ordinary state transition per entity can be in flight. The next mutation starts from the version produced by its predecessor while retaining its newer desired local data.

### 3. Board edits shared one global debounce timer

#### Root cause

The cached Board store created one `useDebounce` instance. Editing item B cancelled item A. The timer was also owned by the lifecycle of whichever component first created the cached store.

#### Fix

- Added a store-owned keyed async debounce.
- Every item has independent trailing work.
- An edit during an in-flight request requests exactly one latest-state follow-up.
- Store cleanup explicitly cancels timers.
- A stale successful HTTP response preserves a newer item version instead of clearing/replacing it.

#### Why this is correct

Timer ownership now matches mutation ownership: one key per item. Cross-item cancellation is impossible, and a response can only acknowledge the version it sent.

### 4. Note-group temp IDs were not acknowledged end to end

#### Root cause

Offline V2 had explicit bridges for notes, Board items, and Board columns, but not `noteGroup`. Durable V2 data was remapped while the legacy Notes group map, notes, queues, and layout could retain the temporary group ID.

#### Fix

- Added atomic note-group reconciliation across group records, notes, pending note/group changes, and layout snapshots.
- Added browser and service-worker note-group handling.
- Added live Notes workspace group remapping, collapsed-state remapping, and note reference remapping.

#### Why this is correct

The group key and every reference to it move together before dependent work continues. A queued edit after acknowledgement targets the server group rather than creating or referencing the temporary group again.

### 5. Layout and group operations reported success before durability

#### Root cause

Notes group commands and note layouts updated memory and launched IndexedDB/queue work in detached promises. Board reorder did the same behind a 150 ms timer and did not first establish a dirty durable state.

#### Fix

- Group create/rename/delete/reorder remain optimistic in memory but their promises resolve only after local persistence and queue registration.
- Failures roll back the latest optimistic group state.
- Notes layout waits for local note and layout-queue writes, returns `false` on failure, and rolls back the latest generation.
- Board reorder marks changed items dirty, waits for strict IndexedDB writes before returning, ignores stale generations, and persists the clean acknowledgement.

#### Why this is correct

Network completion is still asynchronous, but an operation no longer claims local success before a recoverable durable representation exists.

### 6. Draft lifecycle and duplicate flushes

#### Root cause

Mobile/quick-note drafts were not registered with the global draft flush set. Page suspension could occur before their 500 ms save. `TextNote.flushPendingSave` also called the debounced function and the direct function, producing duplicate commits/snapshots.

#### Fix

- `useNoteDraft` registers its durable commit with the shared draft registry.
- The registry performs best-effort flushes on `pagehide` and when the document becomes hidden.
- TextNote now cancels its timer and invokes the save exactly once.

### 7. Other live projections did not receive temp-ID remaps

#### Root cause

Acknowledgement events were hard-coded to the first migrated domains.

#### Fix

- Added a generic entity-ID remap event.
- Live user-tag, material, workspace, Board link, and Board comment projections now replace temporary IDs and resolve captured aliases during the current session.
- Notes and Board conflicts/rejections are projected into the visible entity error state and remain resolvable in Sync Center.

### 8. Language word online writes were outside the offline conflict revision space

#### Root cause

Online enroll/delete endpoints changed `languageWord` without advancing `OfflineEntityState`, while offline replay used that state for conflict detection.

#### Fix

Both online endpoints now advance the same entity/field revision used by Offline V2.

## Tests added

The deterministic regression suite now covers:

- latest coalesced payload is the revision atomically claimed;
- an older acknowledgement preserves and rebases a newer edit;
- a live lease cannot be recovered or claimed by a second owner;
- independent item keys cannot cancel each other's debounce;
- an edit during an in-flight keyed save produces one follow-up;
- note-group remap updates the group and note view caches while V2 remaps its own outbox references.
- a definitive rejection restores the pre-command snapshot;
- cancelling a local parent restores dependent canonical projections instead of deleting them.

Validation performed:

- 131 unit tests pass.
- Nuxt typecheck passes.
- The service worker bundle builds and retains its injection placeholder.

## Residual risk and honest confidence boundary

This work materially raises confidence, but it is not a proof that no defect exists. Remaining known limitations are:

1. Temp-to-server aliases are durable in canonical entity data but session alias maps are still memory-only. A bookmarked temporary-ID route reopened after a background sync may not redirect to the canonical ID. A durable alias/redirect store is the recommended follow-up.
2. Notes and Board now have one active outbox and one sync endpoint. Historical pending-store names remain in the IndexedDB schema so old local databases can still open, but no Notes/Board runtime writes or drains them.
3. `lastSuccessfulSyncAt` means the sync service was reached, not that every mutation was applied. UI language should eventually distinguish last contact, fully drained, conflicted, and rejected.
4. Browser termination cannot guarantee completion of asynchronous IndexedDB work. `pagehide`/hidden flushing reduces the window; the durable repair-on-next-start path remains essential.
5. Cross-tab and service-worker behavior is covered at the repository interleaving level, but a real multi-tab Playwright test should be added for browser integration confidence.

The correct standard is therefore not “100% sure.” It is: explicit invariants, atomic boundaries, stale-response rejection, deterministic interleaving tests, and a documented list of what is not yet proven.
