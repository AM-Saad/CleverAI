# Notes V1 restoration and sync incident

Date completed: 2026-07-18

## Decision

Notes use one feature-owned local-first pipeline again:

- reactive Notes memory is the optimistic projection;
- the `notes`, `noteGroups`, and layout records are the durable local projection;
- `pendingNotes`, `pendingNoteGroups`, and `pendingNoteLayouts` are the only Notes outboxes;
- `notesSyncRuntime.ts` is the only in-window Notes drainer;
- `POST /api/notes/sync` is the only Notes mutation transport;
- the service worker drains the same queues only when no window client exists;
- the generic Offline V2 runtime explicitly excludes `note` and `noteGroup`.

“V1” here does not mean an old user-facing product or unauthenticated API. It means the Notes-specific queue and acknowledgement protocol that already matches the Notes editor's cache, group, layout, conflict, and temporary-ID models. Offline V2 remains available for the domains it owns.

## What was introduced, and when

The reference commit `f5cd0fb` (2026-06-20) still had the working Notes-specific sync boundary. The regression was not one isolated line:

| Change                                                         | Introduction           | Effect                                                                                                               |
| -------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lazy Quick Capture with an empty first create                  | `b3142b4` (2026-07-08) | First input could become a second update; Finalize could race it                                                     |
| Account-scoped Offline V2 plus a Notes migration bridge        | `203fe8d` (2026-07-11) | Notes acquired a second queue, endpoint, ID-remap owner, and service-worker owner                                    |
| Nullable database `position` with a non-null response contract | `203fe8d` (2026-07-11) | One legacy `position: null` row rejected the complete Notes list response                                            |
| Later V2-only working-tree cutover                             | after `203fe8d`        | The Notes endpoint/handler was removed while feature code still depended on Notes-specific acknowledgement semantics |

The three `POST /api/offline/sync` requests seen during one stable Quick Capture were a symptom of duplicated ownership and duplicated logical revisions. The stack reporting `position` as null came from Notes list response validation, so a server create could succeed and still appear not to save when the refresh failed.

## Follow-up incident: Local forever, then duplicated after open/back

The browser report on 2026-07-18 exposed a second, lower-level race that synchronous unit fakes had hidden. The exact failing interleaving was:

1. Quick Capture created `temp-A`, saved it locally, and queued create revision 1.
2. The Notes drainer sent revision 1 to the server.
3. A debounced editor save began reading the `temp-A` outbox row.
4. The server returned canonical ID `note-B`; acknowledgement remapped memory/cache and removed the temp row.
5. The already-running editor save committed revision 2 under `temp-A` after acknowledgement.
6. Opening the note and navigating back hydrated both the canonical cache row and the resurrected temp row. The UI therefore showed two identical notes, while the temp copy remained `Local`.

The outbox revision increment was also implemented as a read transaction followed by a separate write transaction. A create acknowledgement and a new edit could therefore both make locally valid decisions from stale snapshots. This was the direct cause of the duplicate in the supplied screenshot.

A separate delivery problem made previous fixes appear ineffective in the real browser: the service worker's `CacheFirst` asset route cached localhost Vite/Nuxt source modules, and a changed worker could remain waiting behind the manual update banner. Reloading the page could continue executing old Notes code even though the files on disk were fixed.

## Recurrence: capture-session ownership was still mutable

The storage race above was real, but it was not the only way to produce two temporary notes. `begin()`, `ensureCreated()`, and `finalize()` still mutated one set of composable variables without a session-level barrier.

The remaining failure sequence was:

1. Session A started a local create or durable finalization.
2. The sheet closed and the user reopened Quick Capture before that promise settled.
3. Session B reset the shared `sourceId`, `createPromise`, draft counters, and pending input.
4. Session A resumed and cleared what it believed was its own source ID, but that variable now belonged to session B.
5. Session B's next input saw no source ID and allocated another temporary note.

The Board quick-capture composable had the same lifecycle shape, plus an unconditional old-create `finally` that could clear a newer session's create promise. This is now owned by one shared `quickCaptureSession` controller. A new session must await the previous create/finalize boundary before resetting state; stale work is generation-checked; and rapid open/close UI transitions are guarded from re-entry.

The center Capture sheet also cleared `captureWorkspaceId` when its closing animation completed. If local creation was still settling, the composable's computed store became null before finalization could request sync. Each session now pins the Notes or Board store selected at `begin()`, so shell closure or a later workspace change cannot redirect in-flight work.

