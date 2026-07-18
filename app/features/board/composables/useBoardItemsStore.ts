import type { BoardItem, BoardItemLink, BoardItemComment, Attachment } from "~/shared/utils/boardItem.contract";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { rankBetween, needsRebalance, rebalancedRanks, RANK_GAP } from "./rank";
import { comparePosition, positionBetween } from "@@/shared/utils/position-key";
import { createClientTempId } from "~/utils/local-first/tempIds";
import { createKeyedAsyncDebounce } from "~/utils/keyedAsyncDebounce";
import {
  BOARD_ITEM_MUTABLE_FIELDS,
  boardItemPayloadForFields,
  changedBoardItemFields,
  comparableBoardItemValue,
  type BoardItemMutableField,
} from "./boardItemMutation";
import {
  boardItemDurableData,
  loadBoardItemsProjection,
  putBoardProjectionRecord,
  putBoardProjectionRecords,
  reconcileBoardRelationsForItem,
  reconcileBoardWorkspaceProjection,
} from "../repositories/boardOfflineRepository";

export interface BoardItemState extends BoardItem {
  // Local state tracking
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
  isInFilteredList?: boolean;
  // Lazily loaded relational data
  links?: { sent: BoardItemLink[]; received: BoardItemLink[] };
  linksLoading?: boolean;
  comments?: BoardItemComment[];
  commentsLoading?: boolean;
}

interface BoardItemsStore {
  items: Ref<Map<string, BoardItemState>>;
  loadingStates: Ref<Map<string, boolean>>;
  lastSync: Ref<Date | null>;
  isPositionMutationPending: Ref<boolean>;
  filteredItemIds: Ref<Set<string> | null>;
  createItem: (content: string, tags?: string[], columnId?: string | null, dueDate?: string | null, attachments?: Attachment[]) => Promise<string | null>;
  updateItem: (id: string, updatedItem: BoardItemState) => Promise<boolean>;
  /** Force one item's debounced edit into the durable V2 outbox. */
  flushItem: (id: string) => Promise<void>;
  loadItemLinks: (id: string) => Promise<void>;
  loadItemComments: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<boolean>;
  moveItemToColumn: (itemId: string, columnId: string | null, newOrder?: number) => Promise<boolean>;
  reorderItemsInColumn: (columnId: string | null, orderedItems: BoardItemState[]) => Promise<boolean>;
  getItemsByColumn: (columnId: string | null) => BoardItemState[];
  syncWithServer: () => Promise<void>;
  retryFailedItem: (id: string) => Promise<boolean>;
  clearItemError: (id: string) => void;
  isItemLoading: (id: string) => boolean;
  isItemDirty: (id: string) => boolean;
  isItemInFilter: (id: string) => boolean;
  getItem: (id: string) => BoardItemState | null;
  /** Temp→server id resolution for optimistic items (mirrors notes' resolveNoteId). */
  resolveItemId: (id: string | null) => string | null;
  setItems?: (items: BoardItemState[]) => void;
  persistAndQueueItems?: (items: BoardItemState[]) => Promise<void>;
  setFilteredItemIds: (ids: Set<string> | null) => void;
  resetOfflineToast?: () => void;
}

type BoardItemsStoreInternal = BoardItemsStore & {
  _flushDebounce?: () => Promise<void>;
  _syncPendingChanges?: () => Promise<boolean>;
  _applyOfflineItemIdMap?: (idMap: Record<string, string>, syncedPayload?: Record<string, unknown>, version?: number, forceDirty?: boolean) => Promise<void>;
  _applyOfflineItemAck?: (itemId: string, syncedPayload: Record<string, unknown>, canonical?: Record<string, unknown> | null, version?: number, forceDirty?: boolean) => Promise<void>;
  _applyOfflineColumnIdMap?: (idMap: Record<string, string>) => Promise<void>;
  _cancelDebounces?: () => void;
  _applyOfflineItemFailure?: (itemId: string, status: "conflict" | "rejected", message?: string, operation?: string, rollbackData?: Record<string, unknown> | null) => Promise<void>;
  _applyOfflineConflictResolution?: (itemId: string, strategy: "keep-local" | "keep-server", serverVersion: number, serverSnapshot?: Record<string, unknown> | null) => Promise<void>;
};

const BOARD_ITEMS_STORE_FALLBACK_KEY = "__default__";
const boardItemsStores = new Map<string, BoardItemsStoreInternal>();

// Ensure we only wire one 'online' listener
let onlineListenerRegistered = false;


/**
 * Creates or returns the board items store for the current user
 * This provides local state management with optimistic updates
 */
