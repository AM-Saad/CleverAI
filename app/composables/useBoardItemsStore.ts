import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import { DB_CONFIG } from "~/utils/constants/pwa";
import { queueBoardItemChange, openUnifiedDB, putRecord } from "~/utils/idb";
import type { BoardItem } from "~/shared/utils/boardItem.contract";
import { SYNC_TAGS } from "~/utils/constants/pwa";
import { getAllRecords } from "~/utils/idb";

type STORES = typeof DB_CONFIG.STORES[keyof typeof DB_CONFIG.STORES];

export interface BoardItemState extends BoardItem {
  // Local state tracking
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
  isInFilteredList?: boolean;
}

interface BoardItemsStore {
  items: Ref<Map<string, BoardItemState>>;
  loadingStates: Ref<Map<string, boolean>>;
  filteredItemIds: Ref<Set<string> | null>;
  createItem: (content: string, tags?: string[], columnId?: string | null) => Promise<string | null>;
  updateItem: (id: string, updatedItem: BoardItemState) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  reorderItems: (reorderedItems: BoardItemState[]) => Promise<boolean>;
  moveItemToColumn: (itemId: string, columnId: string | null, newOrder: number) => Promise<boolean>;
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
}

// Global store instance - single instance per user
let storeInstance: BoardItemsStore | null = null;

// Ensure we only wire one 'online' listener
let onlineListenerRegistered = false;
// Track if we've shown offline toast
let offlineToastShown = false;

// Abort controllers for reorder operations to prevent race conditions
let reorderAbortController: AbortController | null = null;
const reorderInColumnAbortControllers = new Map<string, AbortController>();

/**
 * Creates or returns the board items store for the current user
 * This provides local state management with optimistic updates
 */
