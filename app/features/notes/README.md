# Notes Feature

Owns workspace notes UI, local-first note state, and the notes API client.

## Boundaries

- `containers/NotesSection.vue` orchestrates the workspace notes panel.
- `components/NotesDrawer.vue`, `NoteGroupSection.vue`, and `NoteRow.vue` own the grouped drawer UI. They emit explicit row intents; they do not write IndexedDB or build note-content sync changes.
- `components/*` owns note search and text/math/canvas editors.
- `composables/notesWorkspaceRuntime.ts` owns the workspace-scoped runtime shared by note and group facades.
- `composables/useNotesStore.ts` is the compatibility facade for note state, commands, sync status, and legacy callers.
- `composables/notesContentQueue.ts` owns debounced content saves, draft flushing, content queue writes, and online/offline scheduling for note edits.
- `composables/notesSyncRuntime.ts` owns hydration, queue draining, conflict recording, server refresh, retry hooks, and sync result application.
- `composables/notesSyncListeners.ts` owns the once-per-app reconnect and service-worker completion listeners.
- `composables/notesLayoutController.ts` owns note layout commands, canonical per-group ordering, layout-only IndexedDB persistence, and the pending layout queue.
- `composables/useNoteGroupsStore.ts` is the compatibility facade for group state, group commands, and locally persisted collapse state.
- `services/noteService.ts` owns the `/api/notes` client.
- `services/noteGroupService.ts` owns the `/api/note-groups` client.

Legacy auto-import entrypoints remain in `app/components/workspace`, `app/composables/workspaces`, and `app/services`.
Feature internals should import local components and composables explicitly instead of relying on Nuxt auto-import discovery.

## Sync UX

- `containers/NotesSection.vue` surfaces content and layout sync state with a status bar.
- Note rows expose `Local` only for queued content edits and `Retry` for failed note saves.
- Layout changes use one workspace-level status such as `layout saved locally`, `layout syncing`, or `layout conflict`; reorder/move must not mark every note row as `Local`.
- The workspace runtime is the source of truth for group state and the note/group sync bridge; `notesSyncRuntime.ts` is the only note-side queue drainer.
- `useNotesStore.ts` remains the public source for note sync status and last-sync timestamps, but it delegates sync/hydration/refresh behavior, reconnect listeners, and content queueing to runtime helpers.
- There is one queue drainer: `notesStore.syncPendingChanges()`. Group UI may enqueue group work and refresh group data, but it must not call `/api/notes/sync` directly.
- Content edit saves are debounced per note and flushed together on blur, reconnect, manual sync, or unmount; one split-pane edit must not replace another pane's pending save.
- Initial load hydrates IndexedDB notes and groups first so the drawer/editor can render immediately; server refresh and pending sync run in the background when the network is verified online.
- Groups are local-first in v1 for create/rename/delete/reorder. Group commands are queued locally, then drained by the notes sync engine.
- Deleting a group moves notes back to the virtual `Ungrouped` section (`groupId: null`).
- Version conflicts use an explicit v1 policy: retry keeps the local edit and overwrites the newer server note. The server returns `VERSION_MISMATCH` with `RETRY_LOCAL_WINS`; the client updates the pending queue to the latest server version before retrying.
- Layout changes are applied atomically on the server. A failed reorder/move should remain pending locally rather than partially persisting.

## Interaction Invariants

- `NoteRow.vue` is a visual row with four independent zones: `drag`, `title`, `split`, and `actions`.
- The row wrapper has no click handler. Opening a note is owned only by the title/link zone.
- The drag zone uses `data-note-drag-handle` and emits reorder/move intent only.
- The split zone uses `data-no-drag`; click opens/replaces split panes, while drag starts the split-drop flow.
- The actions zone uses `data-no-drag` and emits action intent only.
- Split state is local UI state persisted by `useSplitNotes`; it is not note content and is not synced to the server.
- Menu button opens actions only.
- UI watchers may hydrate drag lists from props, but they must not queue layout changes.
- Manual sync, reconnect sync, and background sync follow the same order: flush editor drafts, drain content changes, remap temp IDs, drain layout changes, then refresh notes and groups.

## Manual QA

1. Create and edit a note while online, then refresh. The note should persist.
2. Disable network, edit a note, refresh, and confirm the row shows `Local`.
3. Re-enable network and confirm the status bar returns to synced state.
4. Verify that a failed note update exposes retry affordances in both the status bar and the note editor.
5. Create, rename, collapse, reorder, and delete groups while online.
6. Move notes within and across groups and confirm only the sync bar shows layout pending.
7. Create a note offline, move it into a group, reconnect, and confirm the temp ID is remapped before the layout applies.
