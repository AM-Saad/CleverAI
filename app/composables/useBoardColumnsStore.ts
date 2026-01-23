import type { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import { DB_CONFIG } from "~/utils/constants/pwa";
import { openUnifiedDB, putRecord, getAllRecords } from "~/utils/idb";
import type { BoardColumn } from "~/shared/utils/boardColumn.contract";
import type { STORES } from "~/utils/constants/pwa";

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
  createColumn: (name: string) => Promise<string | null>;
  updateColumn: (id: string, name: string) => Promise<boolean>;
  deleteColumn: (id: string) => Promise<boolean>;
  reorderColumns: (orderedColumns: BoardColumnState[]) => Promise<boolean>;
  syncWithServer: () => Promise<void>;
  getColumn: (id: string) => BoardColumnState | null;
  getOrderedColumns: () => BoardColumnState[];
}

// Global store instance - single instance per user
let storeInstance: BoardColumnsStore | null = null;

// Abort controller for reorder operations
let reorderAbortController: AbortController | null = null;

/**
 * Creates or returns the board columns store for the current user
 * This provides local state management with optimistic updates
 */
export function useBoardColumnsStore(): BoardColumnsStore {
  // Return existing store if available
  if (storeInstance) {
    return storeInstance;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();

  // Local reactive state
  const columns = ref<Map<string, BoardColumnState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());

  // Create a new board column
  const createColumn = async (name: string): Promise<string | null> => {
    const tempId = `temp-${Date.now()}`;

    const optimisticColumn: BoardColumnState = {
      id: tempId,
      userId: "", // Will be set by server
      name,
      order: columns.value.size,
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
      const result = await $api.boardColumns.create({ name });

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

    // Optimistic delete
    columns.value.delete(id);
    await deleteColumnFromIndexedDB(id);

    try {
      const result: Result<unknown, APIError> = await $api.boardColumns.delete(id);

      if (!result.success) {
        // Rollback
        columns.value.set(id, originalColumn);
        await saveColumnToIndexedDB(originalColumn);
        toast.add({
          title: "Error",
          description: "Failed to delete column",
          color: "error",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to delete board column:", error);
      // Rollback
      columns.value.set(id, originalColumn);
      await saveColumnToIndexedDB(originalColumn);
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
      orderedColumns.forEach((col, index) => {
        col.order = index;
        columns.value.set(col.id, col);
      });

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

      const result = await $api.boardColumns.reorder(payload);

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
    try {
      const result = await $api.boardColumns.getAll();

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

        loadingStates.value.set("global", false);
        return;
      }

      console.error("Failed to sync board columns: server returned failure", result.error);
      await loadFromIndexedDBFallback();
    } catch (error) {
      console.error("Failed to sync board columns:", error);
      await loadFromIndexedDBFallback();
    }
  };

  // Fallback to load columns from IndexedDB
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      const localColumns = await loadColumnsFromIndexedDB();

      if (localColumns.length > 0) {
        columns.value.clear();
        localColumns.forEach((col: BoardColumnState) => columns.value.set(col.id, col));

        toast.add({
          title: "Offline Mode",
          description: `Loaded ${localColumns.length} columns from local storage.`,
          color: "warning",
        });
      }
    } catch (error) {
      console.error("Failed to load columns from IndexedDB:", error);
      toast.add({
        title: "Error",
        description: "Failed to load columns from server or local storage.",
        color: "error",
      });
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  const getColumn = (id: string): BoardColumnState | null => {
    return columns.value.get(id) || null;
  };

  const getOrderedColumns = (): BoardColumnState[] => {
    return Array.from(columns.value.values()).sort((a, b) => a.order - b.order);
  };

  const store: BoardColumnsStore = {
    columns,
    loadingStates,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    syncWithServer,
    getColumn,
    getOrderedColumns,
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
export function cleanupBoardColumnsStore(): void {
  storeInstance = null;
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

async function loadColumnsFromIndexedDB(): Promise<BoardColumnState[]> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(COLUMNS_STORE)) return [];

    return await getAllRecords<BoardColumnState>(db, COLUMNS_STORE as any);
  } catch (error) {
    console.error("Failed to load columns from IndexedDB:", error);
    return [];
  }
}