## Current incident: delete ghosts and stale refresh overwrites

The remaining odd behavior was not another duplicate server create. It was an incorrect local projection and an unguarded read response:

1. On startup, Notes intentionally hydrated IndexedDB first so the page could render immediately.
2. A previously acknowledged delete had removed its outbox tombstone before deleting the cached note in a second IndexedDB transaction. A reload or interruption between those transactions left a clean ghost row.
3. `refreshFromServer()` wrote the returned server rows but never removed clean IndexedDB rows that were absent from the server. The ghost therefore appeared on every reload, then disappeared only in reactive memory when the server result replaced the list.
4. A Notes `GET` also captured no generation/revision boundary. If create, update, or delete happened while the request was in flight, its older response could clear memory and persist the older projection after the newer command.
5. The Notes page could start the same hydrate/refresh sequence from both its mount hook and active-workspace watcher. This was wasteful and widened the stale-response window.
6. Text changed memory immediately but was not marked dirty until the 500 ms durable draft commit. A refresh inside that interval could mistake live text for clean server state.
7. Offline-pack hydration blindly copied Notes rows into IndexedDB. Although current Offline V2 drains excluded Notes, the pack path and legacy V2 status/acknowledgement branches still weakened the one-owner invariant.

These defects explain the report precisely: a deleted note appeared during local-first hydration and vanished after the server read; a temporary or newly edited row could disappear or return after navigation; and a clean stale cache row could look like a duplicate even when the server contained only one canonical note.

## Recurrence: false conflict after overlapping saves

A later report showed two sync requests completing, followed by a third edit being blocked locally with “Resolve conflict first.” The client-side block was working as designed once a conflict record existed; the conflict could be false because the version chain had split:

1. Request A sent server version 1.
2. A newer local revision was queued while A was in flight.
3. A succeeded with server version 2. Acknowledgement correctly rebased the retained outbox row to version 2, but the in-memory and cached note could remain at version 1.
4. The next edit built its command from that stale note and could overwrite the retained outbox row's version 2 with version 1.
5. The server correctly rejected that stale base as `VERSION_MISMATCH`.
6. The client recorded the response as a real conflict and stopped sending later edits until resolution.

The correction makes the server-version chain monotonic in both places: acknowledgement advances the cache version atomically with the outbox revision, and queue coalescing can never replace a known server version with a lower one. The window coordinator advances reactive memory even when a newer local revision must remain dirty. The no-window worker uses the same atomic transition.

A separate classification bug had the same visible outcome: an unexpected database/processing exception was returned in both `errors` and `conflicts`, permanently quarantining retryable work. Processing exceptions now remain errors, keep their durable command pending, and schedule the retry policy; only actual concurrency responses enter manual conflict resolution.

## Recurrence: stalled drains and acknowledgement replays

The 2026-07-19 report exposed five scheduling and retry gaps that were independent of IndexedDB durability:

1. Both text-editor debounces were purely trailing. Continuous typing could keep resetting the timer forever, so the current text was visible and dirty in memory but never promoted into the durable outbox.
2. A fetch failure could move the shared network monitor into an unverified-online state without a browser `offline` event. The monitor later verified recovery, but Notes listened only to `window.online`, so the already-durable outbox received no drain request.
3. The sync engine removed its in-flight marker in a promise `finally`. A drain request arriving after the last rerun check but before that callback could be recorded and then deleted without running.
4. An update could commit on the server while its HTTP acknowledgement was lost. Retrying the same complete payload with the old base version was classified as `VERSION_MISMATCH`, even though local and server content had already converged.
5. “Open full note” marked a deferred Quick Capture session finalized without running the normal finalizer, so an unchanged create could remain queued until a later unrelated trigger.

Editors now use a quiet-period debounce with a maximum wait, verified connectivity recovery drains every Notes store, sync ownership is cleared in the same continuation as the final rerun check, and a version mismatch with equivalent complete note state is acknowledged as a replay. Existing stored replay-conflicts are also healed during conflict hydration. Divergent state still creates a real conflict.

## Root causes and fixes

