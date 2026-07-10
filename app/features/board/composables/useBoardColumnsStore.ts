import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import { DB_CONFIG } from "~/utils/constants/pwa";
import { openUnifiedDB, putRecord, getAllRecords } from "~/utils/idb";
import type {
  BoardColumn,
  DeleteBoardColumnResponse,
} from "~/shared/utils/boardColumn.contract";
import type { BoardItemState } from "~/features/board/composables/useBoardItemsStore";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { comparePosition, positionBetween } from "@@/shared/utils/position-key";

export interface BoardColumnState extends BoardColumn {
  // Local state tracking
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
}

interface BoardColumnsStore {
  columns: Ref<Map<string, BoardColumnState>>;
  loadingStates: Ref<Map<string, boolean>>;
  lastSync: Ref<Date | null>;
  createColumn: (name: string) => Promise<string | null>;
  updateColumn: (id: string, name: string) => Promise<boolean>;
  deleteColumn: (id: string) => Promise<boolean>;
  reorderColumns: (orderedColumns: BoardColumnState[]) => Promise<boolean>;
  syncWithServer: () => Promise<void>;
  getColumn: (id: string) => BoardColumnState | null;
  getOrderedColumns: () => BoardColumnState[];
}

const BOARD_COLUMNS_STORE_FALLBACK_KEY = "__default__";
const boardColumnsStores = new Map<string, BoardColumnsStore>();

// Abort controller for reorder operations
let reorderAbortController: AbortController | null = null;

/**
 * Creates or returns the board columns store for the current user
 * This provides local state management with optimistic updates
 */
