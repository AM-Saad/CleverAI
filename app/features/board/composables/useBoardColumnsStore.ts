import type { BoardColumn } from "~/shared/utils/boardColumn.contract";
import type { BoardItemState } from "~/features/board/composables/useBoardItemsStore";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { comparePosition, positionBetween } from "@@/shared/utils/position-key";
import { createClientTempId } from "~/utils/local-first/tempIds";
import {
  boardColumnDurableData,
  loadBoardColumnsProjection,
  reconcileBoardWorkspaceProjection,
} from "../repositories/boardOfflineRepository";

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
  resolveColumnId: (id: string | null) => string | null;
}

type BoardColumnsStoreInternal = BoardColumnsStore & {
  _applyOfflineIdMap?: (idMap: Record<string, string>, syncedPayload?: Record<string, unknown>, version?: number, forceDirty?: boolean) => Promise<void>;
  _applyOfflineAck?: (columnId: string, syncedPayload: Record<string, unknown>, canonical?: Record<string, unknown> | null, version?: number, forceDirty?: boolean) => Promise<void>;
  _applyOfflineFailure?: (columnId: string, status: "conflict" | "rejected", message?: string, operation?: string, rollbackData?: Record<string, unknown> | null) => Promise<void>;
  _reconcileDeletedColumn?: (columnId: string) => Promise<void>;
  _applyOfflineConflictResolution?: (columnId: string, strategy: "keep-local" | "keep-server", serverVersion: number, serverSnapshot?: Record<string, unknown> | null) => Promise<void>;
};