| Bug                                                     | Root cause                                                                                                                                                               | Fix                                                                                                                                                                            | Why this is correct                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A captured note appeared unsaved                        | The subsequent Notes list failed on a legacy null position                                                                                                               | Normalize null/absent positions at the API/contract boundary and derive a valid legacy rank                                                                                    | Historical absence is repaired without accepting malformed non-null positions                                                   |
| Notes had competing sync paths                          | The feature cache/outbox was bridged into Offline V2 while Notes still owned editor aliases, groups, layouts, and conflicts                                              | Restore the Notes outboxes and `/api/notes/sync`; exclude Notes from Offline V2 browser and worker drains                                                                      | One actor owns queueing, sending, ID remap, acknowledgement, and rollback                                                       |
| Stable Quick Capture made multiple logical writes       | It created an empty row, then saved initial input; a 500 ms draft debounce fed another 1000 ms queue debounce; Finalize could commit again                               | Put the first observed title/body in the create, keep one 500 ms draft timer, and make the content queue durable immediately                                                   | One stable captured revision becomes one create; later input is a genuine successor                                             |
| A late capture response took over a newer sheet         | `begin()` discarded the promise reference but the old async task still assigned the shared source ID                                                                     | Add a capture-session generation and ignore ownership changes from stale tasks                                                                                                 | The old durable note survives, but cannot mutate the current editor session                                                     |
| Commands reported success before durability             | Local repository and outbox work ran in detached promises                                                                                                                | Create/update/group/layout promises settle only after the recoverable local state and outbox write complete                                                                    | Callers can safely navigate, close, or finalize after success                                                                   |
| An old response erased a newer edit                     | Acknowledgement removed an entity queue row by ID without comparing the sent revision to the current revision                                                            | Compare `localVersion`, timestamp, and operation; acknowledge only the sent revision and rebase successors                                                                     | A response can settle only the state it actually carried                                                                        |
| A late temp save resurrected a synced note              | Temp cache/outbox writes and temp-to-canonical acknowledgement could interleave, and outbox get/put was split across transactions                                        | Serialize Notes durable mutations per workspace and acknowledge/remap the sent revision in one read-write IndexedDB transaction                                                | No temp write can commit behind its identity transition; a genuine successor survives under the canonical ID                    |
| Quick Capture synced an intermediate revision           | The first create started sync immediately, while typing and the close animation could produce a later update                                                             | Defer the capture's first drain, let its single draft debounce own changed input, and finalize before the sheet close animation                                                | A stable capture drains once; Done cannot let a timer fire during the closing transition                                        |
| Reopening capture could create a second temp note       | Session A's async finalize/create could resume after session B reset the same mutable source and promise fields                                                          | Share one Notes/Board capture-session controller; await prior finalization before reset; generation-check stale work                                                           | An async task can mutate only the session that owns it; the next session cannot lose its identity                               |
| Center capture could remain Local after closing         | The shell cleared its workspace target while finalization still read the store through that mutable computed reference                                                   | Pin the selected domain store to the capture session at `begin()`                                                                                                              | Closing or switching UI context cannot remove or redirect the store that owns an in-flight command                              |
| Reload continued running old Notes code                 | The worker cached localhost source modules and protocol-changing workers waited for manual activation                                                                    | Exclude development source-module URLs from runtime caches; auto-activate and reload once when the durable sync protocol changes                                               | The active page and worker move to the same protocol, while ordinary production asset updates keep the normal update UX         |
| Window and worker could both acknowledge a drain        | A window could appear after a no-client worker drain began                                                                                                               | Recheck for window clients after the response and leave acknowledgement to the window if one appeared                                                                          | Only one runtime performs the local identity/revision transition                                                                |
| Shared service-worker bridge emitted lifecycle warnings | A singleton bridge registered component lifecycle hooks when first called from a Nuxt plugin                                                                             | Initialize the singleton directly and let pages explicitly own Notes hydration                                                                                                 | Shared runtime ownership no longer depends on a component instance                                                              |
| A lost create response could duplicate a note/group     | A retry of a `temp-*` create inserted again                                                                                                                              | Commit a server create receipt keyed by user, entity, and temp ID in the same transaction as the insert                                                                        | A retry returns the original canonical ID; it cannot create a second row                                                        |
| A receipt replay could falsely acknowledge later text   | The receipt represents the earlier create, not necessarily the newest local payload                                                                                      | Mark replayed creates; remap them and queue one canonical-ID successor update                                                                                                  | Identity is recovered without claiming unsent content was persisted                                                             |
| Delete could not be rolled back exactly                 | The canonical cache row was purged before server acknowledgement                                                                                                         | Hide it in memory, store a tombstone with `rollbackData`, retain the server-backed cache row, and purge only on `applied`                                                      | Visibility is optimistic while rollback data remains durable                                                                    |
| A successful delete flashed again after reload          | Outbox acknowledgement and cache deletion used separate IndexedDB transactions; refresh never garbage-collected clean rows absent from server                            | Acknowledge the exact delete revision and remove its cache row atomically; reconcile an exact pending-aware workspace projection                                               | A crash cannot land between acknowledgement and purge; stale clean rows are removed while unsent work remains recoverable       |
| An old GET overwrote a newer create/delete/edit         | Refresh had no request snapshot or apply-time outbox check and blindly replaced memory/cache                                                                             | Snapshot memory before GET; under the workspace mutation lock, overlay current dirty/temp/pending work and suppress concurrent deletes before one projection transaction       | A read can apply only around newer local intent, never on top of it                                                             |
| Startup issued overlapping hydrate/refresh work         | Page mount and workspace watch both started load sequences; runtime had no single-flight                                                                                 | Expose one single-flight `syncWithServer()` and coalesce refresh calls                                                                                                         | One workspace startup owns one hydration/refresh chain                                                                          |
| A refresh could erase text inside the draft debounce    | Immediate memory edits were not marked dirty until their later durable commit                                                                                            | Mark every draft dirty synchronously and overlay edits that land while projection persistence is running                                                                       | Server reads cannot classify uncommitted keystrokes as clean                                                                    |
| Offline-pack/V2 compatibility could rewrite Notes cache | Pack hydration used blind bulk puts and inactive V2 Notes branches still participated in status/accounting                                                               | Reconcile pack Notes through the V1 pending-aware projection; reject Notes queueing in V2 and remove current-client Notes V2 ack/remap branches                                | Notes have one current queue, drainer, and acknowledgement owner                                                                |
| A later edit received a false version conflict          | Acknowledgement rebased a retained outbox revision but did not advance the same note's memory/cache version; a later queue write could downgrade the outbox base version | Advance the cached server version atomically with acknowledgement, advance reactive memory while retaining dirty state, and preserve the maximum known version when coalescing | Every successor is based on at least the version produced by its predecessor; a local stale value cannot manufacture a conflict |
| A transient server exception demanded manual resolution | The server added unexpected processing failures to both `errors` and `conflicts`                                                                                         | Return processing failures only as retryable errors and schedule retry while recoverable work remains                                                                          | Manual conflict UI is reserved for two valid competing versions, not infrastructure failures                                    |
| Group conflicts retried forever                         | Conflicted group rows were not quarantined                                                                                                                               | Mark them `conflicted`, restore delete snapshots, and exclude them from automatic drains                                                                                       | An unresolved conflict stays visible without becoming a request loop                                                            |
| No-window sync could strand a successor                 | A worker completed one snapshot but did not register another drain when newer work remained                                                                              | Re-register `notes-sync` whenever non-conflicted work remains                                                                                                                  | Work created during acknowledgement gets another recovery opportunity                                                           |
| Continuous typing sent no request                       | The editor had an unbounded trailing debounce                                                                                                                             | Keep the quiet-period debounce and add a 2–2.5 second maximum wait                                                                                                             | Typing remains coalesced, but current work crosses the durable boundary during a long editing session                            |
| A degraded connection left durable work waiting         | Notes listened to the browser `online` event, not the monitor's later verified-online transition                                                                          | Subscribe the once-per-app Notes listener to verified recovery and reduce degraded-only polling to five seconds                                                               | A drain begins only after the API is reachable and no unrelated edit or reload is required                                       |
| A trailing sync trigger disappeared                     | The sync engine cleared a rerun flag in a later promise-finally callback                                                                                                   | Clear run ownership synchronously with the final rerun decision                                                                                                                | A caller is either included in the current loop or becomes the owner of a new run                                                 |
| A lost update response became a conflict                | Updates had no way to distinguish an acknowledgement replay from competing content                                                                                        | Treat an old-version retry as applied only when every supplied note field already equals the server snapshot; auto-heal equivalent stored conflicts                            | Equal state is already converged, while any divergent user-visible field still enters manual conflict resolution                 |
| Open-full left a Quick Capture queued                    | That navigation intentionally skipped `finalize()`, which owned the deferred drain                                                                                         | Commit the final draft, then explicitly request the same Notes drainer before handing the session to the full editor                                                           | Navigation cannot strand the create or send an avoidable intermediate revision                                                   |

