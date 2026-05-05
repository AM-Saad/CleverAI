# Board Feature

Owns board item UI, board column/item state, and the board API clients.

## Boundaries

- `containers/BoardNotesSection.vue` orchestrates the workspace board panel.
- `components/*` owns kanban/list views, columns, cards, filters, and item detail editing surfaces.
- `composables/useBoardItemsStore.ts` owns optimistic board item state, IndexedDB hydration, pending board item changes, and service worker sync triggers.
- `composables/useBoardColumnsStore.ts` owns board column state; column mutations remain online-only.
- `services/*` owns the `/api/board-items` and `/api/board-columns` clients.

Legacy auto-import entrypoints remain in `app/components/board`, `app/composables/board`, and `app/services`.
Feature internals should import local components and composables explicitly instead of relying on Nuxt auto-import discovery.

## Sync UX

- `containers/BoardNotesSection.vue` surfaces board sync state with a feature-local status bar.
- Board cards keep dirty and failed sync indicators visible in both kanban/list views and the detail panel.
- `composables/useBoardItemsStore.ts` remains the source of truth for pending item changes, retries, temp ID handling, and last-sync timestamps.

## Manual QA

1. Create a board item online, move it between columns, refresh, and confirm placement/order persist.
2. Disable network, move or edit an item, refresh, and confirm the board still reflects the pending column/order locally.
3. Re-enable network and confirm pending changes clear after sync.
4. Verify failed item sync states expose retry affordances without losing local content.



###TODO
## Conflict Policy

- Item edits are last-write-wins unless the server entity was deleted.
- Failed sync keeps the local item visible with retry affordance.
- If the target column no longer exists, move the item to the default/backlog column and surface a warning.