export function useBoardColumnsStore(workspaceId?: string): BoardColumnsStore {
  const storeKey = workspaceId ?? BOARD_COLUMNS_STORE_FALLBACK_KEY;
  const existingStore = boardColumnsStores.get(storeKey);
  if (existingStore) {
    return existingStore;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const networkMonitor = useNetworkStatus();
  const offline = useOfflineRuntime();
  const itemsStore = useBoardItemsStore(workspaceId);

  // Local reactive state
  const columns = ref<Map<string, BoardColumnState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const lastSync = ref<Date | null>(null);

  // Create a new board column
  const createColumn = async (name: string): Promise<string | null> => {
    if (!networkMonitor.isVerifiedOnline.value) {
      const tempId = `local:${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const lastPosition = Array.from(columns.value.values()).sort((left, right) => (left.position ?? "").localeCompare(right.position ?? "")).at(-1)?.position;
      const optimisticColumn: BoardColumnState = { id: tempId, userId: "", name, order: columns.value.size, position: positionBetween(lastPosition, null), workspaceId, createdAt: new Date(), updatedAt: new Date(), isLoading: false, isDirty: true, error: null };
      columns.value.set(tempId, optimisticColumn);
      await saveColumnToIndexedDB(optimisticColumn);
      await offline.queue({ entity: "boardColumn", operation: "boardColumn.create", entityId: tempId, workspaceId, changedFields: ["name", "position"], payload: { name, workspaceId, position: optimisticColumn.position }, localData: optimisticColumn as unknown as Record<string, unknown> });
      toast.add({ title: "Saved locally", description: "The column will sync when you reconnect.", color: "warning" });
      return tempId;
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticColumn: BoardColumnState = {
      id: tempId,
      userId: "", // Will be set by server
      name,
      order: columns.value.size,
      workspaceId: workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: true,
      isDirty: false,
      error: null,
    };

    // Optimistic update
    columns.value.set(tempId, optimisticColumn);
    await saveColumnToIndexedDB(optimisticColumn);

    try {
      const result = await $api.boardColumns.create({ name, workspaceId });

      if (result.success) {
        // Remove temp, add real
        columns.value.delete(tempId);
        await deleteColumnFromIndexedDB(tempId);

        const serverColumn: BoardColumnState = {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        };
        columns.value.set(result.data.id, serverColumn);
        await saveColumnToIndexedDB(serverColumn);
        return result.data.id;
      } else {
        console.error("Server rejected column creation:", result.error);
        const col = columns.value.get(tempId);
        if (col) {
          col.isLoading = false;
          col.error = "Server rejected column creation";
          columns.value.set(tempId, col);
        }
        return null;
      }
    } catch (error) {
      console.error("Failed to create board column:", error);
      const col = columns.value.get(tempId);
      if (col) {
        col.isLoading = false;
        col.error = "Network error";
        columns.value.set(tempId, col);
      }
      return null;
    }
  };

  // Update board column name
  const updateColumn = async (id: string, name: string): Promise<boolean> => {
    const originalColumn = columns.value.get(id);
    if (!originalColumn) return false;

    // Optimistic update
    const updatedColumn: BoardColumnState = {
      ...originalColumn,
      name,
      isDirty: true,
      updatedAt: new Date(),
    };
    columns.value.set(id, updatedColumn);
    await saveColumnToIndexedDB(updatedColumn);

    if (!networkMonitor.isVerifiedOnline.value) {
      await offline.queue({ entity: "boardColumn", operation: "boardColumn.update", entityId: id, workspaceId, changedFields: ["name"], payload: { name }, localData: updatedColumn as unknown as Record<string, unknown> });
      toast.add({ title: "Saved locally", description: "The column name will sync when you reconnect.", color: "warning" });
      return true;
    }

    try {
      const result: Result<BoardColumn, APIError> = await $api.boardColumns.update(id, { name });

      if (result.success) {
        const serverColumn: BoardColumnState = {
          ...result.data,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        };
        columns.value.set(id, serverColumn);
        await saveColumnToIndexedDB(serverColumn);
        return true;
      } else {
        // Rollback
        columns.value.set(id, originalColumn);
        await saveColumnToIndexedDB(originalColumn);
        toast.add({
          title: "Error",
          description: "Failed to update column",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to update board column:", error);
      // Rollback
      columns.value.set(id, originalColumn);
      await saveColumnToIndexedDB(originalColumn);
      return false;
    }
  };

  // Delete board column
  const deleteColumn = async (id: string): Promise<boolean> => {
    const originalColumn = columns.value.get(id);
    if (!originalColumn) return false;

    const originalItems = Array.from(itemsStore.items.value.values()).map((item) => ({
      ...item,
    }));
    const movedAt = new Date();
    const sourceItems = originalItems
      .filter((item) => item.columnId === id)
      .sort(comparePosition);
    const movedItemIds = new Set(sourceItems.map((item) => item.id));
    const uncategorizedItems = originalItems
      .filter((item) => item.columnId === null)
      .sort(comparePosition);
    const affectedItemIds = new Set([
      ...movedItemIds,
      ...uncategorizedItems.map((item) => item.id),
    ]);

    let previousItemPosition: string | undefined;
    const normalizedUncategorizedItems = [...uncategorizedItems, ...sourceItems].map(
      (item, index): BoardItemState => {
        const position = positionBetween(previousItemPosition, null);
        previousItemPosition = position;
        return {
          ...item,
          columnId: null,
          order: index,
          position,
          isDirty: true,
          updatedAt: movedAt,
        };
      },
    );
    const unaffectedItems = originalItems.filter(
      (item) => !affectedItemIds.has(item.id),
    );

    const applyItemsSnapshot = (snapshotItems: BoardItemState[]) => {
      itemsStore.setItems?.(snapshotItems);
    };

    applyItemsSnapshot([...unaffectedItems, ...normalizedUncategorizedItems]);

    // Optimistic delete
    columns.value.delete(id);
    await deleteColumnFromIndexedDB(id);

    if (!networkMonitor.isVerifiedOnline.value) {
      await offline.queue({ entity: "boardColumn", operation: "boardColumn.delete", entityId: id, workspaceId, changedFields: ["deleted"], payload: {} });
      for (const item of normalizedUncategorizedItems) {
        await offline.queue({ entity: "boardItem", operation: "boardItem.update", entityId: item.id, workspaceId, changedFields: ["columnId", "position"], payload: { columnId: null, position: item.position! }, localData: item as unknown as Record<string, unknown> });
      }
      toast.add({ title: "Saved locally", description: "The column and moved cards will sync when you reconnect.", color: "warning" });
      return true;
    }

    try {
      const result: Result<DeleteBoardColumnResponse, APIError> = await $api.boardColumns.delete(id);

      if (!result.success) {
        // Rollback
        columns.value.set(id, originalColumn);
        await saveColumnToIndexedDB(originalColumn);
        applyItemsSnapshot(originalItems);
        toast.add({
          title: "Error",
          description: "Failed to delete column",
          color: "error",
        });
        return false;
      }

      const reconciledItems = [...unaffectedItems, ...normalizedUncategorizedItems].map(
        (item): BoardItemState => {
          if (!affectedItemIds.has(item.id)) return item;

          const movedItem = result.data.movedItems.find(
            (candidate) => candidate.id === item.id,
          );

          return {
            ...item,
            ...(movedItem ?? {}),
            isLoading: false,
            isDirty: false,
            lastSaved: movedAt,
            error: null,
          };
        },
      );

      applyItemsSnapshot(reconciledItems);

      itemsStore.syncWithServer().catch((syncError) => {
        console.error("Failed to reconcile board items after column delete:", syncError);
      });

      return true;
    } catch (error) {
      console.error("Failed to delete board column:", error);
      // Rollback
      columns.value.set(id, originalColumn);
      await saveColumnToIndexedDB(originalColumn);
      applyItemsSnapshot(originalItems);
      return false;
    }
  };

  // Reorder board columns
  const reorderColumns = async (orderedColumns: BoardColumnState[]): Promise<boolean> => {
    // Abort any pending reorder request
    if (reorderAbortController) {
      reorderAbortController.abort();
    }

    // Create new abort controller for this request
    reorderAbortController = new AbortController();
    const signal = reorderAbortController.signal;

    const originalColumns = new Map(columns.value);

    try {
      // Optimistic update
      let previousPosition: string | undefined;
      orderedColumns.forEach((col, index) => {
        const position = positionBetween(previousPosition, null);
        previousPosition = position;
        const next = { ...col, order: index, position };
        columns.value.set(col.id, next);
        orderedColumns[index] = next;
      });

      if (!networkMonitor.isVerifiedOnline.value) {
        for (const column of orderedColumns) {
          await offline.queue({ entity: "boardColumn", operation: "boardColumn.update", entityId: column.id, workspaceId, changedFields: ["position"], payload: { position: column.position! }, localData: column as unknown as Record<string, unknown> });
        }
        toast.add({ title: "Saved locally", description: "Column order will sync when you reconnect.", color: "warning" });
        return true;
      }

      // Save to IndexedDB in parallel (fire and forget - don't block)
      Promise.all(
        Array.from(columns.value.values()).map(col => saveColumnToIndexedDB(col))
      ).catch(err => console.warn('IndexedDB save failed during reorder:', err));

      const payload = {
        columnOrders: orderedColumns.map((col, index) => ({
          id: col.id,
          order: index,
        })),
      };

      // Check if aborted before making request
      if (signal.aborted) {
        return false;
      }

      const result = await $api.boardColumns.reorder(payload, { signal });

      // Check if aborted after request
      if (signal.aborted) {
        return false;
      }

      if (result.success) {
        // Server confirmed - mark columns as saved (they're already in correct order)
        orderedColumns.forEach((col) => {
          const current = columns.value.get(col.id);
          if (current) {
            columns.value.set(col.id, {
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
        console.error("Server rejected column reordering:", result.error);
        columns.value = originalColumns;
        // Rollback IndexedDB in parallel
        Promise.all(
          Array.from(originalColumns.values()).map(col => saveColumnToIndexedDB(col))
        ).catch(err => console.warn('IndexedDB rollback failed:', err));
        toast.add({
          title: "Error",
          description: "Failed to reorder columns",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Ignore abort errors - they're expected when a new request supersedes an old one
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }

      console.error("Failed to reorder board columns:", error);
      columns.value = originalColumns;
      return false;
    }
  };

  // Load columns from server with IndexedDB fallback
  const syncWithServer = async (): Promise<void> => {
    loadingStates.value.set("global", true);

    // IDB-first: always hydrate from local storage before the network attempt
    try { await loadFromIndexedDBFallback(); } catch { /* ignore */ }

    // If offline, do not attempt to fetch from server or overwrite IDB data
    if (!networkMonitor.isVerifiedOnline.value) {
      loadingStates.value.set("global", false);
      return;
    }

    try {
      const result = await $api.boardColumns.getAll(workspaceId);

      if (result.success) {
        const tempColumns = Array.from(columns.value.values()).filter((c) =>
          c.id.startsWith("temp-")
        );

        columns.value.clear();

        result.data.forEach((col: BoardColumn) => {
          const colState: BoardColumnState = {
            ...col,
            isLoading: false,
            isDirty: false,
            lastSaved: new Date(),
            error: null,
          };
          columns.value.set(col.id, colState);
          saveColumnToIndexedDB(colState);
        });

        // Clean up temp columns
        for (const tempCol of tempColumns) {
          try {
            await deleteColumnFromIndexedDB(tempCol.id);
          } catch {
            /* best effort cleanup */
          }
        }

        lastSync.value = new Date();
      } else {
        console.error("Failed to sync board columns: server returned failure", result.error);
      }
    } catch (error) {
      console.error("Failed to sync board columns:", error);
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  // Fallback to load columns from IndexedDB
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      const localColumns = await loadColumnsFromIndexedDB(workspaceId);

      if (localColumns.length > 0) {
        columns.value.clear();
        localColumns.forEach((col: BoardColumnState) => columns.value.set(col.id, col));
      }
    } catch {
      // Silently fail — navbar pill already shows offline status.
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  const getColumn = (id: string): BoardColumnState | null => {
    return columns.value.get(id) || null;
  };

  const getOrderedColumns = (): BoardColumnState[] => {
    return Array.from(columns.value.values()).sort(comparePosition);
  };

  const store: BoardColumnsStore = {
    columns,
    loadingStates,
    lastSync,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    syncWithServer,
    getColumn,
    getOrderedColumns,
  };

  boardColumnsStores.set(storeKey, store);

  return store;
}

/**
 * Clean up store when no longer needed
 */
export function cleanupBoardColumnsStore(workspaceId?: string): void {
  if (workspaceId) {
    boardColumnsStores.delete(workspaceId);
    return;
  }

  boardColumnsStores.clear();
}

// IndexedDB helper functions
const COLUMNS_STORE = DB_CONFIG.STORES.BOARD_COLUMNS;

async function saveColumnToIndexedDB(column: BoardColumnState): Promise<void> {
  try {
    const db = await openUnifiedDB();
    // Check if store exists, if not skip (older DB versions may not have it)
    if (!db.objectStoreNames.contains(COLUMNS_STORE)) {
      // For now, we'll skip IndexedDB for columns if store doesn't exist
      return;
    }
    await putRecord(db, COLUMNS_STORE as STORES, column);
  } catch (error) {
    console.error("Failed to save column to IndexedDB:", error);
  }
}

async function deleteColumnFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(COLUMNS_STORE)) return;

    const tx = db.transaction(COLUMNS_STORE, "readwrite");
    const store = tx.objectStore(COLUMNS_STORE);
    await store.delete(id);
  } catch (error) {
    console.error("Failed to delete column from IndexedDB:", error);
  }
}

async function loadColumnsFromIndexedDB(wsId?: string): Promise<BoardColumnState[]> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(COLUMNS_STORE)) return [];

    const allColumns = await getAllRecords<BoardColumnState>(db, COLUMNS_STORE as any);
    if (wsId) {
      return allColumns.filter((column) => column.workspaceId === wsId);
    }

    return allColumns;
  } catch (error) {
    console.error("Failed to load columns from IndexedDB:", error);
    return [];
  }
}