## Correct create flow: both Quick Capture surfaces

The general Capture Sheet and the Quick Note sheet inside Notes both call `useQuickNoteCapture`. They differ only in how they choose the workspace/group and where they navigate afterward.

### Top down

1. Opening the sheet calls `begin(groupId)`. It first settles any prior capture session, then resets exactly one new session; opening itself creates no note.
2. The first non-empty title or body captures the current title/body and starts one shared `createPromise`.
3. `createNote` allocates a unique `temp-*` ID and inserts the complete initial note into reactive memory.
4. The complete note is saved to the Notes IndexedDB projection.
5. One `upsert` is written to `pendingNotes`. The version increment and write occur in one IndexedDB transaction.
6. Background Sync registration is best effort. Failure to register cannot invalidate an already-durable note.
7. Quick Capture defers its first network drain. Unchanged initial content uses one short quiet-period drain; changed content is owned by the one editor-draft debounce. Pressing Done finalizes before the close animation and requests the drain immediately.
8. When connectivity is verified, the Notes sync engine serializes the drain. A request made while one is active requests one later rerun rather than creating a second owner.
9. The runtime flushes editor drafts, snapshots note/group/layout queues, and calls `POST /api/notes/sync`.
10. The server authenticates the user, validates ownership and payloads, writes a temp-create receipt and note insert atomically, and returns the canonical ID/version.
11. The coordinator and local commands enter the same per-workspace durable-mutation lock.
12. In one read-write transaction, acknowledgement compares the exact sent revision with the current outbox revision, removes the sent revision, and remaps any real successor to the canonical ID.
13. The temp note, pending layout references, editor alias, and local cache move to the canonical ID.
14. If nothing changed after the sent snapshot, the note becomes clean and the queue row is removed. If input changed, the newer revision remains dirty under the canonical ID.
15. `finalize()` is idempotent and shares any in-flight create/commit. An unchanged capture adds no update. Typed-then-cleared content becomes a delete. Opening and closing without input creates nothing.

