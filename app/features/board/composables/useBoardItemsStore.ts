import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import type { BoardItem, BoardItemLink, BoardItemComment, Attachment } from "~/shared/utils/boardItem.contract";
import { BoardItemsSyncRequestSchema } from "@@/shared/utils/boardItem.contract";
import { DB_CONFIG, SW_MESSAGE_TYPES } from "~/utils/constants/pwa";
import {
  deletePendingBoardItemChanges,
  getAllRecords,
  loadPendingBoardItemChanges,
  openUnifiedDB,
  putAllRecords,
  putRecord,
  queueBoardItemChange,
  type PendingBoardItemChange,
} from "~/utils/idb";
import {
  registerBoardItemsSync,
  setupOnlineListener,
  setupSyncCompletionListener,
} from "~/utils/sync/offlineSync";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { mergePendingBoardItems } from "./mergePendingBoardItems";
import { rankBetween, needsRebalance, rebalancedRanks, RANK_GAP } from "./rank";
import { comparePosition, positionBetween } from "@@/shared/utils/position-key";

type STORES = typeof DB_CONFIG.STORES[keyof typeof DB_CONFIG.STORES];

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
  setFilteredItemIds: (ids: Set<string> | null) => void;
  resetOfflineToast?: () => void;
}

type BoardItemsStoreInternal = BoardItemsStore & {
  _flushDebounce?: () => Promise<void>;
  _syncPendingChanges?: () => Promise<boolean>;
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

  // Register once-per-app online listener and sync completion listener.
  if (import.meta.client && !onlineListenerRegistered) {
    setupOnlineListener({
      pendingStoreName: DB_CONFIG.STORES.PENDING_BOARD_ITEMS,
      swMessageType: SW_MESSAGE_TYPES.SYNC_BOARD_ITEMS,
      onOnline: () => {
        // Obsolete: resetOfflineToast no longer needed, using global toast deduplication
      },
      // Step 1 of reconnect: flush debounced saves before sync
      onBeforeSync: async () => {
        await Promise.all(
          Array.from(boardItemsStores.values()).map((store) =>
            store._flushDebounce?.(),
          ),
        );
      },
      onSyncDirect: async () => {
        await Promise.all(
          Array.from(boardItemsStores.values()).map((store) =>
            store._syncPendingChanges?.(),
          ),
        );
      },
    });

    // Guard: avoid re-entrant sync cycles.
    let boardSyncRefreshing = false;

    setupSyncCompletionListener({
      messageType: SW_MESSAGE_TYPES.BOARD_ITEMS_SYNCED,
      onSynced: async (appliedCount: number) => {
        if (boardSyncRefreshing) return;
        boardSyncRefreshing = true;
        try {
          // Always re-sync after a successful background sync
          await Promise.all(
            Array.from(boardItemsStores.values()).map((store) =>
              store.syncWithServer(),
            ),
          );
        } finally {
          boardSyncRefreshing = false;
        }
      },
    });

    onlineListenerRegistered = true;
  }

  // (Removed offline toast deduplication state)

  const { debouncedFunc: debouncedSave, cancel: cancelSave, flush: flushSave } = useDebounce(
    (id: string) => {
      updateItemToServer(id);
    },
    1000
  );

  // Expose flush so the online listener can call it before sync
  const _flushDebounce = async () => {
    const dirtyItems = Array.from(items.value.values()).filter(i => i.isDirty);
    await Promise.allSettled(
      dirtyItems.map((item) => Promise.resolve(flushSave(item.id))),
    );
  };

  // Local reactive state
  const items = ref<Map<string, BoardItemState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);

  // Temp→server id aliases (mirrors notes' noteIdAliases): an optimistic
  // item's temp id is swapped for the server id on reconcile; surfaces that
  // captured the temp id (quick capture, /board/[id]) resolve through this.
  const itemIdAliases = ref<Map<string, string>>(new Map());
  const resolveItemId = (id: string | null): string | null => {
    if (!id) return null;
    return itemIdAliases.value.get(id) ?? null;
  };
  const recordItemAlias = (tempId: string, serverId: string) => {
    const next = new Map(itemIdAliases.value);
    next.set(tempId, serverId);
    itemIdAliases.value = next;
  };
  const isUnreconciledTempId = (id: string) =>
    id.startsWith("temp-") && !itemIdAliases.value.has(id);
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

  // Debounced server sync
  const saveToServer = async (id: string) => {
    debouncedSave(id);
  };

  /**
   * Build a complete PendingBoardItemChange from a BoardItemState.
   * Ensures the sync endpoint receives all required fields (columnId, order,
   * userId, workspaceId, createdAt, dueDate, tags, attachments).
   */
  const buildPendingPayload = (
    item: BoardItemState,
    operation: 'upsert' | 'delete',
    localVersion: number
  ): PendingBoardItemChange => ({
    id: item.id,
    operation,
    updatedAt: Date.now(),
    localVersion,
    workspaceId: item.workspaceId ?? workspaceId,
    userId: item.userId || "",
    columnId: item.columnId ?? null,
    order: item.order ?? 0,
    content: item.content,
    tags: item.tags,
    dueDate: item.dueDate
      ? (item.dueDate instanceof Date ? item.dueDate.toISOString() : item.dueDate as string)
      : null,
    attachments: item.attachments,
    createdAt: item.createdAt
      ? (item.createdAt instanceof Date ? item.createdAt.getTime() : new Date(item.createdAt as string).getTime())
      : Date.now(),
  });

  const toTimestamp = (value: BoardItemState["updatedAt"] | number | string | undefined): number => {
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const localVersionFor = (
    item: BoardItemState,
    sentChange?: PendingBoardItemChange,
  ): number =>
    Math.max(
      sentChange?.localVersion ?? 0,
      (item as { localVersion?: number }).localVersion ?? 0,
    ) + 1;

  const isSamePendingChange = (
    left: PendingBoardItemChange | undefined,
    right: PendingBoardItemChange | undefined,
  ): boolean =>
    Boolean(left && right) &&
    left!.id === right!.id &&
    left!.operation === right!.operation &&
    left!.updatedAt === right!.updatedAt &&
    (left!.localVersion ?? 0) === (right!.localVersion ?? 0);

  const changedAfterPendingSnapshot = (
    item: BoardItemState,
    sentChange?: PendingBoardItemChange,
  ): boolean => {
    if (!sentChange) return Boolean(item.isDirty);
    return toTimestamp(item.updatedAt) > sentChange.updatedAt;
  };

  const isTransientNetworkError = (error?: APIError | null): boolean =>
    error?.code === "FETCH_ERROR" || error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value;

  const queueBoardItemsForSync = async (
    boardItems: BoardItemState[],
  ): Promise<void> => {
    const queuedAt = new Date();

    for (const item of boardItems) {
      const current = items.value.get(item.id) ?? item;
      const nextItem: BoardItemState = {
        ...current,
        isLoading: false,
        isDirty: true,
        updatedAt: current.updatedAt ?? queuedAt,
        error: null,
      };
      items.value.set(item.id, nextItem);
      await queueBoardItemChange(
        buildPendingPayload(
          nextItem,
          "upsert",
          ((nextItem as { localVersion?: number }).localVersion ?? 0) + 1,
        ),
      );
    }

    await registerBoardItemsSync();
  };

  const repairDirtyItemsWithoutPending = async (
    pendingChanges: PendingBoardItemChange[],
  ): Promise<PendingBoardItemChange[]> => {
    const pendingById = new Set(pendingChanges.map((change) => change.id));
    const nextChanges = pendingChanges.slice();

    for (const item of items.value.values()) {
      if (!item.isDirty || item.error || pendingById.has(item.id)) continue;

      const repairedChange = buildPendingPayload(
        item,
        "upsert",
        localVersionFor(item),
      );
      await queueBoardItemChange(repairedChange);
      nextChanges.push(repairedChange);
      pendingById.add(item.id);
    }

    if (nextChanges.length !== pendingChanges.length) {
      await registerBoardItemsSync();
    }

    return nextChanges;
  };

  const deleteAppliedChangesIfUnchanged = async (
    appliedIds: string[],
    sentChanges: PendingBoardItemChange[],
  ): Promise<void> => {
    if (!appliedIds.length) return;

    const sentById = new Map(sentChanges.map((change) => [change.id, change]));
    const latestChanges = await loadPendingBoardItemChanges(workspaceId);
    const latestById = new Map(
      latestChanges.map((change) => [change.id, change]),
    );
    const safeToDelete = appliedIds.filter((id) =>
      isSamePendingChange(latestById.get(id), sentById.get(id)),
    );

    await deletePendingBoardItemChanges(safeToDelete);
  };

  // Sync board item changes to server
  const updateItemToServer = async (
    rawId: string
  ): Promise<boolean> => {
    const id = itemIdAliases.value.get(rawId) ?? rawId;
    const item = items.value.get(id);
    if (!item) return false;
    // A temp item is replayed through the pending queue; a PATCH against the
    // temp id would just 404.
    if (isUnreconciledTempId(id)) return true;
    const nextVersion = ((item as any).localVersion ?? 0) + 1;

    try {
      item.isLoading = true;
      item.error = null;

      if (!networkMonitor.isVerifiedOnline.value) {
        await queueBoardItemChange(buildPendingPayload(item, "upsert", nextVersion));
        await registerBoardItemsSync();
        item.isLoading = false;
        item.isDirty = true;
        return true;
      }

      const result: Result<BoardItem, APIError> = await $api.boardItems.update(id, {
        content: item.content,
        tags: item.tags,
        dueDate: item.dueDate ? (item.dueDate instanceof Date ? item.dueDate.toISOString() : item.dueDate as string) : null,
        attachments: item.attachments,
      });

      if (result.success) {
        item.isLoading = false;
        item.isDirty = false;
        item.lastSaved = new Date();
        return true;
      }

      // FetchFactory wraps network failures as FETCH_ERROR / TIMEOUT — treat
      // identically to being offline: queue for background sync.
      if (isTransientNetworkError(result.error)) {
        await queueBoardItemChange(buildPendingPayload(item, "upsert", nextVersion));
        await registerBoardItemsSync();
        item.isLoading = false;
        item.isDirty = true;
        return true;
      }

      // Genuine server rejection (e.g. 400/403/500).
      item.isLoading = false;
      item.error = "Server rejected update";
      return false;
    } catch {
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueBoardItemChange(buildPendingPayload(item, "upsert", nextVersion));
        await registerBoardItemsSync();
        item.isLoading = false;
        item.isDirty = true;
        return true;
      }
      item.isLoading = false;
      return false;
    }
  };

  const applySyncResultLocally = async (response: {
    applied?: string[];
    conflicts?: Array<{ id: string }>;
    idMap?: Record<string, string>;
  }, sentChanges: PendingBoardItemChange[] = []): Promise<PendingBoardItemChange[]> => {
    const appliedIds = response.applied ?? [];
    const conflicts = response.conflicts ?? [];
    const idMap = response.idMap ?? {};
    const sentById = new Map(sentChanges.map((change) => [change.id, change]));
    const followUpChanges: PendingBoardItemChange[] = [];
    const now = new Date();

    for (const [tempId, serverId] of Object.entries(idMap)) {
      recordItemAlias(tempId, serverId);
      const tempItem = items.value.get(tempId);
      const sentChange = sentById.get(tempId);
      if (!tempItem) {
        followUpChanges.push({
          id: serverId,
          operation: "delete",
          updatedAt: Date.now(),
          localVersion: (sentChange?.localVersion ?? 0) + 1,
          workspaceId: sentChange?.workspaceId ?? workspaceId,
        });
        continue;
      }

      items.value.delete(tempId);
      await deleteBoardItemFromIndexedDB(tempId);
      const changedAfterSync = changedAfterPendingSnapshot(tempItem, sentChange);

      const serverItem: BoardItemState = {
        ...tempItem,
        id: serverId,
        isDirty: changedAfterSync,
        isLoading: false,
        lastSaved: now,
        error: null,
      };
      items.value.set(serverId, serverItem);
      await saveBoardItemToIndexedDB(serverItem);
      if (changedAfterSync) {
        followUpChanges.push(
          buildPendingPayload(
            serverItem,
            "upsert",
            localVersionFor(serverItem, sentChange),
          ),
        );
      }
    }

    for (const itemId of appliedIds) {
      if (idMap[itemId]) continue;
      const localId = idMap[itemId] ?? itemId;
      const item = items.value.get(localId);
      if (!item) continue;
      const sentChange = sentById.get(itemId);
      const changedAfterSync = changedAfterPendingSnapshot(item, sentChange);

      item.isDirty = changedAfterSync;
      item.isLoading = false;
      item.lastSaved = now;
      item.error = null;
      items.value.set(localId, { ...item });
      await saveBoardItemToIndexedDB(item);
      if (changedAfterSync) {
        followUpChanges.push(
          buildPendingPayload(
            item,
            "upsert",
            localVersionFor(item, sentChange),
          ),
        );
      }
    }

    for (const conflict of conflicts) {
      const item = items.value.get(conflict.id);
      if (!item) continue;

      item.isLoading = false;
      item.isDirty = true;
      item.error = "Sync conflict detected. Review this item and retry.";
      items.value.set(conflict.id, { ...item });
      await saveBoardItemToIndexedDB(item);
    }

    return followUpChanges;
  };

  const syncPendingChanges = async (): Promise<boolean> => {
    await _flushDebounce();

    // The old Board queue is an intake buffer only. Convert it before any
    // reconnect work so all durable replay goes through the v2 contract.
    if (offline.accountId.value) {
      await offline.migrateLegacyBoard();
      await offline.sync();
      return true;
    }

    if (!networkMonitor.isVerifiedOnline.value) {
      return false;
    }

    for (let pass = 0; pass < 3; pass += 1) {
      let pendingChanges = await loadPendingBoardItemChanges(workspaceId);
      pendingChanges = await repairDirtyItemsWithoutPending(pendingChanges);
      if (!pendingChanges.length) {
        lastSync.value = new Date();
        return true;
      }

      const syncRequest = BoardItemsSyncRequestSchema.parse(pendingChanges);
      const result = await $api.boardItems.sync(syncRequest);
      if (!result.success) {
        return false;
      }

      const followUpChanges = await applySyncResultLocally(result.data, pendingChanges);
      const mappedTempIds = Object.keys(result.data.idMap ?? {});
      if (mappedTempIds.length) {
        await deletePendingBoardItemChanges(mappedTempIds);
      }
      await deleteAppliedChangesIfUnchanged(
        (result.data.applied ?? []).filter((id) => !mappedTempIds.includes(id)),
        pendingChanges,
      );
      for (const change of followUpChanges) {
        await queueBoardItemChange(change);
      }
      if (followUpChanges.length) {
        await registerBoardItemsSync();
        continue;
      }

      lastSync.value = new Date();
      return true;
    }

    lastSync.value = new Date();
    return true;
  };

  // Update board item content - local-first approach
  const updateItem = async (
    id: string,
    updatedItem: BoardItemState
  ): Promise<boolean> => {
    // A caller may still hold a temp id after the create reconciled — write
    // through to the real id so the temp entry isn't resurrected.
    const realId = itemIdAliases.value.get(id) ?? id;
    updatedItem = { ...updatedItem, id: realId };
    updatedItem.updatedAt = new Date();
    updatedItem.isDirty = true;
    items.value.set(realId, updatedItem);

    // Save to IndexedDB
    await saveBoardItemToIndexedDB(updatedItem);

    if (!networkMonitor.isVerifiedOnline.value) {
      const create = isUnreconciledTempId(realId);
      await offline.queue({
        entity: "boardItem",
        operation: create ? "boardItem.create" : "boardItem.update",
        entityId: realId,
        workspaceId: updatedItem.workspaceId ?? workspaceId,
        changedFields: ["content", "tags", "dueDate", "attachments", "columnId", "position"],
        payload: { workspaceId: updatedItem.workspaceId ?? workspaceId, columnId: updatedItem.columnId ?? null, content: updatedItem.content, tags: updatedItem.tags, dueDate: updatedItem.dueDate instanceof Date ? updatedItem.dueDate.toISOString() : updatedItem.dueDate ?? null, attachments: updatedItem.attachments, order: updatedItem.order, position: updatedItem.position },
        localData: updatedItem as unknown as Record<string, unknown>,
      });
      return true;
    }

    if (isUnreconciledTempId(realId)) {
      await queueBoardItemChange(
        buildPendingPayload(updatedItem, "upsert", localVersionFor(updatedItem)),
      );
      await registerBoardItemsSync();
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
      return true;
    }

    // Debounced server sync (reads full item from store)
    await saveToServer(realId);
    return true;
  };

  // Create a new board item
  const createItem = async (
    content: string,
    tags: string[] = [],
    columnId: string | null = null,
    dueDate: string | null = null,
    attachments: Attachment[] = []
  ): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;

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

    await saveBoardItemToIndexedDB(optimisticItem);
    items.value.set(tempId, optimisticItem);
    try {
      if (!networkMonitor.isVerifiedOnline.value) {
        await offline.queue({ entity: "boardItem", operation: "boardItem.create", entityId: tempId, workspaceId, changedFields: ["content", "tags", "columnId", "dueDate", "attachments", "position"], payload: { workspaceId, columnId, content, tags, dueDate, attachments, order: optimisticItem.order, position: optimisticItem.position }, localData: optimisticItem as unknown as Record<string, unknown> });
        return tempId;
      }
      await queueBoardItemChange(buildPendingPayload(optimisticItem, "upsert", 1));
      await registerBoardItemsSync();
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
    } catch (error) {
      const current = items.value.get(tempId) ?? optimisticItem;
      items.value.set(tempId, {
        ...current,
        error:
          "This item is visible locally, but could not be queued for sync. Keep this page open and retry.",
      });
      console.error("Failed to queue board item creation:", error);
    }

    return tempId;
  };

  // Delete board item
  const deleteItem = async (rawId: string): Promise<boolean> => {
    const id = itemIdAliases.value.get(rawId) ?? rawId;
    const originalItem = items.value.get(id);
    if (!originalItem) return false;

    // Optimistic delete
    items.value.delete(id);
    await deleteBoardItemFromIndexedDB(id);

    if (!networkMonitor.isVerifiedOnline.value) {
      await offline.queue({ entity: "boardItem", operation: "boardItem.delete", entityId: id, workspaceId: originalItem.workspaceId ?? workspaceId, changedFields: ["deleted"], payload: {} });
      return true;
    }

    if (isUnreconciledTempId(id)) {
      await queueBoardItemChange({
        id,
        operation: "delete",
        updatedAt: Date.now(),
        localVersion: 1,
        workspaceId: originalItem.workspaceId ?? workspaceId,
      });
      await registerBoardItemsSync();
      if (networkMonitor.isVerifiedOnline.value) {
        void syncPendingChanges();
      }
      return true;
    }

    // If already offline, queue the delete immediately.
    if (!networkMonitor.isVerifiedOnline.value) {
      await queueBoardItemChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
      await registerBoardItemsSync();
      return true;
    }

    try {
      const result: Result<unknown, APIError> = await $api.boardItems.delete(id);

      if (result.success) return true;

      // FetchFactory network error — queue for background sync.
      if (isTransientNetworkError(result.error)) {
        await queueBoardItemChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
        await registerBoardItemsSync();
        return true;
      }

      // Genuine server rejection — restore the item.
      items.value.set(id, originalItem);
      await saveBoardItemToIndexedDB(originalItem);
      toast.add({ title: "Error", description: "Failed to delete board item", color: "error" });
      return false;
    } catch {
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueBoardItemChange({ id, operation: "delete", updatedAt: Date.now(), localVersion: 1 });
        await registerBoardItemsSync();
        return true;
      }
      items.value.set(id, originalItem);
      await saveBoardItemToIndexedDB(originalItem);
      return false;
    }
  };

  // Load board items from server with IndexedDB fallback
  const syncWithServer = async (): Promise<void> => {
    loadingStates.value.set("global", true);

    // IDB-first: always hydrate from local storage before the network attempt
    // so that an offline reload immediately shows the user's last-known data.
    try { await hydrateFromIDB(); } catch { /* ignore — navbar pill shows offline */ }

    // BUG-1 fix: if we're not verified online, stop here.
    // The SW's cached API response is stale server data that would overwrite
    // the fresher IDB data we just hydrated.
    if (!networkMonitor.isVerifiedOnline.value) {
      loadingStates.value.set("global", false);
      return;
    }

    try {
      const pendingBeforeSync = await loadPendingBoardItemChanges(workspaceId);
      const pendingDeleteIds = new Set(
        pendingBeforeSync
          .filter((change) => change.operation === "delete")
          .map((change) => change.id),
      );
      await syncPendingChanges();
      const pendingBeforeFetch = await loadPendingBoardItemChanges(workspaceId);
      pendingBeforeFetch
        .filter((change) => change.operation === "delete")
        .forEach((change) => pendingDeleteIds.add(change.id));
      const pendingAfterSync = new Set(pendingBeforeFetch.map((change) => change.id));
      const result = await $api.boardItems.getAll(workspaceId);

      if (result.success) {
        const tempItems = Array.from(items.value.values()).filter(i =>
          i.id.startsWith("temp-") && pendingAfterSync.has(i.id)
        );

        // Preserve dirty items (in-progress edits)
        const dirtyItems = new Map<string, BoardItemState>();
        for (const [id, item] of items.value) {
          if (item.isDirty && !id.startsWith("temp-")) {
            dirtyItems.set(id, item);
          }
        }

        const itemStates: BoardItemState[] = result.data
          .filter((item: BoardItem) => !pendingDeleteIds.has(item.id))
          .map((item: BoardItem) => ({
            ...item,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          }));

        items.value.clear();
        itemStates.forEach((is) => {
          // Merge: keep dirty local version over server data
          const dirty = dirtyItems.get(is.id);
          if (dirty) {
            items.value.set(is.id, dirty);
          } else {
            items.value.set(is.id, is);
          }
        });

        // Re-add temp items
        for (const tempItem of tempItems) {
          items.value.set(tempItem.id, tempItem);
        }

        // Only persist non-dirty items to IDB
        await saveBoardItemsToIndexedDB(itemStates.filter(is => !dirtyItems.has(is.id)));

        for (const tempItem of tempItems) {
          try {
            await deleteBoardItemFromIndexedDB(tempItem.id);
          } catch {
            /* best effort cleanup */
          }
        }

        lastSync.value = new Date();
      }
      // Server failed: IDB data from hydrateFromIDB remains visible.
    } catch {
      // Network error: IDB data from hydrateFromIDB remains visible.
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  // Pure IDB hydration — loads BOARD_ITEMS store and overlays PENDING_BOARD_ITEMS
  // so offline edits survive a page reload.
  const hydrateFromIDB = async (): Promise<void> => {
    const [localItems, pendingChanges] = await Promise.all([
      loadBoardItemsFromIndexedDB(workspaceId),  // BUG-4 fix: filter by workspaceId
      loadPendingBoardItemChanges(workspaceId),
    ]);

    if (localItems.length === 0 && pendingChanges.length === 0) return;

    const itemMap = mergePendingBoardItems(localItems, pendingChanges);

    items.value.clear();
    itemMap.forEach((item, id) => items.value.set(id, item));
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
    return items.value.get(id)?.isLoading ?? false;
  };

  const isItemDirty = (id: string): boolean => {
    return items.value.get(id)?.isDirty ?? false;
  };

  const retryFailedItem = async (id: string): Promise<boolean> => {
    const item = items.value.get(id);
    if (!item || !item.error) return false;

    item.error = null;
    item.isLoading = true;
    items.value.set(id, item);

    return await updateItemToServer(id);
  };

  const clearItemError = (id: string) => {
    const item = items.value.get(id);
    if (item) {
      item.error = null;
      items.value.set(id, item);
    }
  };

  const isItemInFilter = (id: string): boolean => {
    if (!filteredItemIds.value) return true;
    return filteredItemIds.value.has(id);
  };

  const getItem = (id: string): BoardItemState | null => {
    return items.value.get(id) || null;
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

    if (!networkMonitor.isVerifiedOnline.value) {
      if (offline.accountId.value) {
        const { listOfflineEntities } = await import("~/utils/offline-v2/repository");
        const cached = await listOfflineEntities<any>(offline.accountId.value, "boardLink", workspaceId);
        const sent = cached.map((record) => record.data).filter((link) => link.sourceId === id);
        const received = cached.map((record) => record.data).filter((link) => link.targetId === id);
        item.links = { sent, received };
      }
      item.linksLoading = false;
      items.value.set(id, { ...item });
      return;
    }

    try {
      const result = await $api.boardItems.getLinks(id);
      const current = items.value.get(id);
      if (!current) return;
      if (result.success) {
        items.value.set(id, { ...current, links: result.data, linksLoading: false });
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

    if (!networkMonitor.isVerifiedOnline.value) {
      if (offline.accountId.value) {
        const { listOfflineEntities } = await import("~/utils/offline-v2/repository");
        const cached = await listOfflineEntities<any>(offline.accountId.value, "boardComment", workspaceId);
        item.comments = cached.map((record) => record.data).filter((comment) => comment.itemId === id);
      }
      item.commentsLoading = false;
      items.value.set(id, { ...item });
      return;
    }

    try {
      const result = await $api.boardItems.getComments(id);
      const current = items.value.get(id);
      if (!current) return;
      if (result.success) {
        items.value.set(id, { ...current, comments: result.data, commentsLoading: false });
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
    itemId: string,
    columnId: string | null,
    newOrder?: number,
  ): Promise<boolean> => {
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
      if (!networkMonitor.isVerifiedOnline.value || isUnreconciledTempId(itemId)) {
        if (!networkMonitor.isVerifiedOnline.value) {
          await offline.queue({ entity: "boardItem", operation: isUnreconciledTempId(itemId) ? "boardItem.create" : "boardItem.update", entityId: itemId, workspaceId: movedItem.workspaceId ?? workspaceId, changedFields: ["columnId", "position"], payload: { workspaceId: movedItem.workspaceId ?? workspaceId, columnId: targetColumnId, order: rank, position, content: movedItem.content, tags: movedItem.tags, dueDate: movedItem.dueDate instanceof Date ? movedItem.dueDate.toISOString() : movedItem.dueDate ?? null, attachments: movedItem.attachments }, localData: movedItem as unknown as Record<string, unknown> });
          return true;
        }
        await queueBoardItemsForSync([movedItem]);
        if (networkMonitor.isVerifiedOnline.value) {
          void syncPendingChanges();
        }
        return true;
      }

      const result = await $api.boardItems.moveToColumn({ itemId, targetColumnId, rank });

      if (result.success) {
        const current = items.value.get(itemId);
        if (current) {
          const reconciled: BoardItemState = {
            ...current,
            ...result.data,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          };
          items.value.set(itemId, reconciled);
          await saveBoardItemToIndexedDB(reconciled);
        }
        return true;
      } else if (isTransientNetworkError(result.error)) {
        await queueBoardItemsForSync([movedItem]);
        return true;
      } else {
        items.value.set(itemId, rollback);
        await saveBoardItemToIndexedDB(rollback);
        toast.add({ title: "Error", description: "Failed to move item", color: "error" });
        return false;
      }
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
    debounce: ReturnType<typeof setTimeout> | null;
  };
  const columnReorderStates = new Map<string, ColumnReorderState>();
  const getColumnReorderState = (key: string): ColumnReorderState => {
    let state = columnReorderStates.get(key);
    if (!state) {
      state = { inFlight: false, pending: null, rollback: null, seq: 0, debounce: null };
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
    beginPositionMutation();

    const itemOrders = Array.from(pending.entries())
      .filter(([id]) => !id.startsWith("temp-"))
      .map(([id, order]) => ({ id, order }));
    const changedItems = Array.from(pending.keys())
      .map((id) => items.value.get(id))
      .filter((item): item is BoardItemState => Boolean(item));
    const tempChangedItems = changedItems.filter((item) =>
      isUnreconciledTempId(item.id),
    );

    try {
      if (!networkMonitor.isVerifiedOnline.value) {
        for (const item of changedItems) {
          await offline.queue({ entity: "boardItem", operation: isUnreconciledTempId(item.id) ? "boardItem.create" : "boardItem.update", entityId: item.id, workspaceId: item.workspaceId ?? workspaceId, changedFields: ["position", "columnId"], payload: { workspaceId: item.workspaceId ?? workspaceId, columnId, order: item.order, position: item.position, content: item.content, tags: item.tags, dueDate: item.dueDate instanceof Date ? item.dueDate.toISOString() : item.dueDate ?? null, attachments: item.attachments }, localData: item as unknown as Record<string, unknown> });
        }
        state.rollback = null; // queued = accepted
        return;
      }

      if (tempChangedItems.length) {
        await queueBoardItemsForSync(tempChangedItems);
      }

      // Nothing persistable (only optimistic temp items moved) — they'll be
      // ordered correctly once their create resolves.
      if (itemOrders.length === 0) { state.rollback = null; return; }

      const result = await $api.boardItems.reorderInColumn({ columnId, itemOrders });

      // A newer flush has superseded this one — discard this (stale) response.
      if (mySeq !== state.seq) return;

      if (result.success) {
        const lastSaved = new Date();
        changedItems.forEach((item) => {
          if (isUnreconciledTempId(item.id)) return;
          const current = items.value.get(item.id);
          if (current) {
            items.value.set(item.id, {
              ...current, isLoading: false, isDirty: false, lastSaved, error: null,
            });
          }
        });
        state.rollback = null; // confirmed
      } else if (isTransientNetworkError(result.error)) {
        await queueBoardItemsForSync(changedItems);
        state.rollback = null;
      } else {
        console.error("Server rejected item reordering:", result.error);
        rollbackColumnReorder(state);
        toast.add({
          title: "Couldn't save the new order",
          description: "Your other changes are safe. Please try again.",
          color: "error",
        });
      }
    } catch (error) {
      console.error("Failed to reorder board items in column:", error);
      try {
        await queueBoardItemsForSync(changedItems);
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

    // Optimistic UI immediately — new objects, set columnId + (possibly new) rank.
    orderedItems.forEach((item) => {
      const current = items.value.get(item.id) ?? item;
      const nextRank = changeMap.get(item.id) ?? current.order ?? 0;
      items.value.set(item.id, { ...current, columnId, order: nextRank, position: positionMap.get(item.id) ?? current.position });
    });
    const optimisticChanged = changes
      .map((c) => items.value.get(c.id))
      .filter((item): item is BoardItemState => Boolean(item));
    void saveBoardItemsToIndexedDB(optimisticChanged);

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
    setFilteredItemIds,
    _flushDebounce,
    _syncPendingChanges: syncPendingChanges,
  };

  boardItemsStores.set(storeKey, store);

  return store;
}

/**
 * Clean up store when no longer needed
 */
export function cleanupBoardItemsStore(workspaceId?: string): void {
  if (workspaceId) {
    boardItemsStores.delete(workspaceId);
    return;
  }

  boardItemsStores.clear();
}

// IndexedDB helper functions
async function saveBoardItemToIndexedDB(item: BoardItemState): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOARD_ITEMS)) return;

    // Use putRecord which automatically sanitizes for IndexedDB
    await putRecord(db, DB_CONFIG.STORES.BOARD_ITEMS as STORES, item);
  } catch (error) {
    console.error("Failed to save board item to IndexedDB:", error);
  }
}

async function saveBoardItemsToIndexedDB(itemsArr: BoardItemState[]): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOARD_ITEMS)) return;
    await putAllRecords(db, DB_CONFIG.STORES.BOARD_ITEMS as STORES, itemsArr);
  } catch (error) {
    console.error("Failed to batch save board items to IndexedDB:", error);
  }
}

async function deleteBoardItemFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOARD_ITEMS)) return;

    const tx = db.transaction(DB_CONFIG.STORES.BOARD_ITEMS, "readwrite");
    const store = tx.objectStore(DB_CONFIG.STORES.BOARD_ITEMS);
    await store.delete(id);
  } catch (error) {
    console.error("Failed to delete board item from IndexedDB:", error);
  }
}

// BUG-4 fix: filter by workspaceId to prevent cross-workspace data leakage
async function loadBoardItemsFromIndexedDB(wsId?: string): Promise<BoardItemState[]> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOARD_ITEMS)) return [];

    const allItems = await getAllRecords<BoardItemState>(
      db,
      DB_CONFIG.STORES.BOARD_ITEMS as any
    );

    // Client-side filter by workspaceId
    if (wsId) {
      return allItems.filter(item => item.workspaceId === wsId);
    }
    return allItems;
  } catch (error) {
    console.error("Failed to load board items from IndexedDB:", error);
    return [];
  }
}
