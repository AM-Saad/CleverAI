import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import type { BoardItem, BoardItemLink, BoardItemComment, Attachment } from "~/shared/utils/boardItem.contract";
import { BoardItemsSyncRequestSchema } from "@@/shared/utils/boardItem.contract";
import { DB_CONFIG, SW_MESSAGE_TYPES } from "~/utils/constants/pwa";
import {
  createOfflineToastState,
  registerBoardItemsSync,
  setupOnlineListener,
  setupSyncCompletionListener,
} from "~/utils/sync/offlineSync";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { mergePendingBoardItems } from "./mergePendingBoardItems";

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
  reorderItems: (reorderedItems: BoardItemState[]) => Promise<boolean>;
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
  setItems?: (items: BoardItemState[]) => void;
  setFilteredItemIds: (ids: Set<string> | null) => void;
  resetOfflineToast?: () => void;
}

type BoardItemsStoreInternal = BoardItemsStore & {
  _flushDebounce?: () => Promise<void>;
};

const BOARD_ITEMS_STORE_FALLBACK_KEY = "__default__";
const boardItemsStores = new Map<string, BoardItemsStoreInternal>();

// Ensure we only wire one 'online' listener
let onlineListenerRegistered = false;

// Abort controllers for reorder operations to prevent race conditions
let reorderAbortController: AbortController | null = null;
const reorderInColumnAbortControllers = new Map<string, AbortController>();

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
  ): import('~/utils/idb').PendingBoardItemChange => ({
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

  // Sync board item changes to server
  const updateItemToServer = async (
    id: string
  ): Promise<boolean> => {
    const item = items.value.get(id);
    if (!item) return false;
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
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
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
  }) => {
    const appliedIds = response.applied ?? [];
    const conflicts = response.conflicts ?? [];
    const idMap = response.idMap ?? {};
    const now = new Date();

    for (const [tempId, serverId] of Object.entries(idMap)) {
      const tempItem = items.value.get(tempId);
      if (!tempItem) continue;

      items.value.delete(tempId);
      await deleteBoardItemFromIndexedDB(tempId);

      const serverItem: BoardItemState = {
        ...tempItem,
        id: serverId,
        isDirty: false,
        isLoading: false,
        lastSaved: now,
        error: null,
      };
      items.value.set(serverId, serverItem);
      await saveBoardItemToIndexedDB(serverItem);
    }

    for (const itemId of appliedIds) {
      const localId = idMap[itemId] ?? itemId;
      const item = items.value.get(localId);
      if (!item) continue;

      item.isDirty = false;
      item.isLoading = false;
      item.lastSaved = now;
      item.error = null;
      items.value.set(localId, { ...item });
      await saveBoardItemToIndexedDB(item);
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
  };

  const syncPendingChanges = async (): Promise<boolean> => {
    await _flushDebounce();

    if (!networkMonitor.isVerifiedOnline.value) {
      return false;
    }

    const pendingChanges = await loadPendingBoardItemChanges(workspaceId);
    if (!pendingChanges.length) {
      return true;
    }

    const syncRequest = BoardItemsSyncRequestSchema.parse(pendingChanges);
    const result = await $api.boardItems.sync(syncRequest);
    if (!result.success) {
      return false;
    }

    await applySyncResultLocally(result.data);
    await deletePendingBoardItemChanges(result.data.applied ?? []);
    lastSync.value = new Date();
    return true;
  };

  // Update board item content - local-first approach
  const updateItem = async (
    id: string,
    updatedItem: BoardItemState
  ): Promise<boolean> => {
    updatedItem.updatedAt = new Date();
    updatedItem.isDirty = true;
    items.value.set(id, updatedItem);

    // Save to IndexedDB
    await saveBoardItemToIndexedDB(updatedItem);

    // Debounced server sync (reads full item from store)
    await saveToServer(id);
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

    const optimisticItem: BoardItemState = {
      id: tempId,
      userId: "", // Will be set by server
      columnId,
      content,
      tags,
      order: items.value.size,
      workspaceId: workspaceId,
      dueDate,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: true,
      isDirty: false,
      error: null,
    };

    await saveBoardItemToIndexedDB(optimisticItem);
    items.value.set(tempId, optimisticItem);

    if (!networkMonitor.isVerifiedOnline.value) {
      await queueBoardItemChange(buildPendingPayload(optimisticItem, "upsert", 1));
      await registerBoardItemsSync();

      optimisticItem.isLoading = false;
      optimisticItem.isDirty = true;
      items.value.set(tempId, optimisticItem);

      // Offline toast handled globally by NetworkStatusIndicator/App.vue
      return tempId;
    }
    try {
      const result = await $api.boardItems.create({
        content,
        tags,
        columnId: columnId ?? undefined,
        workspaceId: workspaceId,
        dueDate: dueDate ?? undefined,
        attachments: attachments,
      });

      if (result.success) {
        items.value.delete(tempId);
        await deleteBoardItemFromIndexedDB(tempId);

        const serverItem: BoardItemState = {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        };
        items.value.set(result.data.id, serverItem);
        await saveBoardItemToIndexedDB(serverItem);
        return result.data.id;
      }
      // BUG-9 fix: this block was inside the if(result.success) block due to missing }
      // FetchFactory network error — queue for offline sync silently.
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
        await queueBoardItemChange(buildPendingPayload(optimisticItem, "upsert", 1));
        await registerBoardItemsSync();
        const offlineItem = items.value.get(tempId);
        if (offlineItem) {
          offlineItem.isLoading = false;
          offlineItem.isDirty = true;
          items.value.set(tempId, offlineItem);
        }
        return tempId;
      }

      // Genuine server rejection.
      const item = items.value.get(tempId);
      if (item) {
        item.isLoading = false;
        item.error = "Server rejected board item creation";
        items.value.set(tempId, item);
      }
      return null;
    } catch {
      if (!networkMonitor.isVerifiedOnline.value) {
        await queueBoardItemChange(buildPendingPayload(optimisticItem, "upsert", 1));
        await registerBoardItemsSync();
        const offlineItem = items.value.get(tempId);
        if (offlineItem) {
          offlineItem.isLoading = false;
          offlineItem.isDirty = true;
          items.value.set(tempId, offlineItem);
        }
        return tempId;
      }
      const item = items.value.get(tempId);
      if (item) {
        item.isLoading = false;
        item.error = "Network error";
        items.value.set(tempId, item);
      }
      return null;
    }
  };

  // Delete board item
  const deleteItem = async (id: string): Promise<boolean> => {
    const originalItem = items.value.get(id);
    if (!originalItem) return false;

    // Optimistic delete
    items.value.delete(id);
    await deleteBoardItemFromIndexedDB(id);

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
      if (result.error?.code === "FETCH_ERROR" || result.error?.code === "TIMEOUT" || !networkMonitor.isVerifiedOnline.value) {
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

  // Reorder board items
  const reorderItems = async (reorderedItems: BoardItemState[]): Promise<boolean> => {
    // Abort any pending reorder request
    if (reorderAbortController) {
      reorderAbortController.abort();
    }

    // Create new abort controller for this request
    reorderAbortController = new AbortController();
    const signal = reorderAbortController.signal;

    const originalItems = new Map(items.value);

    try {
      reorderedItems.forEach((item, index) => {
        item.order = index;
        items.value.set(item.id, item);
      });

      const payload = {
        itemOrders: reorderedItems
          .filter((item) => !item.id.startsWith("temp-"))
          .map((item, index) => ({
            id: item.id,
            order: index,
          })),
      };

      await saveBoardItemsToIndexedDB(Array.from(items.value.values()));

      // Check if aborted before making request
      if (signal.aborted) {
        return false;
      }

      const result = await $api.boardItems.reorder(payload);

      // Check if aborted after request
      if (signal.aborted) {
        return false;
      }

      if (result.success) {
        items.value.clear();
        result.data.forEach((item: BoardItem) => {
          items.value.set(item.id, {
            ...item,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          });
        });
        return true;
      } else {
        console.error("Server rejected board item reordering:", result.error);
        items.value = originalItems;

        await saveBoardItemsToIndexedDB(Array.from(originalItems.values()));

        toast.add({
          title: "Error",
          description: "Failed to reorder board items",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Ignore abort errors - they're expected when a new request supersedes an old one
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }

      console.error("Failed to reorder board items:", error);
      items.value = originalItems;
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
      await syncPendingChanges();
      const pendingAfterSync = new Set(
        (await loadPendingBoardItemChanges(workspaceId)).map((change) => change.id),
      );
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

        const itemStates: BoardItemState[] = result.data.map((item: BoardItem) => ({
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
    (left.order ?? 0) - (right.order ?? 0);

  const getOrderedColumnItems = (
    columnId: string | null,
    excludeItemId?: string,
  ): BoardItemState[] => {
    return Array.from(items.value.values())
      .filter((item) => (item.columnId ?? null) === columnId)
      .filter((item) => item.id !== excludeItemId)
      .sort(sortItemsByOrder);
  };

  const normalizeColumnItems = (
    columnId: string | null,
    columnItems: BoardItemState[],
  ): BoardItemState[] => {
    return columnItems.map((item, index) => ({
      ...item,
      columnId,
      order: index,
    }));
  };

  const applyBoardItems = (boardItems: BoardItemState[]) => {
    boardItems.forEach((item) => {
      items.value.set(item.id, item);
    });
  };

  const restoreBoardItems = async (
    originalItems: Map<string, BoardItemState>,
    affectedItemIds: Set<string>,
  ) => {
    const rollbackItems = Array.from(affectedItemIds)
      .map((itemId) => originalItems.get(itemId))
      .filter((item): item is BoardItemState => Boolean(item));

    applyBoardItems(rollbackItems);
    await saveBoardItemsToIndexedDB(rollbackItems);
  };

  // Move item to a different column
  const moveItemToColumn = async (
    itemId: string,
    columnId: string | null,
    newOrder?: number,
  ): Promise<boolean> => {
    if (isPositionMutationPending.value) {
      return false;
    }

    const originalItem = items.value.get(itemId);
    if (!originalItem) return false;

    const originalItems = new Map(items.value);
    const sourceColumnId = originalItem.columnId ?? null;
    const targetColumnId = columnId ?? null;

    const sourceItems = getOrderedColumnItems(sourceColumnId, itemId);
    const targetItems =
      sourceColumnId === targetColumnId
        ? sourceItems
        : getOrderedColumnItems(targetColumnId, itemId);

    const insertIndex = Math.min(
      Math.max(newOrder ?? targetItems.length, 0),
      targetItems.length,
    );

    const optimisticMovedItem: BoardItemState = {
      ...originalItem,
      columnId: targetColumnId,
      order: insertIndex,
      isDirty: true,
      updatedAt: new Date(),
      error: null,
    };

    const nextTargetItems = [...targetItems];
    nextTargetItems.splice(insertIndex, 0, optimisticMovedItem);

    const normalizedTargetItems = normalizeColumnItems(
      targetColumnId,
      nextTargetItems,
    );
    const normalizedSourceItems =
      sourceColumnId === targetColumnId
        ? normalizedTargetItems
        : normalizeColumnItems(sourceColumnId, sourceItems);

    const affectedItemsMap = new Map<string, BoardItemState>();
    normalizedSourceItems.forEach((item) => {
      affectedItemsMap.set(item.id, item);
    });
    normalizedTargetItems.forEach((item) => {
      affectedItemsMap.set(item.id, item);
    });

    const affectedItems = Array.from(affectedItemsMap.values());
    const affectedItemIds = new Set(affectedItemsMap.keys());

    applyBoardItems(affectedItems);
    await saveBoardItemsToIndexedDB(affectedItems);
    beginPositionMutation();

    try {
      const result = await $api.boardItems.moveToColumn({
        itemId,
        targetColumnId,
        newOrder: insertIndex,
      });

      if (result.success) {
        const lastSaved = new Date();
        affectedItemIds.forEach((affectedItemId) => {
          const current = items.value.get(affectedItemId);
          if (!current) return;

          const nextItem: BoardItemState = {
            ...current,
            ...(affectedItemId === itemId ? result.data : {}),
            isLoading: false,
            isDirty: false,
            lastSaved,
            error: null,
          };

          items.value.set(affectedItemId, nextItem);
        });

        const persistedItems = Array.from(affectedItemIds)
          .map((affectedItemId) => items.value.get(affectedItemId))
          .filter((item): item is BoardItemState => Boolean(item));
        await saveBoardItemsToIndexedDB(persistedItems);
        return true;
      } else {
        await restoreBoardItems(originalItems, affectedItemIds);
        toast.add({
          title: "Error",
          description: "Failed to move item",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to move board item:", error);
      await restoreBoardItems(originalItems, affectedItemIds);
      return false;
    } finally {
      endPositionMutation();
    }
  };

  // Reorder items within a column
  const reorderItemsInColumn = async (
    columnId: string | null,
    orderedItems: BoardItemState[]
  ): Promise<boolean> => {
    if (isPositionMutationPending.value) {
      return false;
    }

    // Use column ID as key (or 'uncategorized' for null)
    const columnKey = columnId ?? 'uncategorized';

    // Abort any pending reorder-in-column request for THIS column only
    if (reorderInColumnAbortControllers.has(columnKey)) {
      reorderInColumnAbortControllers.get(columnKey)?.abort();
    }

    // Create new abort controller for this column's request
    const controller = new AbortController();
    reorderInColumnAbortControllers.set(columnKey, controller);
    const signal = controller.signal;

    const originalItems = new Map(items.value);
    beginPositionMutation();

    try {
      // Optimistic update - update local state immediately
      orderedItems.forEach((item, index) => {
        item.order = index;
        items.value.set(item.id, item);
      });

      saveBoardItemsToIndexedDB(orderedItems).catch(err => {
        console.warn('IndexedDB save failed during reorder:', err);
      });

      const payload = {
        columnId,
        itemOrders: orderedItems
          .filter((item) => !item.id.startsWith("temp-"))
          .map((item, index) => ({
            id: item.id,
            order: index,
          })),
      };

      // Check if aborted before making request
      if (signal.aborted) {
        return false;
      }

      const result = await $api.boardItems.reorderInColumn(payload, { signal });

      // Check if aborted after request
      if (signal.aborted) {
        return false;
      }

      if (result.success) {
        // Server confirmed - items are already in correct state from optimistic update
        // Just mark them as saved
        orderedItems.forEach((item) => {
          const current = items.value.get(item.id);
          if (current) {
            items.value.set(item.id, {
              ...current,
              isLoading: false,
              isDirty: false,
              lastSaved: new Date(),
              error: null,
            });
          }
        });
        return true;
      } else {
        console.error("Server rejected item reordering:", result.error);
        items.value = originalItems;
        // Rollback IndexedDB in parallel
        saveBoardItemsToIndexedDB(Array.from(originalItems.values()))
          .catch(err => console.warn('IndexedDB rollback failed:', err));
        toast.add({
          title: "Error",
          description: "Failed to reorder items",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Ignore abort errors - they're expected when a new request supersedes an old one
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }

      console.error("Failed to reorder board items in column:", error);
      items.value = originalItems;
      return false;
    } finally {
      endPositionMutation();
    }
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
    reorderItems,
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
    setItems,
    setFilteredItemIds,
    _flushDebounce,
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