### Bottom up

1. The server result names every applied ID, conflict, canonical version, temp-ID mapping, group mapping, and layout outcome.
2. A temp create mapping is processed before later layout acknowledgement so no layout can target an obsolete ID.
3. An applied delete removes its exact outbox revision and retained cache row in the same IndexedDB transaction. A newer revision is preserved instead.
4. A delete conflict restores `rollbackData` to memory and IndexedDB, records the server snapshot, and freezes automatic resend.
5. A transient transport failure removes nothing. The optimistic state and durable queue remain for retry.
6. Refresh first drains pending work. At apply time it reads the current outbox again, suppresses deletes that began during the GET, overlays dirty/temporary/newer rows, and reconciles the complete server-plus-local workspace projection in one IndexedDB transaction.
7. Clean local rows absent from the server are garbage-collected. Pending upserts, pending deletes, dirty rows in the cache-to-outbox gap, and edits arriving during persistence are handled explicitly rather than inferred from request timing.

## Online and offline semantics

The command path is identical online and offline. Connectivity changes only when the drain runs.

- Online: memory → durable local projection/outbox → request sync → acknowledge or conflict.
- Offline: memory → durable local projection/outbox → stop; reconnect/app open/background sync resumes at the request step.

For deletes, “server error” must be split into two categories:

- An authoritative conflict/rejection restores the prior snapshot.
- A network timeout or transient 5xx is not evidence that the server rejected the delete; the tombstone remains pending and the note stays optimistically hidden. Rolling it back on a timeout could briefly resurrect a note that the server actually deleted before its response was lost.

Local durability failure always rolls the immediate optimistic operation back because no recoverable command exists.

## Why the sync request is POST

The Notes UI does not send one REST request per local action. `/api/notes/sync` accepts a command batch containing note upserts/deletes, group creates/renames/deletes, and one layout snapshot. The transport is therefore always `POST`; `operation` inside each record carries the domain verb.

Ordinary read endpoints still use `GET`, and the direct service methods retain `POST`, `PATCH`, and `DELETE` for callers outside this outbox workflow. Notes local-first commands use only the batch sync endpoint.

## Debounce and scheduling audit

