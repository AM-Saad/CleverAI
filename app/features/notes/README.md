# Notes Feature

Owns workspace notes UI, local-first note state, and the notes API client.

## Boundaries

- `components/NoteListRow.vue` is the single-click list row rendered by `notes/index.vue` (title, snippet, sync badge, card-count/note-type pills, relative time — no drag/split affordances). `components/NoteGroupsSheet.vue` and `QuickNoteSheet.vue` (+ `useQuickNoteCapture.ts`) drive the mobile list page. `components/MobileNoteEditor.vue` and `AiResultSheet.vue` (+ `useNoteDraft.ts`) drive the mobile detail page (`notes/[id].vue`).
- `components/*` also owns note search and text/math/canvas editors.
- `app/composables/ui/useSplitNotes.ts` is currently unused — the composable still exists and is re-exported from `app/composables/ui/index.ts`'s barrel, but nothing references it now that the split-pane row UI it backed is gone.
- `composables/notesWorkspaceRuntime.ts` owns the workspace-scoped runtime shared by note and group facades.
- `composables/useNotesStore.ts` is the compatibility facade for note state, commands, sync status, and legacy callers.
- `composables/notesContentQueue.ts` owns debounced content saves, draft flushing, content queue writes, and online/offline scheduling for note edits.
- `composables/notesSyncRuntime.ts` owns hydration, queue draining, conflict recording, server refresh, retry hooks, and sync result application.
- `composables/notesSyncListeners.ts` owns the once-per-app reconnect listener.
- `composables/notesLayoutController.ts` owns note layout commands, canonical per-group ordering, layout-only IndexedDB persistence, and the pending layout queue.
- `composables/useNoteGroupsStore.ts` is the compatibility facade for group state, group commands, and locally persisted collapse state.
- `services/noteService.ts` owns the `/api/notes` client.
- `services/noteGroupService.ts` owns the `/api/note-groups` client.

Legacy auto-import entrypoints remain in `app/components/workspace`, `app/composables/workspaces`, and `app/services`.
Feature internals should import local components and composables explicitly instead of relying on Nuxt auto-import discovery.

## Sync UX

- Note rows expose `Local` only for queued content edits and `Retry` for failed note saves.
- Layout changes use one workspace-level status such as `layout saved locally`, `layout syncing`, or `layout conflict`; reorder/move must not mark every note row as `Local`.
- The workspace runtime is the source of truth for group state and the note/group sync bridge; `notesSyncRuntime.ts` is the only note-side queue drainer.
- `useNotesStore.ts` remains the public source for note sync status and last-sync timestamps, but it delegates sync/hydration/refresh behavior, reconnect listeners, and content queueing to runtime helpers.
- There is one Notes queue drainer: `notesSyncRuntime.ts`. Notes, groups, and layout use the feature-owned IndexedDB outboxes; the page runtime or no-window service worker calls `POST /api/notes/sync`. The generic Offline V2 runtime explicitly excludes Notes entities so it cannot become a second owner.
- Content edit saves are debounced per note with a maximum wait, then flushed together on blur, verified reconnect, manual sync, or unmount; continuous typing cannot postpone local durability forever, and one split-pane edit must not replace another pane's pending save.
- Initial load hydrates IndexedDB notes and groups first so the drawer/editor can render immediately; server refresh and pending sync run in the background when the network is verified online.
- Groups are local-first for create/rename/delete/reorder. Group commands are queued locally, then drained by the same Notes sync engine.
- Deleting a group moves notes back to the virtual `Ungrouped` section (`groupId: null`).
- Version conflicts use explicit resolution. The server returns `VERSION_MISMATCH` with a server snapshot; the client stores local/server snapshots in IndexedDB, freezes normal editing for that note, and lets the user keep local, use server, or unlock the local draft as a manual merge against the latest server version.
- A retry whose supplied note state already matches the server is an acknowledgement replay, not a conflict. Both the endpoint and conflict hydrator collapse this converged state without incrementing the version again.
- When `NUXT_PUBLIC_NOTES_COLLAB_ENABLED=true`, existing non-temp `TEXT` note bodies use Yjs/Tiptap collaboration over the self-hosted Hocuspocus server. `note.content` and `note.title` become debounced read/search projections, while the Yjs document is authoritative for rich-text body edits.
- Collaborative body edits are not written to `pendingNotes`; IndexedDB-backed Yjs state and the Hocuspocus websocket own body sync. `pendingNotes`, group queues, layout queues, and explicit conflicts still own metadata, deletes, non-text notes, groups, and layout.
- Layout changes are applied atomically on the server. A failed reorder/move should remain pending locally rather than partially persisting.

## Manual QA

1. Create and edit a note while online, then refresh. The note should persist.
2. Disable network, edit a note, refresh, and confirm the row shows `Local`.
3. Re-enable network and confirm the status bar returns to synced state.
4. Verify that a failed note update exposes retry affordances in both the status bar and the note editor.
5. Create, rename, collapse, reorder, and delete groups while online.
6. Move notes within and across groups and confirm only the sync bar shows layout pending.
7. Create a note offline, move it into a group, reconnect, and confirm the temp ID is remapped before the layout applies.
8. With notes collaboration enabled and `yarn collab:dev` running, open the same text note in two clients, edit the body in both, and confirm the body merges while `pendingNotes` remains empty.
