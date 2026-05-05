# Notes Feature

Owns workspace notes UI, local-first note state, and the notes API client.

## Boundaries

- `containers/NotesSection.vue` orchestrates the workspace notes panel.
- `components/*` owns note search, text/math/canvas editors, and split-note drop UI.
- `composables/useNotesStore.ts` owns optimistic note state, IndexedDB hydration, pending note changes, and service worker sync triggers.
- `services/noteService.ts` owns the `/api/notes` client.

Legacy auto-import entrypoints remain in `app/components/workspace`, `app/composables/workspaces`, and `app/services`.
Feature internals should import local components and composables explicitly instead of relying on Nuxt auto-import discovery.

## Sync UX

- `containers/NotesSection.vue` surfaces feature-local sync state with a status bar.
- Note rows expose `Local` for queued offline edits and `Retry` for failed sync attempts.
- `composables/useNotesStore.ts` remains the source of truth for pending changes, retries, and last-sync timestamps.

## Manual QA

1. Create and edit a note while online, then refresh. The note should persist.
2. Disable network, edit a note, refresh, and confirm the row shows `Local`.
3. Re-enable network and confirm the status bar returns to synced state.
4. Verify that a failed note update exposes retry affordances in both the status bar and the note editor.