- Keystrokes update memory synchronously.
- `useNoteDraft` owns one 500 ms quiet-period durable commit per mounted editor draft with a 2 second maximum wait.
- The desktop rich-text editor uses a 700 ms quiet period with a 2.5 second maximum wait.
- `notesContentQueue.queueContentSaveNow` writes the outbox immediately after that timer; there is no second stacked content debounce in the store path.
- `commitNow()` shares one promise and loops only when `draftRevision` is newer than `durableRevision`.
- Quick Capture's first input is already its durable create revision and does not immediately start a competing drain.
- An unchanged first capture schedules one 800 ms drain. If input changes while creation is settling, the editor's 500 ms draft pipeline becomes the sole debounce/drain owner.
- Done calls the idempotent `finalize()` before the closing morph. The `closed` callback is only a safe fallback and cannot create a second command.
- The 50 ms group timer coalesces drain requests, not group durability; group commands await IndexedDB/outbox first.
- `notesSyncEngine` permits one workspace drain at a time and performs requested reruns without a completion gap that can discard the final trigger.
- Verified-online recovery flushes mounted drafts and drains every workspace; degraded-only reachability checks run every five seconds.
- The service worker refuses ownership while a window exists. With no window, it drains the same queues and re-registers if work remains.

## Why this is the recommended fix

The failed architecture had two internally consistent systems joined by an incomplete bridge. Adding more acknowledgement events to that bridge would preserve two owners and keep every new Notes feature responsible for two identity/conflict models.

Restoring the feature pipeline is the smaller invariant:

```text
one command projection
→ one durable Notes outbox
→ one Notes sync endpoint
→ one acknowledgement coordinator
→ one memory/cache identity transition
```

Quick Capture has one separate UI invariant instead of duplicating lifecycle flags in each domain:

```text
one active capture session
→ at most one in-flight create
→ one finalization boundary
→ then (and only then) the next session may reset state
```

This is appropriate even with no production users. A data-migration bridge is unnecessary before launch, while carrying two runtimes would increase the pre-launch defect surface. Existing development-only Offline V2 note mutations should be cleared or exported; active Notes code does not drain them.

## Validation

- 167 deterministic unit tests pass.
- Nuxt typecheck passes.
- Architecture boundary checks pass.
- The service worker source bundles successfully and retains its injection placeholder.
- Regression coverage includes atomic delete acknowledgement/cache purge, pending-aware removal of clean stale local rows, preservation of a pending create, suppression of a pending delete, a stale GET interleaving with a newer create/delete, monotonic outbox server versions, atomic cached-version advancement, retained-successor memory advancement, retryable processing-error classification, lost-response update replay, converged-conflict healing, and open-full Quick Capture draining. Existing temp-remap, capture-session, conflict, layout, group, and receipt tests remain green.
- Authenticated in-app browser verification covered both reported lazy Quick Capture surfaces: the Notes-page sheet and the center general Capture sheet. Each produced one create, one row, and still one row after reload. A separate normal full-editor New Note run produced one create plus its expected later title update and also remained one row after reload.
- Both verification notes were deleted through the normal optimistic flow. On the following reload they were absent immediately after page load, after 150 ms, and after the server refresh, proving the acknowledged cache rows were not rehydrated as ghosts.
- A rapid close/reopen stress run created two intentionally named sessions back-to-back while the first was settling. Each session produced exactly one synced row and one create operation; neither produced a third stale-session note.
- A final authenticated browser run made four title changes roughly 650 ms apart while the first request was still in flight. The engine sent one snapshot and one successor, acknowledged the final value, returned to `synced`, and created no conflict. The test note was deleted and remained absent after reload.
- The same browser run produced no Vue lifecycle-registration warnings after the singleton bridge correction.
- Verification notes were deleted after the run through the normal optimistic delete flow.

## Confidence boundary

This establishes explicit ownership and deterministic race coverage; it is not a claim of mathematical certainty.

1. A hard browser-process kill before the quiet-period/max-wait timer and before lifecycle flushing can still lose the latest keystrokes. Once the IndexedDB/outbox write finishes, recovery is durable.
2. Temp-to-canonical route aliases are held in live memory. The cache is canonical after background acknowledgement, but reopening an old bookmarked temp URL may still need a durable redirect table.
3. Authenticated single-tab Quick Capture is browser-verified, but two-tab contention and a true worker-only reconnect are not yet automated in the Playwright suite. The queue/interleaving logic is covered deterministically.
4. Historical pending V2 Notes mutations are deliberately not given a second runtime owner. This is acceptable before production users; a migration must be designed before changing that assumption.
5. Collaboration-enabled rich-text bodies use the Yjs/Hocuspocus path. Notes metadata, deletes, groups, and layouts still use this outbox, so collaboration and delete timing need separate browser-level QA.
6. A historical clean ghost already stored by an older build may be visible once during the first local-first paint after deployment. The first successful online reconciliation removes it permanently. New acknowledged deletes cannot create that gap because acknowledgement and cache purge are now atomic.