const BOARD_COLUMNS_STORE_FALLBACK_KEY = "__default__";
const boardColumnsStores = new Map<string, BoardColumnsStoreInternal>();
let columnRemapListenerRegistered = false;

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
  const columnIdAliases = ref<Map<string, string>>(new Map());
  const resolveColumnId = (id: string | null): string | null =>
    id ? (columnIdAliases.value.get(id) ?? id) : null;
  const columnMatchesPayload = (
    column: BoardColumnState,
    payload?: Record<string, unknown>,
  ) =>
    Boolean(payload) && ["name", "position", "workspaceId"].every((field) =>
      !(field in payload!) ||
      (column as unknown as Record<string, unknown>)[field] === payload![field],
    );
  const applyOfflineIdMap = async (
    idMap: Record<string, string>,
    syncedPayload?: Record<string, unknown>,
    version?: number,
    forceDirty = false,
  ): Promise<void> => {
    const nextAliases = new Map(columnIdAliases.value);
    for (const [tempId, serverId] of Object.entries(idMap)) {
      nextAliases.set(tempId, serverId);
      const tempColumn = columns.value.get(tempId);
      if (!tempColumn) continue;
      const serverColumn: BoardColumnState = {
        ...tempColumn,
        id: serverId,
        ...(version !== undefined && { offlineRevision: version }),
        isDirty: forceDirty || !columnMatchesPayload(tempColumn, syncedPayload),
        isLoading: false,
        lastSaved: new Date(),
        error: null,
      };
      columns.value.delete(tempId);
      columns.value.set(serverId, serverColumn);
    }
    columnIdAliases.value = nextAliases;
  };
  const applyOfflineAck = async (
    columnId: string,
    syncedPayload: Record<string, unknown>,
    canonical?: Record<string, unknown> | null,
    version?: number,
    forceDirty = false,
  ): Promise<void> => {
    const column = columns.value.get(columnId);
    if (!column) return;
    const values = column as unknown as Record<string, unknown>;
    const matches = ["name", "position"].every((field) =>
      !(field in syncedPayload) || values[field] === syncedPayload[field],
    );
    const next: BoardColumnState = {
      ...column,
      ...(matches && !forceDirty && canonical ? canonical : {}),
      id: columnId,
      ...(version !== undefined && { offlineRevision: version }),
      isDirty: forceDirty || !matches,
      isLoading: false,
      lastSaved: new Date(),
      error: null,
    } as BoardColumnState;
    columns.value.set(columnId, next);
  };
  const applyOfflineFailure = async (
    columnId: string,
    status: "conflict" | "rejected",
    message?: string,
    operation?: string,
    rollbackData?: Record<string, unknown> | null,
  ): Promise<void> => {
    const resolvedId = resolveColumnId(columnId) ?? columnId;
    if (status === "rejected") {
      if (rollbackData) {
        const restored = {
          ...rollbackData,
          id: resolvedId,
          isDirty: false,
          isLoading: false,
          error: null,
        } as BoardColumnState;
        columns.value.set(resolvedId, restored);
      } else if (operation?.endsWith(".create")) {
        columns.value.delete(resolvedId);
      }
      if (operation?.endsWith(".delete")) void itemsStore.syncWithServer();
      toast.add({
        title: "Board column change rejected",
        description: message ?? "The previous saved version was restored.",
        color: "error",
      });
      return;
    }

    const current = columns.value.get(resolvedId);
    if (!current) return;
    const next: BoardColumnState = {
      ...current,
      isDirty: true,
      isLoading: false,
      error: "Sync conflict detected. Resolve the local and server versions in Sync Center.",
    };
    columns.value.set(resolvedId, next);
  };
  const applyOfflineConflictResolution = async (
    columnId: string,
    strategy: "keep-local" | "keep-server",
    serverVersion: number,
    serverSnapshot?: Record<string, unknown> | null,
  ) => {
    const resolvedId = resolveColumnId(columnId) ?? columnId;
    if (strategy === "keep-server") {
      if (!serverSnapshot) {
        columns.value.delete(resolvedId);
        await itemsStore.syncWithServer();
        return;
      }
      columns.value.set(resolvedId, {
        ...serverSnapshot,
        id: resolvedId,
        offlineRevision: serverVersion,
        isDirty: false,
        isLoading: false,
        error: null,
        lastSaved: new Date(),
      } as BoardColumnState);
      // A pending column delete projects its cards as uncategorized in memory
      // but intentionally leaves their cache rows canonical. Rehydrate those
      // rows when the user discards the delete conflict.
      await itemsStore.syncWithServer();
      return;
    }
    const current = columns.value.get(resolvedId);
    if (current)
      columns.value.set(resolvedId, {
        ...current,
        offlineRevision: serverVersion,
        isDirty: true,
        isLoading: false,
        error: null,
      });
  };
  if (import.meta.client && !columnRemapListenerRegistered) {
    columnRemapListenerRegistered = true;
    window.addEventListener("offline-v2-board-column-id-remapped", (event) => {
      const detail = (event as CustomEvent<{ idMap?: Record<string, string>; syncedPayload?: Record<string, unknown>; version?: number; forceDirty?: boolean }>).detail;
      if (!detail?.idMap) return;
      void Promise.all(Array.from(boardColumnsStores.values()).map((store) =>
        store._applyOfflineIdMap?.(detail.idMap!, detail.syncedPayload, detail.version, detail.forceDirty),
      ));
    });
    window.addEventListener("offline-v2-board-column-applied", (event) => {
      const detail = (event as CustomEvent<{ columnId?: string; operation?: string; syncedPayload?: Record<string, unknown>; canonical?: Record<string, unknown> | null; version?: number; forceDirty?: boolean }>).detail;
      if (!detail?.columnId || !detail.syncedPayload) return;
      void Promise.all(Array.from(boardColumnsStores.values()).map(async (store) => {
        if (detail.operation?.endsWith(".delete")) {
          await store._reconcileDeletedColumn?.(detail.columnId!);
          return;
        }
        await store._applyOfflineAck?.(detail.columnId!, detail.syncedPayload!, detail.canonical, detail.version, detail.forceDirty);
      }));
    });
    window.addEventListener("offline-v2-sync-result", (event) => {
      const detail = (event as CustomEvent<{ entity?: string; entityId?: string; status?: string; message?: string; operation?: string; rollbackData?: Record<string, unknown> | null }>).detail;
      if (detail?.entity !== "boardColumn" || !detail.entityId || (detail.status !== "conflict" && detail.status !== "rejected")) return;
      void Promise.all(Array.from(boardColumnsStores.values()).map((store) =>
        store._applyOfflineFailure?.(detail.entityId!, detail.status as "conflict" | "rejected", detail.message, detail.operation, detail.rollbackData),
      ));
    });
    window.addEventListener("offline-v2-board-conflict-resolved", (event) => {
      const detail = (event as CustomEvent<{ entity?: string; entityId?: string; strategy?: "keep-local" | "keep-server"; serverVersion?: number; serverSnapshot?: Record<string, unknown> | null }>).detail;
      if (detail?.entity !== "boardColumn" || !detail.entityId || !detail.strategy) return;
      void Promise.all(Array.from(boardColumnsStores.values()).map((store) =>
        store._applyOfflineConflictResolution?.(
          detail.entityId!,
          detail.strategy!,
          detail.serverVersion ?? 0,
          detail.serverSnapshot,
        ),
      ));
    });
  }

  // Create a new board column
  const createColumn = async (name: string): Promise<string | null> => {
    const tempId = createClientTempId("board-column");
    const lastPosition = Array.from(columns.value.values())
      .sort((left, right) => (left.position ?? "").localeCompare(right.position ?? ""))
      .at(-1)?.position;
    const optimisticColumn: BoardColumnState = {
      id: tempId,
      userId: "",
      name,
      order: columns.value.size,
      position: positionBetween(lastPosition, null),
      workspaceId: workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLoading: false,
      isDirty: true,
      error: null,
    };
    columns.value.set(tempId, optimisticColumn);
    try {
      await offline.queue({
        entity: "boardColumn",
        operation: "boardColumn.create",
        entityId: tempId,
        workspaceId,
        changedFields: ["name", "workspaceId", "position"],
        payload: { name, workspaceId: workspaceId ?? null, position: optimisticColumn.position },
        localData: boardColumnDurableData(
          optimisticColumn as unknown as Record<string, unknown> & { id: string },
        ),
      });
      return tempId;
    } catch (error) {
      columns.value.delete(tempId);
      console.error("Failed to queue Board column creation:", error);
      return null;
    }
  };

  // Update board column name
  const updateColumn = async (rawId: string, name: string): Promise<boolean> => {
    const id = resolveColumnId(rawId) ?? rawId;
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
    try {
      await offline.queue({
        entity: "boardColumn",
        operation: "boardColumn.update",
        entityId: id,
        workspaceId: originalColumn.workspaceId ?? workspaceId,
        baseVersion: originalColumn.offlineRevision ?? 0,
        changedFields: ["name"],
        payload: { name },
        localData: boardColumnDurableData(
          updatedColumn as unknown as Record<string, unknown> & { id: string },
        ),
        rollbackData: originalColumn as unknown as Record<string, unknown>,
      });
      return true;
    } catch (error) {
      columns.value.set(id, originalColumn);
      console.error("Failed to persist Board column update:", error);
      return false;
    }
  };

  // Delete board column
  const deleteColumn = async (rawId: string): Promise<boolean> => {
    const id = resolveColumnId(rawId) ?? rawId;
    const originalColumn = columns.value.get(id);
    if (!originalColumn) return false;
    const cancelsPendingLocalCreate = (await offline.mutationsList()).some((mutation) =>
      mutation.entity === "boardColumn" &&
      mutation.entityId === id &&
      mutation.operation.endsWith(".create") &&
      ["pending", "retry"].includes(mutation.status),
    );

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

    // Optimistic projection. Keep the canonical column row until V2
    // acknowledges the delete so a definitive rejection can restore it.
    columns.value.delete(id);
    try {
      await offline.queue({
        entity: "boardColumn",
        operation: "boardColumn.delete",
        entityId: id,
        workspaceId: originalColumn.workspaceId ?? workspaceId,
        baseVersion: originalColumn.offlineRevision ?? 0,
        changedFields: ["deleted"],
        payload: {},
        rollbackData: originalColumn as unknown as Record<string, unknown>,
      });
      // A pending local create followed by delete collapses to no column
      // command. Its dependent card commands are cancelled too, so immediately
      // persist and re-queue the cards in their visible uncategorized state.
      if (cancelsPendingLocalCreate && normalizedUncategorizedItems.length) {
        await itemsStore.persistAndQueueItems?.(normalizedUncategorizedItems);
      }
      return true;
    } catch (error) {
      columns.value.set(id, originalColumn);
      applyItemsSnapshot(originalItems);
      if (cancelsPendingLocalCreate) {
        try {
          await offline.queue({
            entity: "boardColumn",
            operation: "boardColumn.create",
            entityId: id,
            workspaceId: originalColumn.workspaceId ?? workspaceId,
            changedFields: ["name", "workspaceId", "position"],
            payload: {
              name: originalColumn.name,
              workspaceId: originalColumn.workspaceId ?? workspaceId ?? null,
              position: originalColumn.position,
            },
            localData: boardColumnDurableData(
              originalColumn as unknown as Record<string, unknown> & { id: string },
            ),
            deferSync: true,
          });
          const originalAffectedItems = originalItems.filter((item) =>
            affectedItemIds.has(item.id),
          );
          await itemsStore.persistAndQueueItems?.(originalAffectedItems);
        } catch (rollbackError) {
          console.error("Failed to restore cancelled local column commands:", rollbackError);
        }
      }
      console.error("Failed to queue Board column delete:", error);
      return false;
    }
  };

  // Reorder board columns
  const reorderColumns = async (orderedColumns: BoardColumnState[]): Promise<boolean> => {
    orderedColumns = orderedColumns.map((column) => {
      const id = resolveColumnId(column.id) ?? column.id;
      return columns.value.get(id) ?? { ...column, id };
    });
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

      for (const column of orderedColumns) {
        const previous = originalColumns.get(column.id);
        await offline.queue({
          entity: "boardColumn",
          operation: "boardColumn.update",
          entityId: column.id,
          workspaceId: column.workspaceId ?? workspaceId,
          baseVersion: previous?.offlineRevision ?? column.offlineRevision ?? 0,
          changedFields: ["position"],
          payload: { position: column.position! },
          localData: boardColumnDurableData(
            column as unknown as Record<string, unknown> & { id: string },
          ),
          rollbackData: previous as unknown as Record<string, unknown> | undefined,
          deferSync: true,
        });
      }
      if (networkMonitor.isVerifiedOnline.value) void offline.sync();
      return true;
    } catch (error) {
      // Some earlier entries may already be durable. Re-project the exact
      // generic state instead of rolling memory behind queued commands.
      await loadFromIndexedDBFallback();
      console.error("Failed to persist Board column reorder:", error);
      return false;
    }
  };

  const columnProjectionKey = (column: BoardColumnState) =>
    JSON.stringify({
      name: column.name,
      workspaceId: column.workspaceId ?? null,
      position: column.position,
    });
  let syncWithServerPromise: Promise<void> | null = null;

  // IDB-first, single-flight, and authoritative for clean rows. Active V2
  // commands and edits that race the request are overlaid transactionally.
  const syncWithServer = (): Promise<void> => {
    if (syncWithServerPromise) return syncWithServerPromise;
    const run = (async () => {
      loadingStates.value.set("global", true);
      try {
        await loadFromIndexedDBFallback();
        if (!networkMonitor.isVerifiedOnline.value) return;
        await offline.sync();
        await loadFromIndexedDBFallback();

        const requestSnapshot = new Map(
          Array.from(columns.value, ([id, column]) => [id, { ...column }]),
        );
        const result = await $api.boardColumns.getAll(workspaceId);
        if (!result.success || !offline.accountId.value) return;

        const atResponse = new Map(
          Array.from(columns.value, ([id, column]) => [id, { ...column }]),
        );
        const volatileColumns = Array.from(atResponse.values()).filter((column) => {
          const before = requestSnapshot.get(column.id);
          return !before || columnProjectionKey(before) !== columnProjectionKey(column);
        });
        const volatileDeletedIds = Array.from(requestSnapshot.keys()).filter(
          (id) => !atResponse.has(id),
        );
        const serverColumns: BoardColumnState[] = result.data.map((column: BoardColumn) => ({
          ...column,
          isLoading: false,
          isDirty: false,
          lastSaved: new Date(),
          error: null,
        }));
        const projection = await reconcileBoardWorkspaceProjection({
          accountId: offline.accountId.value,
          workspaceId,
          entity: "boardColumn",
          serverRecords: serverColumns,
          volatileRecords: volatileColumns,
          volatileDeletedIds,
        });

        const afterPersistence = new Map(columns.value);
        const final = new Map(projection.map((column) => [column.id, column]));
        for (const [id, column] of afterPersistence) {
          const before = atResponse.get(id);
          if (!before || columnProjectionKey(before) !== columnProjectionKey(column))
            final.set(id, column);
        }
        for (const id of atResponse.keys()) {
          if (!afterPersistence.has(id)) final.delete(id);
        }
        columns.value = final;
        lastSync.value = new Date();
      } catch (error) {
        console.error("Failed to sync board columns:", error);
      } finally {
        loadingStates.value.set("global", false);
      }
    })();
    syncWithServerPromise = run.finally(() => {
      syncWithServerPromise = null;
    });
    return syncWithServerPromise;
  };

  // Hydrate only from the account-scoped Offline V2 projection.
  const loadFromIndexedDBFallback = async (): Promise<void> => {
    try {
      if (!offline.accountId.value) return;
      const localColumns = await loadBoardColumnsProjection({
        accountId: offline.accountId.value,
        workspaceId,
      });
      columns.value.clear();
      localColumns.forEach((column) => columns.value.set(column.id, column));
    } catch {
      // Silently fail — navbar pill already shows offline status.
    } finally {
      loadingStates.value.set("global", false);
    }
  };

  const getColumn = (id: string): BoardColumnState | null => {
    return columns.value.get(resolveColumnId(id) ?? id) || null;
  };

  const getOrderedColumns = (): BoardColumnState[] => {
    return Array.from(columns.value.values()).sort(comparePosition);
  };

  const store: BoardColumnsStoreInternal = {
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
    resolveColumnId,
    _applyOfflineIdMap: applyOfflineIdMap,
    _applyOfflineAck: applyOfflineAck,
    _applyOfflineFailure: applyOfflineFailure,
    _applyOfflineConflictResolution: applyOfflineConflictResolution,
    _reconcileDeletedColumn: async (columnId: string) => {
      columns.value.delete(columnId);
    },
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
