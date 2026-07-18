# Notes creation / Offline V2 incident

> Historical incident record for the attempted Notes V2 bridge. Notes now use a hardened feature-owned pipeline again. See [Notes V1 restoration and sync incident](./NOTES_V1_RESTORATION_INCIDENT.md) for the active architecture and final repair.

## Summary

Creating a note could leave the editor attached to its temporary `temp-*` ID after the server had created the canonical note. Later saves were therefore classified as new creates. Depending on timing, users could see duplicate notes, a note disappear after refresh, or rejected sync actions.

The regression was introduced by commit `203fe8d4742bd241904930260ef3225569866f12` (`ui:fixes`) on 2026-07-11 at 02:00:28 +03:00. That commit introduced the account-scoped Offline V2 outbox and the adapter that migrates the established Notes queues into it.

## User-visible symptoms

- A new note could remain on a `temp-*` route after syncing.
- Editing that note could create another server note instead of updating the first.
- Refreshing could make the temporary note disappear and later reappear from legacy IndexedDB.
- The Sync Center could contain rejected note or group actions generated from layout snapshots.
- Notes created at the end of a group could receive the wrong initial server position.
- Quick Capture could issue several Offline V2 sync requests and then appear to
  lose the note because refreshing the Notes list failed on a legacy
  `position: null` row.

## Follow-up found on 2026-07-16: Quick Capture appeared unsaved

The reported stack at `.nuxt/dev/index.mjs:16947` maps to the development-only
`NoteSchema.parse` loop in `server/api/notes/index.get.ts`; it is not the
`/api/offline/sync` request handler. The create mutation could be committed by
the server and still appear to vanish because the next Notes list request
validated every returned row. One old row with `position: null` rejected the
whole response.

The schema mismatch was introduced by `203fe8d` on 2026-07-11. That commit added
the nullable Prisma `position String?` field and required a string whenever the
field was present in the shared response contract. Existing rows naturally had
MongoDB/Prisma `null`, so the database representation and API contract disagreed.
The response validation loop itself was older and only exposed the mismatch.

Two request-amplifying/durability issues made the symptom more confusing:

- Quick Capture initially created an empty note and then queued the first typed
  title/body as a separate update. This behavior came with Quick Capture in
  `b3142b4` on 2026-07-08.
- `updateNoteContent` returned `true` while its IndexedDB and pending-queue work
  was still detached in a background promise. That completion contract came
  from `4faf376` on 2026-05-26, and Quick Capture's `finalize()` incorrectly
  relied on it as a durable commit.

### Follow-up fix

1. The Notes list boundary now converts a missing/invalid legacy rank to
   `positionFromLegacyOrder(order)` before validation and response serialization.
2. Shared position-aware response contracts accept legacy `null` as omitted,
   while still rejecting malformed non-null keys. The Offline V2 mutation
   parser uses the same compatibility rule.
3. Quick Capture includes the first observed title/body in `note.create`. It
   only schedules a follow-up update if input actually changed while the create
   was in flight.
4. `updateNoteContent` now resolves only after the current revision is written
   to the local Notes store and to the pending outbox. After the editor's 500 ms
   debounce, the content queue writes immediately; the previous second 1000 ms
   queue debounce is no longer stacked underneath it. The draft coordinator
   tracks which revision is already durable and shares one in-flight commit, so
   Finalize neither rewrites an unchanged create nor races the debounce with a
   duplicate update.
5. IndexedDB write failures propagate to the command service instead of being
   logged and reported as success.
6. Background Sync registration is best-effort after the queue is durable. A
   browser that denies or lacks that API no longer turns a successful local
   save into a false failure; startup/online/visibility/in-page drains remain.

This does not promise exactly one HTTP request for every capture. If the user
continues editing while `note.create` is already in flight, a successor
`note.update` is correct and may require a second request. Multiple identical
effects are prevented by atomic outbox claims and server mutation receipts.
Three identical stable-state submissions are not part of the intended flow.

## Top-down trace

