# Board items / Offline V2 incident

> Historical incident record. The transition bridge described below was subsequently retired. See [Notes and Board Offline V2: final flow](./NOTES_BOARD_OFFLINE_V2_FINAL_FLOW.md) for the active V2-only architecture.

## Summary

Board items used two local representations during the Offline V2 transition: the established Board IndexedDB facade used by the UI and the account-scoped Offline V2 entity/outbox stores used for replay. Successful Offline V2 mutations updated only the latter. Temporary IDs, dirty state, column references, and pending legacy edits therefore remained stale in the active Board facade.

The critical bridge regression was introduced by commit `203fe8d4742bd241904930260ef3225569866f12` (`ui:fixes`) on 2026-07-11 at 02:00:28 +03:00. Collision-prone `Date.now()` Board IDs predated that migration and originated in the earlier Board store.

## Root causes

### Missing acknowledgement bridge

Offline V2 returned canonical IDs and snapshots, but only remapped `offlineEntities` and `offlineMutations`. The live item map, legacy `boardItems` record, alias map, pending Board intake row, and Board-column references were not acknowledged.

Consequences included duplicate creates after later edits, stale temporary routes, dirty items that never became clean, and local items that disappeared or flickered during refresh.

### Create/edit race

An edit made while the initial create request was already `syncing` could not coalesce into that create. It entered the outbox as a second create. When the first acknowledgement later remapped the entity ID, the queued operation remained a create and could insert a duplicate server row.

### Stale column identities

Offline-created columns had the same missing ID acknowledgement. A Board item created later from a stale temporary column could reference an ID that no longer existed on the server.

### Incomplete position transport

The legacy Board intake record carried numeric `order` but dropped the fractional `position` key. Migration reconstructed a different position from the numeric value instead of preserving the locally calculated key.

### Weak local durability and identity

Board items and columns used millisecond-based temporary IDs, allowing fast creations to collide. Board creation also used an IndexedDB helper that swallowed write failures, and the delete helper did not wait for transaction completion.

## Fix

1. Offline V2 create acknowledgements now atomically remap Board items across the legacy item record and pending intake row, then notify every live Board store.
2. Board-column acknowledgements remap the column record plus all legacy Board-item and pending-change references to that column.
3. Applied update, move, reorder, and column-update results now acknowledge canonical state back into durable and live stores even when no ID map is returned.
4. Snapshot comparison keeps an item dirty when its local value is newer than the acknowledged mutation, then clears it only when the matching follow-up is acknowledged.
5. Creates queued while an earlier create is in flight are converted to versioned updates when the first ID map arrives. The original mutation ID remains unchanged for receipt-based idempotency.
6. Board items and columns now use the shared UUID-backed temporary-ID generator.
7. Fractional `position` is carried through the legacy Board intake contract, migration adapter, service worker payload, and legacy server sync path.
8. Item and column actions consistently resolve retained temporary IDs through alias maps.
9. Board creation requires the initial IndexedDB write to succeed before returning an ID, and IndexedDB deletion waits for transaction completion.
10. Authenticated Board refresh stops when Offline V2 reports retry, rejection, conflict, or another sync owner; it no longer overwrites unresolved local work with a server fetch.
11. Notes and Board Quick Capture now share one session controller. Reopening waits for the previous create/finalize boundary, stale tasks are generation-checked, and an older create's cleanup cannot clear the current session's promise.

## Why this fix is correct

The transition adapter is the only layer that owns both the temporary client identity and the canonical server identity. Reconciliation belongs there rather than in server-side content deduplication. Two legitimate Board cards can have identical content, so content- or timing-based server deduplication would collapse valid user data.

Receipt idempotency remains authoritative for retrying the same mutation. Later mutations are preserved as updates against the returned server version. This gives each logical create exactly one server insert while retaining every edit made during the request.

The solution also preserves local-first behavior: optimistic cards remain immediately visible, their first durable write is verified, newer edits survive acknowledgements, and both client-driven and no-window service-worker sync converge the legacy facade onto the same canonical identity.

## Regression coverage

The unit suite covers:

- Board-item temp-to-server remapping;
- preservation and remapping of a newer pending edit;
- Board-column remapping through item and pending references;
- applied-update dirty-state acknowledgement;
- preservation of a newer local column edit;
- conversion of a create queued during an in-flight create into a versioned update;
- UUID-scoped Board item and column IDs;
- position transport through the Board sync contract.
- cross-session Quick Capture create/finalize ownership.

The current full unit suite passes with 142 tests.