export function useBoardItemsStore(workspaceId?: string): BoardItemsStore {
  const storeKey = workspaceId ?? BOARD_ITEMS_STORE_FALLBACK_KEY;
  const existingStore = boardItemsStores.get(storeKey);
  if (existingStore) {
    return existingStore;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const networkMonitor = useNetworkStatus();
  const offline = useOfflineRuntime();
  const requireAccountId = () => {
    const accountId = offline.accountId.value;
    if (!accountId) throw new Error("Board projection requires an authenticated account");
    return accountId;
  };
  const saveBoardItemToIndexedDBStrict = async (item: BoardItemState) => {
    await putBoardProjectionRecord({
      accountId: requireAccountId(),
      entity: "boardItem",
      record: item as unknown as Record<string, unknown> & { id: string },
    });
  };
  const saveBoardItemToIndexedDB = async (item: BoardItemState) => {
    try {
      await saveBoardItemToIndexedDBStrict(item);
    } catch (error) {
      console.error("Failed to save Board item projection:", error);
    }
  };
  const saveBoardItemsToIndexedDB = async (records: BoardItemState[]) => {
    if (!records.length) return;
    await putBoardProjectionRecords({
      accountId: requireAccountId(),
      entity: "boardItem",
      records: records as unknown as Array<Record<string, unknown> & { id: string }>,
    });
  };

  // V2 owns reconnect/background sync. Feature timers only need to flush their
  // latest local state into that outbox before suspension or reconnect.
  if (import.meta.client && !onlineListenerRegistered) {
    const flush = () => {
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._flushDebounce?.(),
      ));
    };
    window.addEventListener("online", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    window.addEventListener("offline-v2-board-item-id-remapped", (event) => {
      const detail = (event as CustomEvent<{ idMap?: Record<string, string>; syncedPayload?: Record<string, unknown>; version?: number; forceDirty?: boolean }>).detail;
      if (!detail?.idMap) return;
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._applyOfflineItemIdMap?.(detail.idMap!, detail.syncedPayload, detail.version, detail.forceDirty),
      ));
    });
    window.addEventListener("offline-v2-board-column-id-remapped", (event) => {
      const detail = (event as CustomEvent<{ idMap?: Record<string, string> }>).detail;
      if (!detail?.idMap) return;
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._applyOfflineColumnIdMap?.(detail.idMap!),
      ));
    });
    window.addEventListener("offline-v2-board-item-applied", (event) => {
      const detail = (event as CustomEvent<{ itemId?: string; syncedPayload?: Record<string, unknown>; canonical?: Record<string, unknown> | null; version?: number; forceDirty?: boolean }>).detail;
      if (!detail?.itemId || !detail.syncedPayload) return;
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._applyOfflineItemAck?.(detail.itemId!, detail.syncedPayload!, detail.canonical, detail.version, detail.forceDirty),
      ));
    });
    window.addEventListener("offline-v2-sync-result", (event) => {
      const detail = (event as CustomEvent<{ entity?: string; entityId?: string; status?: string; message?: string; operation?: string; rollbackData?: Record<string, unknown> | null }>).detail;
      if (detail?.entity !== "boardItem" || !detail.entityId || (detail.status !== "conflict" && detail.status !== "rejected")) return;
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._applyOfflineItemFailure?.(detail.entityId!, detail.status as "conflict" | "rejected", detail.message, detail.operation, detail.rollbackData),
      ));
    });
    window.addEventListener("offline-v2-board-conflict-resolved", (event) => {
      const detail = (event as CustomEvent<{ entity?: string; entityId?: string; strategy?: "keep-local" | "keep-server"; serverVersion?: number; serverSnapshot?: Record<string, unknown> | null }>).detail;
      if (detail?.entity !== "boardItem" || !detail.entityId || !detail.strategy) return;
      void Promise.all(Array.from(boardItemsStores.values()).map((store) =>
        store._applyOfflineConflictResolution?.(
          detail.entityId!,
          detail.strategy!,
          detail.serverVersion ?? 0,
          detail.serverSnapshot,
        ),
      ));
    });

    onlineListenerRegistered = true;
  }

  // (Removed offline toast deduplication state)

  // Local reactive state
  const items = ref<Map<string, BoardItemState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);
  const pendingUpdateSnapshots = new Map<string, BoardItemState>();

  // Temp→server id aliases (mirrors notes' noteIdAliases): an optimistic
  // item's temp id is swapped for the server id on reconcile; surfaces that
  // captured the temp id (quick capture, /board/[id]) resolve through this.
  const itemIdAliases = ref<Map<string, string>>(new Map());
  const resolveItemId = (id: string | null): string | null => {
    if (!id) return null;
    return itemIdAliases.value.get(id) ?? id;
  };
  const recordItemAlias = (tempId: string, serverId: string) => {
    const next = new Map(itemIdAliases.value);
    next.set(tempId, serverId);
    itemIdAliases.value = next;
  };
  const isUnreconciledTempId = (id: string) =>
    /^(temp-|local:)/.test(id) && !itemIdAliases.value.has(id);

  const itemMatchesSyncedPayload = (
    item: BoardItemState,
    payload?: Record<string, unknown>,
  ): boolean => {
    if (!payload) return false;
    const values = item as unknown as Record<string, unknown>;
    const normalizeDate = (value: unknown) => value
      ? new Date(value as string | number | Date).toISOString()
      : null;
    const comparable: Record<string, (left: unknown, right: unknown) => boolean> = {
      content: (left, right) => left === right,
      workspaceId: (left, right) => (left ?? null) === (right ?? null),
      columnId: (left, right) => (left ?? null) === (right ?? null),
      order: (left, right) => left === right,
      position: (left, right) => left === right,
      dueDate: (left, right) => normalizeDate(left) === normalizeDate(right),
      tags: (left, right) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []),
      attachments: (left, right) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []),
    };
    return Object.entries(comparable).every(([field, compare]) =>
      !(field in payload) || compare(values[field], payload[field]),
    );
  };

  const applyOfflineItemIdMap = async (
    idMap: Record<string, string>,
    syncedPayload?: Record<string, unknown>,
    version?: number,
    forceDirty = false,
  ): Promise<void> => {
    for (const [tempId, serverId] of Object.entries(idMap)) {
      recordItemAlias(tempId, serverId);
      const tempItem = items.value.get(tempId);
      if (!tempItem) continue;
      const serverItem: BoardItemState = {
        ...tempItem,
        id: serverId,
        ...(version !== undefined && { offlineRevision: version }),
        isDirty: forceDirty || !itemMatchesSyncedPayload(tempItem, syncedPayload),
        isLoading: false,
        lastSaved: new Date(),
        error: null,
      };
      items.value.delete(tempId);
      items.value.set(serverId, serverItem);
      const snapshot = pendingUpdateSnapshots.get(tempId);
      if (snapshot) {
        pendingUpdateSnapshots.delete(tempId);
        pendingUpdateSnapshots.set(serverId, { ...snapshot, id: serverId });
      }
    }
  };

  const applyOfflineColumnIdMap = async (idMap: Record<string, string>): Promise<void> => {
    const changed: BoardItemState[] = [];
    for (const [id, item] of items.value) {
      if (!item.columnId || !idMap[item.columnId]) continue;
      const next = { ...item, columnId: idMap[item.columnId] };
      items.value.set(id, next);
      changed.push(next);
    }
  };

  const applyOfflineItemAck = async (
    itemId: string,
    syncedPayload: Record<string, unknown>,
    canonical?: Record<string, unknown> | null,
    version?: number,
    forceDirty = false,
  ): Promise<void> => {
    const item = items.value.get(itemId);
    if (!item) return;
    const matches = itemMatchesSyncedPayload(item, syncedPayload);
    const next: BoardItemState = {
      ...item,
      ...(matches && !forceDirty && canonical ? canonical : {}),
      id: itemId,
      ...(version !== undefined && { offlineRevision: version }),
      isDirty: forceDirty || !matches,
      isLoading: false,
      lastSaved: new Date(),
      error: null,
    } as BoardItemState;
    items.value.set(itemId, next);
  };
  const applyOfflineItemFailure = async (
    itemId: string,
    status: "conflict" | "rejected",
    message?: string,
    operation?: string,
    rollbackData?: Record<string, unknown> | null,
  ): Promise<void> => {
    const resolvedId = resolveItemId(itemId) ?? itemId;
    const item = items.value.get(resolvedId);
    if (status === "rejected") {
      if (rollbackData) {
        const restored = {
          ...rollbackData,
          id: resolvedId,
          isDirty: false,
          isLoading: false,
          error: null,
        } as BoardItemState;
        items.value.set(resolvedId, restored);
      } else if (operation?.endsWith(".create")) {
        items.value.delete(resolvedId);
      }
      toast.add({
        title: "Board change rejected",
        description: message ?? "The previous saved version was restored.",
        color: "error",
      });
      return;
    }
    if (!item) return;
    const next: BoardItemState = {
      ...item,
      isDirty: true,
      isLoading: false,
      error: status === "conflict"
        ? "Sync conflict detected. Resolve the local and server versions in Sync Center."
        : (message ?? "The server rejected this saved local change."),
    };
    items.value.set(resolvedId, next);
  };
  const applyOfflineConflictResolution = async (
    itemId: string,
    strategy: "keep-local" | "keep-server",
    serverVersion: number,
    serverSnapshot?: Record<string, unknown> | null,
  ) => {
    const resolvedId = resolveItemId(itemId) ?? itemId;
    if (strategy === "keep-server") {
      if (!serverSnapshot) {
        items.value.delete(resolvedId);
        return;
      }
      items.value.set(resolvedId, {
        ...serverSnapshot,
        id: resolvedId,
        offlineRevision: serverVersion,
        isDirty: false,
        isLoading: false,
        error: null,
        lastSaved: new Date(),
      } as BoardItemState);
      return;
    }
    const current = items.value.get(resolvedId);
    if (current)
      items.value.set(resolvedId, {
        ...current,
        offlineRevision: serverVersion,
        isDirty: true,
        isLoading: false,
        error: null,
      });
  };
  const isPositionMutationPending = ref(false);
  const filteredItemIds = ref<Set<string> | null>(null);
  let pendingPositionMutationCount = 0;

  const beginPositionMutation = () => {
    pendingPositionMutationCount += 1;
    isPositionMutationPending.value = true;
  };

  const endPositionMutation = () => {
    pendingPositionMutationCount = Math.max(0, pendingPositionMutationCount - 1);
    isPositionMutationPending.value = pendingPositionMutationCount > 0;
  };

  const queueBoardItemsForSync = async (
    boardItems: BoardItemState[],
    options?: {
      changedFields?: readonly BoardItemMutableField[];
      rollbackById?: Map<string, BoardItemState>;
    },
  ): Promise<void> => {
    const queuedAt = new Date();

    for (const item of boardItems) {
      const current = items.value.get(item.id) ?? item;
      const nextItem: BoardItemState = {
        ...current,
        workspaceId: current.workspaceId ?? workspaceId,
        isLoading: false,
        isDirty: true,
        updatedAt: current.updatedAt ?? queuedAt,
        error: null,
      };
      items.value.set(item.id, nextItem);
      const creating = isUnreconciledTempId(nextItem.id);
      const changedFields = creating
        ? [...BOARD_ITEM_MUTABLE_FIELDS]
        : [...(options?.changedFields ?? BOARD_ITEM_MUTABLE_FIELDS)];
      if (!changedFields.length) continue;
      const rollback = options?.rollbackById?.get(nextItem.id);
      await offline.queue({
        entity: "boardItem",
        operation: creating ? "boardItem.create" : "boardItem.update",
        entityId: nextItem.id,
        workspaceId: nextItem.workspaceId ?? workspaceId,
        baseVersion: nextItem.offlineRevision ?? rollback?.offlineRevision ?? 0,
        changedFields,
        payload: boardItemPayloadForFields(nextItem, changedFields),
        localData: boardItemDurableData(
          nextItem as unknown as Record<string, unknown> & { id: string },
        ),
        rollbackData: rollback as unknown as Record<string, unknown> | undefined,
        deferSync: true,
      });
    }
    if (networkMonitor.isVerifiedOnline.value) void offline.sync();
  };

  // Multi-entity commands (currently deleting an unsynced local column) use
  // this to make the projected card state and its V2 commands durable before
  // reporting success. It intentionally bypasses the UI edit debounce.
  const persistAndQueueItems = async (boardItems: BoardItemState[]): Promise<void> => {
    await Promise.all(boardItems.map((item) => saveBoardItemToIndexedDBStrict(item)));
    await queueBoardItemsForSync(boardItems, {
      changedFields: ["columnId", "order", "position"],
    });
  };

  // Sync board item changes to server
  const updateItemToServer = async (
    rawId: string
  ): Promise<boolean> => {
    const id = itemIdAliases.value.get(rawId) ?? rawId;
    const item = items.value.get(id);
    if (!item) return false;
    try {
      item.isLoading = true;
      item.error = null;
      const rollback = pendingUpdateSnapshots.get(id);
      const changedFields = rollback
        ? changedBoardItemFields(rollback, item)
        : [...BOARD_ITEM_MUTABLE_FIELDS];
      if (!isUnreconciledTempId(id) && changedFields.length === 0) {
        pendingUpdateSnapshots.delete(id);
        const unchanged = {
          ...item,
          isLoading: false,
          isDirty: rollback?.isDirty ?? false,
        };
        items.value.set(id, unchanged);
        await saveBoardItemToIndexedDBStrict(unchanged);
        return true;
      }
      await queueBoardItemsForSync([item], {
        changedFields,
        rollbackById: rollback ? new Map([[id, rollback]]) : undefined,
      });
      pendingUpdateSnapshots.delete(id);
      const current = items.value.get(id);
      if (current) items.value.set(id, { ...current, isLoading: false, isDirty: true });
      return true;
    } catch (error) {
      const current = items.value.get(id);
      if (current) items.value.set(id, { ...current, isLoading: false, error: "Failed to save item locally" });
      console.error("Failed to queue Board item update", error);
      return false;
    }
  };

  // Store-owned and keyed: editing item B cannot cancel item A, and an edit
  // made during A's request schedules one latest-state follow-up.
  const itemSaveDebounce = createKeyedAsyncDebounce(
    async (id: string) => { await updateItemToServer(id); },
    1000,
  );

  const saveToServer = async (id: string) => {
    itemSaveDebounce.schedule(id);
  };

  const flushItem = async (rawId: string): Promise<void> => {
    const id = resolveItemId(rawId) ?? rawId;
    await itemSaveDebounce.flush(id);
  };

  // Expose flush so reconnect can durably drain every dirty item.
  const _flushDebounce = async () => {
    const dirtyIds = Array.from(items.value.values())
      .filter((item) => item.isDirty)
      .map((item) => item.id);
    await itemSaveDebounce.flushAll(dirtyIds);
  };

  const syncPendingChanges = async (): Promise<boolean> => {
    await _flushDebounce();
    if (!offline.accountId.value || !networkMonitor.isVerifiedOnline.value) return false;
    const synced = await offline.sync();
    if (synced) lastSync.value = new Date();
    return synced;
  };

  // Update board item content - local-first approach
  const updateItem = async (
    id: string,
    updatedItem: BoardItemState
  ): Promise<boolean> => {
    // A caller may still hold a temp id after the create reconciled — write
    // through to the real id so the temp entry isn't resurrected.
    const realId = itemIdAliases.value.get(id) ?? id;
    const previousItem = items.value.get(realId);
    if (previousItem && !pendingUpdateSnapshots.has(realId))
      pendingUpdateSnapshots.set(realId, { ...previousItem });
    updatedItem = { ...updatedItem, id: realId };
    updatedItem.updatedAt = new Date();
    updatedItem.isDirty = true;
    items.value.set(realId, updatedItem);

    try {
      await saveBoardItemToIndexedDBStrict(updatedItem);
      // One keyed debounce feeds the V2 outbox online and offline.
      await saveToServer(realId);
      return true;
    } catch (error) {
      if (previousItem) items.value.set(realId, previousItem);
      else items.value.delete(realId);
      pendingUpdateSnapshots.delete(realId);
      console.error("Failed to persist Board item update", error);
      return false;
    }
  };

  // Create a new board item
  const createItem = async (
    content: string,
    tags: string[] = [],
    columnId: string | null = null,
    dueDate: string | null = null,
    attachments: Attachment[] = []
  ): Promise<string | null> => {
    const tempId = createClientTempId("board-item");

    // Append rank: one gap past the column's current max (ranks are per-column
    // and needn't be contiguous).
    const columnMaxRank = Array.from(items.value.values())
      .filter((i) => (i.columnId ?? null) === (columnId ?? null))
      .reduce((max, i) => Math.max(max, i.order ?? 0), 0);
    const lastPosition = Array.from(items.value.values())
      .filter((i) => (i.columnId ?? null) === (columnId ?? null))
      .sort((left, right) => (left.position ?? "").localeCompare(right.position ?? ""))
      .at(-1)?.position;

    const optimisticItem: BoardItemState = {
      id: tempId,
      userId: "", // Will be set by server
      columnId,
      content,
      tags,
      order: columnMaxRank + RANK_GAP,
      position: positionBetween(lastPosition, null),
      workspaceId: workspaceId,
      dueDate,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: false,
      isDirty: true,
      error: null,
    };

    items.value.set(tempId, optimisticItem);
    try {
      await offline.queue({
        entity: "boardItem",
        operation: "boardItem.create",
        entityId: tempId,
        workspaceId,
        changedFields: [...BOARD_ITEM_MUTABLE_FIELDS],
        payload: boardItemPayloadForFields(optimisticItem, BOARD_ITEM_MUTABLE_FIELDS),
        localData: boardItemDurableData(
          optimisticItem as unknown as Record<string, unknown> & { id: string },
        ),
      });
    } catch (error) {
      items.value.delete(tempId);
      console.error("Failed to queue board item creation:", error);
      return null;
    }

    return tempId;
  };

  // Delete board item
  const deleteItem = async (rawId: string): Promise<boolean> => {
    const id = itemIdAliases.value.get(rawId) ?? rawId;
    const originalItem = items.value.get(id);
    if (!originalItem) return false;

    // Optimistic delete. V2 retains originalItem as the rejection snapshot.
    itemSaveDebounce.cancel(id);
    pendingUpdateSnapshots.delete(id);
    items.value.delete(id);
    try {
      await offline.queue({
        entity: "boardItem",
        operation: "boardItem.delete",
        entityId: id,
        workspaceId: originalItem.workspaceId ?? workspaceId,
        baseVersion: originalItem.offlineRevision ?? 0,
        changedFields: ["deleted"],
        payload: {},
        rollbackData: originalItem as unknown as Record<string, unknown>,
      });
      return true;
    } catch (error) {
      items.value.set(id, originalItem);
      console.error("Failed to queue Board item delete", error);
      return false;
    }
  };

  const boardItemProjectionKey = (item: BoardItemState) =>
    JSON.stringify(
      Object.fromEntries(
        BOARD_ITEM_MUTABLE_FIELDS.map((field) => [
          field,
          comparableBoardItemValue(field, item[field]),
        ]),
      ),
    );
  let syncWithServerPromise: Promise<void> | null = null;

  // Load Board items IDB-first, then replace the clean projection with one
  // authoritative server snapshot while preserving mutations and request races.
  const syncWithServer = (): Promise<void> => {
    if (syncWithServerPromise) return syncWithServerPromise;
    const run = (async () => {
      loadingStates.value.set("global", true);
      try {
        await hydrateFromIDB();
        if (!networkMonitor.isVerifiedOnline.value) return;
        // A sibling Board store may already own the V2 drain. The projection
        // transaction below overlays pending/syncing/retry rows, so a GET is
        // still safe even when this caller did not own that sync request.
        await syncPendingChanges();
        await hydrateFromIDB();

        const requestSnapshot = new Map(
          Array.from(items.value, ([id, item]) => [id, { ...item }]),
        );
        const result = await $api.boardItems.getAll(workspaceId);
        if (!result.success || !offline.accountId.value) return;

        const atResponse = new Map(
          Array.from(items.value, ([id, item]) => [id, { ...item }]),
        );
        const volatileItems = Array.from(atResponse.values()).filter((item) => {
          const before = requestSnapshot.get(item.id);
          return !before || boardItemProjectionKey(before) !== boardItemProjectionKey(item);
        });
        const volatileDeletedIds = Array.from(requestSnapshot.keys()).filter(
          (id) => !atResponse.has(id),
        );
        const serverItems: BoardItemState[] = result.data.map((item: BoardItem) => ({
          ...item,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        }));
        const projection = await reconcileBoardWorkspaceProjection({
          accountId: offline.accountId.value,
          workspaceId,
          entity: "boardItem",
          serverRecords: serverItems,
          volatileRecords: volatileItems,
          volatileDeletedIds,
        });

        // An edit can start while the IDB transaction is being committed. Apply
        // that last memory delta after the authoritative projection returns.
        const afterPersistence = new Map(items.value);
        const final = new Map(projection.map((item) => {
          const ephemeral = atResponse.get(item.id);
          return [item.id, {
            ...item,
            ...(ephemeral?.links && { links: ephemeral.links }),
            ...(ephemeral?.comments && { comments: ephemeral.comments }),
            linksLoading: ephemeral?.linksLoading ?? false,
            commentsLoading: ephemeral?.commentsLoading ?? false,
          } as BoardItemState];
        }));
        for (const [id, item] of afterPersistence) {
          const before = atResponse.get(id);
          if (!before || boardItemProjectionKey(before) !== boardItemProjectionKey(item))
            final.set(id, item);
        }
        for (const id of atResponse.keys()) {
          if (!afterPersistence.has(id)) final.delete(id);
        }
        items.value = final;
        lastSync.value = new Date();
      } catch {
        // IDB state remains visible on network or reconciliation failure.
      } finally {
        loadingStates.value.set("global", false);
      }
    })();
    syncWithServerPromise = run.finally(() => {
      syncWithServerPromise = null;
    });
    return syncWithServerPromise;
  };

  // Offline V2 entities are the only durable Board projection.
  const hydrateFromIDB = async (): Promise<void> => {
    if (!offline.accountId.value) return;
    const localItems = await loadBoardItemsProjection({
      accountId: offline.accountId.value,
      workspaceId,
    });
    const previous = new Map(items.value);
    items.value.clear();
    localItems.forEach((item) => {
      const ephemeral = previous.get(item.id);
      items.value.set(item.id, {
        ...item,
        ...(ephemeral?.links && { links: ephemeral.links }),
        ...(ephemeral?.comments && { comments: ephemeral.comments }),
        linksLoading: ephemeral?.linksLoading ?? false,
        commentsLoading: ephemeral?.commentsLoading ?? false,
      });
    });
  };

  // Thin wrapper kept for backward compatibility.
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      await hydrateFromIDB();
    } catch {
      // Silently fail — navbar pill already shows offline status.
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  const isItemLoading = (id: string): boolean => {
    return items.value.get(resolveItemId(id) ?? id)?.isLoading ?? false;
  };

  const isItemDirty = (id: string): boolean => {
    return items.value.get(resolveItemId(id) ?? id)?.isDirty ?? false;
  };

  const retryFailedItem = async (id: string): Promise<boolean> => {
    id = resolveItemId(id) ?? id;
    const item = items.value.get(id);
    if (!item || !item.error) return false;

    item.error = null;
    item.isLoading = true;
    items.value.set(id, item);

    return await updateItemToServer(id);
  };

  const clearItemError = (id: string) => {
    id = resolveItemId(id) ?? id;
    const item = items.value.get(id);
    if (item) {
      item.error = null;
      items.value.set(id, item);
    }
  };

  const isItemInFilter = (id: string): boolean => {
    if (!filteredItemIds.value) return true;
    return filteredItemIds.value.has(resolveItemId(id) ?? id);
  };

  const getItem = (id: string): BoardItemState | null => {
    return items.value.get(resolveItemId(id) ?? id) || null;
  };

  const setItems = (newItems: BoardItemState[]) => {
    items.value.clear();
    newItems.forEach((item) => items.value.set(item.id, item));
  };

  // Load links for a specific item on demand (used by detail panel)
  const loadItemLinks = async (id: string): Promise<void> => {
    const item = items.value.get(id);
    if (!item) return;

    item.linksLoading = true;
    items.value.set(id, { ...item });

    if (offline.accountId.value) {
      const { listOfflineEntities } = await import("~/utils/offline-v2/repository");
      const cached = await listOfflineEntities<any>(offline.accountId.value, "boardLink", workspaceId);
      const sent = cached.map((record) => ({
        ...record.data,
        offlineRevision: record.version,
      })).filter((link) => link.sourceId === id);
      const received = cached.map((record) => ({
        ...record.data,
        offlineRevision: record.version,
      })).filter((link) => link.targetId === id);
      item.links = { sent, received };
      items.value.set(id, { ...item });
    }
    if (!networkMonitor.isVerifiedOnline.value) {
      item.linksLoading = false;
      items.value.set(id, { ...item });
      return;
    }

    try {
      const result = await $api.boardItems.getLinks(id);
      const current = items.value.get(id);
      if (!current) return;
      if (result.success && offline.accountId.value) {
        const relations = await reconcileBoardRelationsForItem({
          accountId: offline.accountId.value,
          workspaceId,
          itemId: id,
          entity: "boardLink",
          serverRecords: [...result.data.sent, ...result.data.received],
        });
        items.value.set(id, {
          ...current,
          links: {
            sent: relations.filter((link) => link.sourceId === id),
            received: relations.filter((link) => link.targetId === id),
          },
          linksLoading: false,
        });
      } else {
        items.value.set(id, { ...current, linksLoading: false });
      }
    } catch {
      const current = items.value.get(id);
      if (current) items.value.set(id, { ...current, linksLoading: false });
    }
  };

  // Load comments for a specific item on demand (used by detail panel)
  const loadItemComments = async (id: string): Promise<void> => {
    const item = items.value.get(id);
    if (!item) return;

    item.commentsLoading = true;
    items.value.set(id, { ...item });

    if (offline.accountId.value) {
      const { listOfflineEntities } = await import("~/utils/offline-v2/repository");
      const cached = await listOfflineEntities<any>(offline.accountId.value, "boardComment", workspaceId);
      item.comments = cached.map((record) => ({
        ...record.data,
        offlineRevision: record.version,
      })).filter((comment) => comment.itemId === id);
      items.value.set(id, { ...item });
    }
    if (!networkMonitor.isVerifiedOnline.value) {
      item.commentsLoading = false;
      items.value.set(id, { ...item });
      return;
    }

    try {
      const result = await $api.boardItems.getComments(id);
      const current = items.value.get(id);
      if (!current) return;
      if (result.success && offline.accountId.value) {
        const comments = await reconcileBoardRelationsForItem({
          accountId: offline.accountId.value,
          workspaceId,
          itemId: id,
          entity: "boardComment",
          serverRecords: result.data,
        });
        items.value.set(id, { ...current, comments, commentsLoading: false });
      } else {
        items.value.set(id, { ...current, commentsLoading: false });
      }
    } catch {
      const current = items.value.get(id);
      if (current) items.value.set(id, { ...current, commentsLoading: false });
    }
  };

  const sortItemsByOrder = (left: BoardItemState, right: BoardItemState) =>
    comparePosition(left, right);

  const getOrderedColumnItems = (
    columnId: string | null,
    excludeItemId?: string,
  ): BoardItemState[] => {
    return Array.from(items.value.values())
      .filter((item) => (item.columnId ?? null) === columnId)
      .filter((item) => item.id !== excludeItemId)
      .sort(sortItemsByOrder);
  };

  // Compute the fractional rank for inserting at `insertIndex` of a column,
  // rebalancing-to-end if the neighbours are too tight to split.
  const rankForInsert = (
    targetColumnId: string | null,
    insertIndex: number,
    excludeItemId?: string,
  ): number => {
    const targetItems = getOrderedColumnItems(targetColumnId, excludeItemId);
    const idx = Math.min(Math.max(insertIndex, 0), targetItems.length);
    const before = targetItems[idx - 1]?.order ?? null;
    const after = targetItems[idx]?.order ?? null;
    if (before != null && after != null && needsRebalance(before, after)) {
      return (targetItems[targetItems.length - 1]?.order ?? 0) + RANK_GAP;
    }
    return rankBetween(before, after);
  };

  const positionForInsert = (
    targetColumnId: string | null,
    insertIndex: number,
    excludeItemId?: string,
  ): string => {
    const targetItems = getOrderedColumnItems(targetColumnId, excludeItemId);
    const idx = Math.min(Math.max(insertIndex, 0), targetItems.length);
    return positionBetween(targetItems[idx - 1]?.position, targetItems[idx]?.position);
  };

  // Move item to a different column (or reposition) — a SINGLE-item write under
  // fractional ranking: only the moved item's columnId + rank change.
  const moveItemToColumn = async (
    rawItemId: string,
    columnId: string | null,
    newOrder?: number,
  ): Promise<boolean> => {
    const itemId = resolveItemId(rawItemId) ?? rawItemId;
    const originalItem = items.value.get(itemId);
    if (!originalItem) return false;

    const targetColumnId = columnId ?? null;
    const rollback = { ...originalItem };

    const targetItems = getOrderedColumnItems(targetColumnId, itemId);
    const rank = rankForInsert(targetColumnId, newOrder ?? targetItems.length, itemId);
    const position = positionForInsert(targetColumnId, newOrder ?? targetItems.length, itemId);

    const movedItem: BoardItemState = {
      ...originalItem,
      columnId: targetColumnId,
      order: rank,
      position,
      isDirty: true,
      updatedAt: new Date(),
      error: null,
    };
    items.value.set(itemId, movedItem);
    await saveBoardItemToIndexedDB(movedItem);
    beginPositionMutation();

    try {
      await queueBoardItemsForSync([movedItem], {
        changedFields: ["columnId", "order", "position"],
        rollbackById: new Map([[itemId, rollback]]),
      });
      return true;
    } catch (error) {
      console.error("Failed to move board item:", error);
      items.value.set(itemId, rollback);
      await saveBoardItemToIndexedDB(rollback);
      return false;
    } finally {
      endPositionMutation();
    }
  };

  // ── Reorder within a column: single-flight + trailing coalesce ──────────────
  // Reorder payloads are idempotent "set the final order" operations, so we never
  // need to send intermediate states and never abort an in-flight request (an
  // abort can't roll back an already-committed server transaction anyway — it
  // just loses the response). Instead we keep ONE request in flight per column;
  // drops that arrive while it's running update `pending`, and when the request
  // returns we fire exactly one follow-up with the latest desired order. This
  // converges correctly, never drops a change, and never reorders on the wire.
  type ColumnReorderState = {
    inFlight: boolean;
    /** id → latest fractional rank to persist (coalesced across rapid drops). */
    pending: Map<string, number> | null;
    /** Last server-confirmed order, cloned to plain values for safe rollback. */
    rollback: BoardItemState[] | null;
    seq: number;
    generation: number;
    debounce: ReturnType<typeof setTimeout> | null;
  };
  const columnReorderStates = new Map<string, ColumnReorderState>();
  const getColumnReorderState = (key: string): ColumnReorderState => {
    let state = columnReorderStates.get(key);
    if (!state) {
      state = { inFlight: false, pending: null, rollback: null, seq: 0, generation: 0, debounce: null };
      columnReorderStates.set(key, state);
    }
    return state;
  };
  const getPendingColumnReorderSize = (key: string): number =>
    columnReorderStates.get(key)?.pending?.size ?? 0;

  const rollbackColumnReorder = (state: ColumnReorderState) => {
    if (!state.rollback) return;
    state.rollback.forEach((item) => items.value.set(item.id, { ...item }));
    void saveBoardItemsToIndexedDB(state.rollback);
    state.rollback = null;
  };

  // Indices of the Longest Increasing Subsequence (by rank) — the items already
  // in the desired relative order, which we keep untouched. O(n²) is ample for a
  // column.
  const lisKeptIndices = (ranks: number[]): Set<number> => {
    const n = ranks.length;
    const keep = new Set<number>();
    if (n === 0) return keep;
    const len = new Array(n).fill(1);
    const parent = new Array(n).fill(-1);
    let bestLen = 1;
    let bestEnd = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (ranks[j]! < ranks[i]! && len[j] + 1 > len[i]) {
          len[i] = len[j] + 1;
          parent[i] = j;
        }
      }
      if (len[i] > bestLen) { bestLen = len[i]; bestEnd = i; }
    }
    for (let k = bestEnd; k !== -1; k = parent[k]) keep.add(k);
    return keep;
  };

  // Minimal relabel for the desired sequence: keep the maximal already-ordered
  // set (the LIS) and assign a NEW fractional rank only to the items that are
  // out of place. A single drag move (front, middle, or back) produces exactly
  // ONE change. If two anchors are too tight to split, rebalance the column.
  const computeReorderRankChanges = (
    orderedItems: BoardItemState[],
  ): { id: string; order: number; position: string }[] => {
    const ranks = orderedItems.map(
      (item) => items.value.get(item.id)?.order ?? item.order ?? 0,
    );
    const keep = lisKeptIndices(ranks);

    const changes: { id: string; order: number; position: string }[] = [];
    let prev: number | null = null;
    let previousPosition: string | undefined;
    for (let i = 0; i < orderedItems.length; i++) {
      if (keep.has(i)) {
        prev = ranks[i]!;
        previousPosition = orderedItems[i]!.position;
        continue;
      }
      // Next kept anchor after this moved item.
      let next: number | null = null;
      for (let j = i + 1; j < orderedItems.length; j++) {
        if (keep.has(j)) { next = ranks[j]!; break; }
      }
      if (prev !== null && next !== null && needsRebalance(prev, next)) {
        // Precision exhausted — relabel the entire column with fresh spacing.
        let previous: string | undefined;
        return rebalancedRanks(orderedItems).map((order, idx) => {
          const position = positionBetween(previous, null);
          previous = position;
          return { id: orderedItems[idx]!.id, order, position };
        });
      }
      const newRank = rankBetween(prev, next);
      let nextPosition: string | undefined;
      for (let j = i + 1; j < orderedItems.length; j++) {
        if (keep.has(j)) { nextPosition = orderedItems[j]!.position; break; }
      }
      const position = positionBetween(previousPosition, nextPosition);
      changes.push({ id: orderedItems[i]!.id, order: newRank, position });
      prev = newRank;
      previousPosition = position;
    }
    return changes;
  };

  const flushColumnReorder = async (key: string, columnId: string | null): Promise<void> => {
    const state = getColumnReorderState(key);
    if (state.inFlight) return; // single-flight; the finally-block re-runs pending
    const pending = state.pending;
    if (!pending || pending.size === 0) { state.pending = null; return; }

    state.pending = null;
    state.inFlight = true;
    const mySeq = ++state.seq;
    const myGeneration = state.generation;
    beginPositionMutation();

    const changedItems = Array.from(pending.keys())
      .map((id) => items.value.get(id))
      .filter((item): item is BoardItemState => Boolean(item));

    try {
      await queueBoardItemsForSync(changedItems, {
        changedFields: ["columnId", "order", "position"],
      });
      if (mySeq === state.seq && myGeneration === state.generation) {
        state.rollback = null;
      }
    } catch (error) {
      console.error("Failed to reorder board items in column:", error);
      try {
        await queueBoardItemsForSync(changedItems, {
          changedFields: ["columnId", "order", "position"],
        });
        state.rollback = null;
      } catch {
        rollbackColumnReorder(state);
      }
    } finally {
      state.inFlight = false;
      endPositionMutation();
      // Coalesced follow-up: a newer order arrived while we were in flight.
      if (getPendingColumnReorderSize(key) > 0) void flushColumnReorder(key, columnId);
    }
  };

  const reorderItemsInColumn = async (
    columnId: string | null,
    orderedItems: BoardItemState[]
  ): Promise<boolean> => {
    const key = columnId ?? "uncategorized";
    const state = getColumnReorderState(key);
    state.generation += 1;

    // At the start of a burst (fully idle), snapshot the last server-confirmed
    // order as plain clones so a later rollback can't be corrupted by the
    // optimistic updates we're about to apply.
    if (!state.inFlight && !state.pending && !state.debounce) {
      state.rollback = getOrderedColumnItems(columnId).map((item) => ({ ...item }));
    }

    // Compute the minimal fractional-rank relabel for the desired sequence
    // (usually exactly one item — the one that was dragged).
    const changes = computeReorderRankChanges(orderedItems);
    const changeMap = new Map(changes.map((c) => [c.id, c.order]));
    const positionMap = new Map(changes.map((c) => [c.id, c.position]));
    const changedIds = new Set(changes.map((change) => change.id));
    const changedAt = new Date();

    // Optimistic UI immediately — new objects, set columnId + (possibly new) rank.
    orderedItems.forEach((item) => {
      const current = items.value.get(item.id) ?? item;
      const nextRank = changeMap.get(item.id) ?? current.order ?? 0;
      items.value.set(item.id, {
        ...current,
        columnId,
        order: nextRank,
        position: positionMap.get(item.id) ?? current.position,
        ...(changedIds.has(item.id) && { isDirty: true, updatedAt: changedAt }),
      });
    });
    const optimisticChanged = changes
      .map((c) => items.value.get(c.id))
      .filter((item): item is BoardItemState => Boolean(item));
    try {
      await Promise.all(optimisticChanged.map(saveBoardItemToIndexedDBStrict));
    } catch (error) {
      console.error("Failed to persist board item reorder locally:", error);
      rollbackColumnReorder(state);
      return false;
    }

    // Accumulate changed ranks to persist (coalesce: latest rank per id wins).
    if (!state.pending) state.pending = new Map();
    changes.forEach((c) => state.pending!.set(c.id, c.order));

    if (state.debounce) clearTimeout(state.debounce);
    state.debounce = setTimeout(() => {
      state.debounce = null;
      void flushColumnReorder(key, columnId);
    }, 150);

    return true;
  };

  // Get items filtered by column
  const getItemsByColumn = (columnId: string | null): BoardItemState[] => {
    return getOrderedColumnItems(columnId);
  };

  const setFilteredItemIds = (ids: Set<string> | null) => {
    filteredItemIds.value = ids;
  };

  const store: BoardItemsStoreInternal = {
    items,
    loadingStates,
    lastSync,
    isPositionMutationPending,
    filteredItemIds,
    createItem,
    updateItem,
    flushItem,
    loadItemLinks,
    loadItemComments,
    deleteItem,
    moveItemToColumn,
    reorderItemsInColumn,
    getItemsByColumn,
    syncWithServer,
    retryFailedItem,
    clearItemError,
    isItemLoading,
    isItemDirty,
    isItemInFilter,
    getItem,
    resolveItemId,
    setItems,
    persistAndQueueItems,
    setFilteredItemIds,
    _flushDebounce,
    _syncPendingChanges: syncPendingChanges,
    _applyOfflineItemIdMap: applyOfflineItemIdMap,
    _applyOfflineItemAck: applyOfflineItemAck,
    _applyOfflineColumnIdMap: applyOfflineColumnIdMap,
    _applyOfflineItemFailure: applyOfflineItemFailure,
    _applyOfflineConflictResolution: applyOfflineConflictResolution,
    _cancelDebounces: itemSaveDebounce.cancelAll,
  };

  boardItemsStores.set(storeKey, store);

  return store;
}

/**
 * Clean up store when no longer needed
 */
export function cleanupBoardItemsStore(workspaceId?: string): void {
  if (workspaceId) {
    boardItemsStores.get(workspaceId)?._cancelDebounces?.();
    boardItemsStores.delete(workspaceId);
    return;
  }

  for (const store of boardItemsStores.values()) store._cancelDebounces?.();
  boardItemsStores.clear();
}