export function useBoardItemsStore(): BoardItemsStore {
  // Return existing store if available
  if (storeInstance) {
    return storeInstance;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const { handleOfflineSubmit } = useOffline();

  // Proactively trigger sync on reconnect when pending changes exist
  if (process.client && !onlineListenerRegistered) {
    try {
      let onlineSyncScheduled = false;
      window.addEventListener("online", async () => {
        offlineToastShown = false;
        if (onlineSyncScheduled) return;
        onlineSyncScheduled = true;
        try {
          setTimeout(async () => {
            try {
              const db = await openUnifiedDB();
              if (!db.objectStoreNames.contains(DB_CONFIG.STORES.PENDING_BOARD_ITEMS))
                return;
              const pending = await getAllRecords<any>(
                db,
                DB_CONFIG.STORES.PENDING_BOARD_ITEMS as any
              );
              if (!pending.length) return;
              if (
                "serviceWorker" in navigator &&
                navigator.serviceWorker.controller
              ) {
                navigator.serviceWorker.controller.postMessage({
                  type: "SYNC_BOARD_ITEMS",
                });
              }
            } catch {
              /* ignore */
            } finally {
              onlineSyncScheduled = false;
            }
          }, 350);
        } catch {
          onlineSyncScheduled = false;
        }
      });

      // Listen for sync completion
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", async (event) => {
          const msg = event.data;

          if (msg.type === "BOARD_ITEMS_SYNCED" && msg.data?.appliedCount > 0) {
            if (storeInstance) {
              await storeInstance.syncWithServer();
            }
          }
        });
      }

      onlineListenerRegistered = true;
    } catch {
      /* ignore */
    }
  }

  /**
   * Register Background Sync for board items
   */
  const registerBoardItemsSync = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if ("sync" in reg) {
        // @ts-expect-error Background Sync is not in some TS lib DOM versions
        await reg.sync.register(SYNC_TAGS.BOARD_ITEMS);
      }
    } catch {
      /* not supported or permission denied */
    }
  };

  const { debouncedFunc: debouncedSave, cancel: cancelSave } = useDebounce(
    (id: string, content: string) => {
      updateItemToServer(id, content);
    },
    1000
  );

  // Local reactive state
  const items = ref<Map<string, BoardItemState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);
  const filteredItemIds = ref<Set<string> | null>(null);

  // Debounced server sync
  const saveToServer = async (id: string, content: string) => {
    debouncedSave(id, content);
  };

  // Sync board item changes to server
  const updateItemToServer = async (
    id: string,
    content: string
  ): Promise<boolean> => {
    const item = items.value.get(id);
    if (!item) return false;

    try {
      item.isLoading = true;
      item.error = null;

      if (!navigator.onLine) {
        await queueBoardItemChange({
          id,
          operation: "upsert",
          updatedAt: Date.now(),
          localVersion: (item as any).localVersion
            ? (item as any).localVersion + 1
            : 1,
          content,
          tags: item.tags,
        });
        await registerBoardItemsSync();
        if (!offlineToastShown) {
          toast.add({
            title: "Offline",
            description:
              "Board item changes saved locally. Will sync when back online.",
            color: "warning",
          });
          offlineToastShown = true;
        }
        item.isLoading = false;
        return true;
      }

      const result: Result<BoardItem, APIError> = await $api.boardItems.update(id, {
        content,
        tags: item.tags,
      });

      if (result.success) {
        item.isLoading = false;
        item.isDirty = false;
        item.lastSaved = new Date();
        return true;
      } else {
        console.error("Server rejected update:", result.error);
        item.isLoading = false;
        item.error = "Server rejected update";
        return false;
      }
    } catch (error) {
      console.error("Failed to sync board item to server:", error);
      if (!navigator.onLine) {
        await queueBoardItemChange({
          id,
          operation: "upsert",
          updatedAt: Date.now(),
          localVersion: (item as any).localVersion
            ? (item as any).localVersion + 1
            : 1,
          content,
          tags: item.tags,
        });
        await registerBoardItemsSync();
        if (!offlineToastShown) {
          toast.add({
            title: "Offline",
            description: "Board item update queued. Will sync when back online.",
            color: "warning",
          });
          offlineToastShown = true;
        }
        item.isLoading = false;
        return true;
      }

      item.isLoading = false;
      return false;
    }
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

    // Debounced server sync
    await saveToServer(id, updatedItem.content);
    return true;
  };

  // Create a new board item
  const createItem = async (
    content: string,
    tags: string[] = [],
    columnId: string | null = null
  ): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;

    const optimisticItem: BoardItemState = {
      id: tempId,
      userId: "", // Will be set by server
      columnId,
      content,
      tags,
      order: items.value.size,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: true,
      isDirty: false,
      error: null,
    };

    await saveBoardItemToIndexedDB(optimisticItem);
    items.value.set(tempId, optimisticItem);

    if (!navigator.onLine) {
      await queueBoardItemChange({
        id: tempId,
        operation: "upsert",
        updatedAt: Date.now(),
        localVersion: 1,
        content,
        tags,
      });
      await registerBoardItemsSync();

      optimisticItem.isLoading = false;
      optimisticItem.isDirty = true;
      items.value.set(tempId, optimisticItem);

      if (!offlineToastShown) {
        toast.add({
          title: "Offline",
          description: "Board item saved locally. Will sync when online.",
          color: "warning",
        });
        offlineToastShown = true;
      }
      return tempId;
    }

    try {
      const result = await $api.boardItems.create({
        content,
        tags,
        columnId: columnId ?? undefined,
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
      } else {
        console.error("Server rejected board item creation:", result.error);
        const item = items.value.get(tempId);
        if (item) {
          item.isLoading = false;
          item.error = "Server rejected board item creation";
          items.value.set(tempId, item);
        }
        return null;
      }
    } catch (error) {
      console.error("Failed to create board item:", error);
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

    try {
      const result: Result<unknown, APIError> = await $api.boardItems.delete(id);

      if (!result.success) {
        // Rollback
        items.value.set(id, originalItem);
        await saveBoardItemToIndexedDB(originalItem);
        toast.add({
          title: "Error",
          description: "Failed to delete board item",
          color: "error",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to delete board item:", error);
      // Rollback
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

      for (const item of Array.from(items.value.values())) {
        await saveBoardItemToIndexedDB(item);
      }

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

        for (const item of Array.from(originalItems.values())) {
          await saveBoardItemToIndexedDB(item);
        }

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
    try {
      const result = await $api.boardItems.getAll();

      if (result.success) {
        const tempItems = Array.from(items.value.values()).filter(i =>
          i.id.startsWith("temp-")
        );

        items.value.clear();

        result.data.forEach((item: BoardItem) => {
          const itemState: BoardItemState = {
            ...item,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          };
          items.value.set(item.id, itemState);
          saveBoardItemToIndexedDB(itemState);
        });

        for (const tempItem of tempItems) {
          try {
            await deleteBoardItemFromIndexedDB(tempItem.id);
          } catch {
            /* best effort cleanup */
          }
        }

        lastSync.value = new Date();
        loadingStates.value.set("global", false);
        return;
      }

      console.error("Failed to sync board items: server returned failure", result.error);
      await loadFromIndexedDBFallback();
    } catch (error) {
      console.error("Failed to sync board items:", error);
      await loadFromIndexedDBFallback();
    }
  };

  // Fallback to load board items from IndexedDB
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      const localItems = await loadBoardItemsFromIndexedDB();

      if (localItems.length > 0) {
        items.value.clear();
        localItems.forEach((item: BoardItemState) => items.value.set(item.id, item));

        toast.add({
          title: "Offline Mode",
          description: `Loaded ${localItems.length} board items from local storage.`,
          color: "warning",
        });
      }
    } catch (error) {
      console.error("Failed to load board items from IndexedDB:", error);
      toast.add({
        title: "Error",
        description: "Failed to load board items from server or local storage.",
        color: "error",
      });
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

    return await updateItemToServer(id, item.content);
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

  // Move item to a different column
  const moveItemToColumn = async (
    itemId: string,
    columnId: string | null,
    newOrder: number
  ): Promise<boolean> => {
    const originalItem = items.value.get(itemId);
    if (!originalItem) return false;

    // Optimistic update
    const updatedItem: BoardItemState = {
      ...originalItem,
      columnId,
      order: newOrder,
      isDirty: true,
      updatedAt: new Date(),
    };
    items.value.set(itemId, updatedItem);
    await saveBoardItemToIndexedDB(updatedItem);

    try {
      const result = await $api.boardItems.moveToColumn({
        itemId,
        targetColumnId: columnId,
        newOrder,
      });

      if (result.success) {
        const serverItem: BoardItemState = {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        };
        items.value.set(itemId, serverItem);
        await saveBoardItemToIndexedDB(serverItem);
        return true;
      } else {
        // Rollback
        items.value.set(itemId, originalItem);
        await saveBoardItemToIndexedDB(originalItem);
        toast.add({
          title: "Error",
          description: "Failed to move item",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to move board item:", error);
      // Rollback
      items.value.set(itemId, originalItem);
      await saveBoardItemToIndexedDB(originalItem);
      return false;
    }
  };

  // Reorder items within a column
  const reorderItemsInColumn = async (
    columnId: string | null,
    orderedItems: BoardItemState[]
  ): Promise<boolean> => {
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

    try {
      // Optimistic update - update local state immediately
      orderedItems.forEach((item, index) => {
        item.order = index;
        items.value.set(item.id, item);
      });

      // Save to IndexedDB in parallel (don't await individually)
      Promise.all(orderedItems.map(item => saveBoardItemToIndexedDB(item))).catch(err => {
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

      const result = await $api.boardItems.reorderInColumn(payload);

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
        Promise.all(
          Array.from(originalItems.values()).map(item => saveBoardItemToIndexedDB(item))
        ).catch(err => console.warn('IndexedDB rollback failed:', err));
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
    }
  };

  // Get items filtered by column
  const getItemsByColumn = (columnId: string | null): BoardItemState[] => {
    return Array.from(items.value.values())
      .filter((item) => (item.columnId ?? null) === columnId)
      .sort((a, b) => a.order - b.order);
  };

  const setFilteredItemIds = (ids: Set<string> | null) => {
    filteredItemIds.value = ids;
  };

  const store: BoardItemsStore = {
    items,
    loadingStates,
    filteredItemIds,
    createItem,
    updateItem,
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
  };

  // Cache the store
  storeInstance = store;

  // Auto-sync on creation
  syncWithServer();

  return store;
}

/**
 * Clean up store when no longer needed
 */
export function cleanupBoardItemsStore(): void {
  storeInstance = null;
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

async function loadBoardItemsFromIndexedDB(): Promise<BoardItemState[]> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.BOARD_ITEMS)) return [];

    return await getAllRecords<BoardItemState>(
      db,
      DB_CONFIG.STORES.BOARD_ITEMS as any
    );
  } catch (error) {
    console.error("Failed to load board items from IndexedDB:", error);
    return [];
  }
}