1. `createNote` creates an optimistic note with a `temp-*` ID and saves it to the legacy Notes IndexedDB store.
2. A legacy pending-note upsert is written as the durable intake record.
3. `migrateLegacyNotesToV2` converts an upsert whose ID starts with `temp-` into `note.create` and removes the legacy pending row.
4. Offline V2 sends the mutation to `/api/offline/sync`.
5. The server inserts a note and returns `{ tempId: serverId }`.
6. Offline V2 remaps only `offlineEntities` and `offlineMutations`.
7. The active Notes store, the legacy Notes record, the editor route alias, and any legacy layout still retain the temporary ID.
8. The next editor save is written under the temporary ID and is again migrated as `note.create`.

## Bottom-up trace

The server create branch is intentionally simple: every `note.create` inserts a row and returns an ID map. It cannot safely infer that two different mutation receipts represent the same logical create.

Moving upward, the Offline V2 repository correctly remapped its own entity snapshots and dependent outbox payloads. The missing boundary was the transition adapter: Notes still used its established local repository as the editor's source of truth, but Offline V2 never acknowledged the canonical ID back into that repository or its live store.

The old Notes-specific sync path already performed this acknowledgement correctly. The regression appeared only after authenticated Notes traffic began using Offline V2 while the editor continued to use the legacy Notes facade.

## Contributing bug: layout snapshots became creates

Creation also queued a full layout snapshot. The adapter treated temporary IDs inside a layout as proof that the entity needed to be created. A layout contains only placement fields, however; it is not an entity-create command and does not contain required note content or group titles.

When a real create was still pending, outbox coalescing often hid the problem by merging the layout fields into it. If the create was already syncing or applied, the layout could become an incomplete or duplicate create.

## Fix

The repair restores a single identity transition and separates entity creation from layout changes:

1. After an Offline V2 note create succeeds, `reconcileOfflineV2NoteIds` atomically remaps the legacy Notes record, any later legacy pending save, and pending layouts to the canonical server ID. It also records the returned server version and keeps the note dirty when a newer local edit was not part of the acknowledged create.
2. The browser runtime emits the same acknowledgement to every live Notes store. The store replaces the temporary in-memory note, records the temp-to-server alias used by open editors and routes, and persists the canonical record.
3. Service-worker sync performs the durable reconciliation too, so a create completed with no open window is correct when the app next hydrates.
4. Layout snapshots now migrate only as updates. They can merge into an existing pending create, but they can never independently manufacture an entity create.
5. Initial note order is carried on the durable create payload. Creating a note no longer queues an unrelated full-layout action merely to preserve its append position.
6. If the initial local write fails, creation returns no ID and removes the non-durable optimistic row, so callers cannot navigate to a note that cannot survive reload.

## Why this is the correct fix

The server is not the correct place to deduplicate these mutations. Mutation IDs are idempotency keys for retries of one action; treating different mutation IDs as the same create would risk collapsing legitimate notes with identical content.

The correct boundary is the client transition adapter because it owns both identities:

- It knows the temporary client ID.
- It receives the canonical server ID and version.
- It knows which legacy stores still feed the editor during the migration period.
- It can preserve edits that were queued while the create was in flight by remapping them into updates.

This keeps the local-first guarantee intact: the note is still immediately visible and durable offline, while a successful acknowledgement changes its identity once across all local representations. It also preserves server idempotency rather than adding content-based or timing-based duplicate detection.

## Regression coverage

The unit suite now verifies that an Offline V2 create acknowledgement:

- removes the temporary legacy note record;
- saves the canonical note with the returned server version;
- remaps a later pending editor save instead of losing it;
- keeps that newer editor save dirty until its own acknowledgement;
- remaps the note inside a pending layout;
- carries initial note order on the create action;
- does not queue a full layout as part of ordinary creation;
- does not return a note ID when the initial durable local write fails.
- accepts and normalizes a legacy note response with `position: null`;
- keeps editor memory immediate but does not resolve an update before the
  local repository and pending content queue are durable.

The final full unit suite passes with 131 tests. Nuxt typecheck also passes.
