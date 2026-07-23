# Board Feature

Owns board item UI, board column/item state, and the board API clients.

## Boundaries

- `components/BoardCardSheet.vue` and `components/BoardColumnsSheet.vue` are mobile bottom-sheets for card edit/create and column management; the board page itself (`app/pages/board/index.vue`) owns the tab-pager/overview layout, search, and within-column drag-reorder directly instead of a dedicated view component.
- `composables/useBoardItemsStore.ts` owns optimistic board item state, IndexedDB hydration, pending board item changes, and service worker sync triggers.
- `composables/useBoardColumnsStore.ts` owns board column state; column mutations remain online-only.
- `composables/boardItemMutation.ts` diffs mutable fields to build minimal PATCH payloads.
- `composables/rank.ts` implements LexoRank-style fractional ordering for item positions.
- `composables/useQuickBoardItemCapture.ts` owns the debounced create-then-commit flow backing the live capture sheet.
- `repositories/boardOfflineRepository.ts` is the Offline-V2-backed projection/reconciliation layer, plus a one-time legacy-IndexedDB migration.
- `services/*` owns the `/api/board-items` and `/api/board-columns` clients; `services/boardIntegrationService.ts` owns the `/api/board-integrations` client.

Legacy auto-import entrypoints remain in `app/composables/board` and `app/services`.
Feature internals should import local components and composables explicitly instead of relying on Nuxt auto-import discovery.

## Sync UX

- `board/index.vue` surfaces an inline sync pill (Synced / Local / Retry(n) states) plus board-menu actions for Sync now / Retry failed.
- Board cards keep dirty and failed sync indicators visible in both kanban/list views and the detail panel.
- `composables/useBoardItemsStore.ts` remains the source of truth for pending item changes, retries, temp ID handling, and last-sync timestamps.

## Manual QA

1. Create a board item online, move it to another column via the card sheet's column field, refresh, and confirm placement/order persist.
2. Disable network, change an item's column via the card sheet and reorder an item within a column, refresh, and confirm the board still reflects the pending column/order locally.
3. Re-enable network and confirm pending changes clear after sync.
4. Verify failed item sync states expose retry affordances without losing local content.



## Conflict Policy

- Pending item changes are coalesced by board item ID in IndexedDB.
- Offline-created `temp-*` items are replaced from the server `idMap` after sync, then the temp ID is removed locally.
- Applied sync changes clear dirty/loading/error state and delete matching pending queue entries.
- Server-newer conflicts keep the local item visible, dirty, and retryable.
- Column mutations remain online-only; item sync does not create or repair columns.
