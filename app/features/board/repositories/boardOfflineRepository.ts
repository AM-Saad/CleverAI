import type {
  BoardItem,
  BoardItemComment,
  BoardItemLink,
} from "../../../../shared/utils/boardItem.contract";
import type { BoardColumn } from "../../../../shared/utils/boardColumn.contract";
import { positionBetween } from "../../../../shared/utils/position-key";
import { DB_CONFIG } from "../../../utils/constants/pwa";
import { openUnifiedDB, sanitizeForIDB } from "../../../utils/idb";
import type {
  OfflineEntityRecord,
  StoredOfflineMutation,
} from "../../../utils/offline-v2/types";

export type BoardProjectionEntity =
  | "boardItem"
  | "boardColumn"
  | "boardLink"
  | "boardComment";

export type BoardItemProjection = BoardItem & {
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
};

export type BoardColumnProjection = BoardColumn & {
  isLoading?: boolean;
  isDirty?: boolean;
  lastSaved?: Date;
  error?: string | null;
};

type BoardProjectionRecord = Record<string, unknown> & {
  id: string;
  workspaceId?: string | null;
  offlineRevision?: number;
  isDirty?: boolean;
};

type LegacyPendingBoardItemChange = {
  id: string;
  operation: "upsert" | "delete";
  updatedAt: number;
  localVersion: number;
  workspaceId?: string;
  userId?: string;
  columnId?: string | null;
  order?: number;
  position?: string;
  content?: string;
  tags?: string[];
  dueDate?: string | null;
  attachments?: BoardItem["attachments"];
  createdAt?: number | string;
  conflicted?: boolean;
};

const stores = DB_CONFIG.STORES;
const ACTIVE_STATUSES = new Set([
  "pending",
  "syncing",
  "retry",
  "blocked",
  "conflict",
]);
const migrationPromises = new Map<string, Promise<void>>();

const scopedId = (accountId: string, entity: BoardProjectionEntity, entityId: string) =>
  `${accountId}:${entity}:${entityId}`;

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () =>
      reject(operation.error ?? new Error("Board IndexedDB request failed"));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Board IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Board IndexedDB transaction aborted"));
  });
}

const inWorkspace = (
  record: { workspaceId?: string | null },
  workspaceId?: string,
) =>
  workspaceId === undefined
    ? record.workspaceId == null
    : record.workspaceId === workspaceId;

const isActive = (mutation: StoredOfflineMutation) =>
  ACTIVE_STATUSES.has(mutation.status);

function omitKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const next = { ...value };
  for (const key of keys) delete next[key];
  return next;
}

/** Strip reactive/view-only state before writing the authoritative projection. */
export function boardItemDurableData(
  item: BoardProjectionRecord,
): Record<string, unknown> {
  return omitKeys(item, [
    "isLoading",
    "isDirty",
    "lastSaved",
    "error",
    "isInFilteredList",
    "links",
    "linksLoading",
    "comments",
    "commentsLoading",
    "offlineRevision",
  ]);
}

export function boardColumnDurableData(
  column: BoardProjectionRecord,
): Record<string, unknown> {
  return omitKeys(column, [
    "isLoading",
    "isDirty",
    "lastSaved",
    "error",
    "offlineRevision",
  ]);
}

function durableDataForEntity(
  entity: BoardProjectionEntity,
  record: BoardProjectionRecord,
) {
  if (entity === "boardItem") return boardItemDurableData(record);
  if (entity === "boardColumn") return boardColumnDurableData(record);
  return omitKeys(record, ["offlineRevision", "isDirty", "error"]);
}

function activeForEntity(
  mutations: StoredOfflineMutation[],
  entity: BoardProjectionEntity,
  entityId: string,
) {
  return mutations.filter(
    (mutation) =>
      mutation.entity === entity &&
      mutation.entityId === entityId &&
      isActive(mutation),
  );
}

function projectedRecord<T extends BoardProjectionRecord>(
  record: OfflineEntityRecord,
  activeMutations: StoredOfflineMutation[],
): T {
  const conflict = activeMutations.find(
    (mutation) => mutation.status === "conflict",
  );
  return {
    ...(record.data as T),
    id: record.entityId,
    offlineRevision: record.version,
    isDirty: activeMutations.length > 0 || Boolean(record.localDirty),
    isLoading: false,
    error: conflict?.lastError ?? null,
    lastSaved: new Date(record.updatedAt),
  } as T;
}

function legacyItemData(
  change: LegacyPendingBoardItemChange,
  existing?: Record<string, unknown>,
) {
  const patch = Object.fromEntries(
    Object.entries({
      id: change.id,
      userId: change.userId,
      workspaceId: change.workspaceId,
      columnId: change.columnId,
      order: change.order,
      position: change.position,
      content: change.content,
      tags: change.tags,
      dueDate: change.dueDate,
      attachments: change.attachments,
      createdAt: change.createdAt,
      updatedAt: change.updatedAt,
    }).filter(([, value]) => value !== undefined),
  );
  return {
    ...(existing ?? {}),
    ...patch,
    id: change.id,
    content: change.content ?? existing?.content ?? "",
    tags: change.tags ?? existing?.tags ?? [],
    attachments: change.attachments ?? existing?.attachments ?? [],
    columnId: change.columnId ?? existing?.columnId ?? null,
    order: change.order ?? existing?.order ?? 0,
    createdAt:
      change.createdAt ?? existing?.createdAt ?? change.updatedAt,
    updatedAt: change.updatedAt,
  };
}

function boardItemMutationPayload(item: Record<string, unknown>) {
  return Object.fromEntries(
    [
      "content",
      "tags",
      "dueDate",
      "attachments",
      "columnId",
      "workspaceId",
      "order",
      "position",
    ]
      .filter((field) => item[field] !== undefined)
      .map((field) => [field, item[field]]),
  );
}

function boardColumnMutationPayload(column: Record<string, unknown>) {
  return Object.fromEntries(
    ["name", "workspaceId", "position"]
      .filter((field) => column[field] !== undefined)
      .map((field) => [field, column[field]]),
  );
}

function migratedMutation(input: {
  accountId: string;
  entity: "boardItem" | "boardColumn";
  entityId: string;
  workspaceId?: string;
  operation: string;
  payload: Record<string, unknown>;
  baseVersion?: number;
  rollbackData?: Record<string, unknown>;
  createdAt: number;
}): StoredOfflineMutation {
  return {
    id: `legacy-board-v2:${input.accountId}:${input.entity}:${input.entityId}`,
    accountId: input.accountId,
    entity: input.entity,
    operation: input.operation,
    entityId: input.entityId,
    workspaceId: input.workspaceId,
    baseVersion: input.operation.endsWith(".create")
      ? undefined
      : input.baseVersion ?? 0,
    changedFields: input.operation.endsWith(".delete")
      ? ["deleted"]
      : Object.keys(input.payload),
    payload: input.operation.endsWith(".delete") ? {} : input.payload,
    rollbackData: input.rollbackData,
    dependsOn: [],
    occurredAt: new Date(input.createdAt).toISOString(),
    createdAt: input.createdAt,
    updatedAt: Date.now(),
    attempts: 0,
    status: "pending",
    sequence: false,
    localRevision: 1,
  };
}

/**
 * One-time migration only. After this transaction, the legacy Board stores are
 * empty and every recoverable row/command lives in Offline V2.
 */
export function migrateLegacyBoardProjection(accountId: string): Promise<void> {
  const existing = migrationPromises.get(accountId);
  if (existing) return existing;
  const migration = (async () => {
    const db = await openUnifiedDB();
    const transaction = db.transaction(
      [
        stores.BOARD_ITEMS,
        stores.BOARD_COLUMNS,
        stores.PENDING_BOARD_ITEMS,
        stores.OFFLINE_ENTITIES,
        stores.OFFLINE_MUTATIONS,
        stores.OFFLINE_LEGACY_RECOVERY,
      ],
      "readwrite",
    );
    const itemsStore = transaction.objectStore(stores.BOARD_ITEMS);
    const columnsStore = transaction.objectStore(stores.BOARD_COLUMNS);
    const pendingStore = transaction.objectStore(stores.PENDING_BOARD_ITEMS);
    const entityStore = transaction.objectStore(stores.OFFLINE_ENTITIES);
    const mutationStore = transaction.objectStore(stores.OFFLINE_MUTATIONS);
    const markerStore = transaction.objectStore(stores.OFFLINE_LEGACY_RECOVERY);
    const markerId = `${accountId}:board-projection-v2`;
    const [marker, legacyItems, legacyColumns, pendingChanges, entities, mutations] =
      await Promise.all([
        request(markerStore.get(markerId)),
        request(itemsStore.getAll()) as Promise<BoardProjectionRecord[]>,
        request(columnsStore.getAll()) as Promise<BoardProjectionRecord[]>,
        request(pendingStore.getAll()) as Promise<LegacyPendingBoardItemChange[]>,
        request(entityStore.getAll()) as Promise<OfflineEntityRecord[]>,
        request(mutationStore.getAll()) as Promise<StoredOfflineMutation[]>,
      ]);
    if (
      marker &&
      legacyItems.length === 0 &&
      legacyColumns.length === 0 &&
      pendingChanges.length === 0
    ) {
      await complete(transaction);
      return;
    }
    const accountEntities = new Map(
      entities
        .filter((record) => record.accountId === accountId)
        .map((record) => [record.id, record]),
    );
    const accountMutations = mutations.filter(
      (mutation) => mutation.accountId === accountId,
    );
    const pendingLegacyItemIds = new Set(
      pendingChanges.map((change) => change.id),
    );
    const belongsToAccount = (record: BoardProjectionRecord) =>
      !record.userId || record.userId === accountId;

    for (const item of legacyItems.filter(belongsToAccount)) {
      const key = scopedId(accountId, "boardItem", item.id);
      const current = accountEntities.get(key);
      const hasMutation = activeForEntity(
        accountMutations,
        "boardItem",
        item.id,
      ).length > 0;
      if (
        !current ||
        (item.isDirty && !hasMutation && !pendingLegacyItemIds.has(item.id))
      ) {
        const data = boardItemDurableData(item);
        const record: OfflineEntityRecord = {
          id: key,
          accountId,
          entity: "boardItem",
          entityId: item.id,
          workspaceId:
            typeof item.workspaceId === "string" ? item.workspaceId : undefined,
          version: Number(item.offlineRevision ?? current?.version ?? 0),
          updatedAt: Date.now(),
          deleted: false,
          localDirty: false,
          data,
        };
        entityStore.put(sanitizeForIDB(record));
        accountEntities.set(key, record);
        if (item.isDirty && !hasMutation && !pendingLegacyItemIds.has(item.id)) {
          const create = /^(temp-|local:)/.test(item.id);
          const mutation = migratedMutation({
            accountId,
            entity: "boardItem",
            entityId: item.id,
            workspaceId: record.workspaceId,
            operation: create ? "boardItem.create" : "boardItem.update",
            payload: boardItemMutationPayload(data),
            baseVersion: record.version,
            rollbackData: create ? undefined : current?.data,
            createdAt: Date.now(),
          });
          mutationStore.put(sanitizeForIDB(mutation));
          accountMutations.push(mutation);
        }
      }
    }

    for (const column of legacyColumns.filter(belongsToAccount)) {
      const key = scopedId(accountId, "boardColumn", column.id);
      const current = accountEntities.get(key);
      const hasMutation = activeForEntity(
        accountMutations,
        "boardColumn",
        column.id,
      ).length > 0;
      if (!current || (column.isDirty && !hasMutation)) {
        const data = boardColumnDurableData(column);
        const record: OfflineEntityRecord = {
          id: key,
          accountId,
          entity: "boardColumn",
          entityId: column.id,
          workspaceId:
            typeof column.workspaceId === "string"
              ? column.workspaceId
              : undefined,
          version: Number(column.offlineRevision ?? current?.version ?? 0),
          updatedAt: Date.now(),
          deleted: false,
          localDirty: false,
          data,
        };
        entityStore.put(sanitizeForIDB(record));
        accountEntities.set(key, record);
        if (column.isDirty && !hasMutation) {
          const create = /^(temp-|local:)/.test(column.id);
          const mutation = migratedMutation({
            accountId,
            entity: "boardColumn",
            entityId: column.id,
            workspaceId: record.workspaceId,
            operation: create ? "boardColumn.create" : "boardColumn.update",
            payload: boardColumnMutationPayload(data),
            baseVersion: record.version,
            rollbackData: create ? undefined : current?.data,
            createdAt: Date.now(),
          });
          mutationStore.put(sanitizeForIDB(mutation));
          accountMutations.push(mutation);
        }
      }
    }

    for (const change of pendingChanges) {
      if (change.userId && change.userId !== accountId) continue;
      if (
        activeForEntity(accountMutations, "boardItem", change.id).length > 0
      )
        continue;
      const key = scopedId(accountId, "boardItem", change.id);
      const current = accountEntities.get(key);
      const data = legacyItemData(change, current?.data);
      const create = /^(temp-|local:)/.test(change.id) &&
        change.operation !== "delete";
      const mutation = migratedMutation({
        accountId,
        entity: "boardItem",
        entityId: change.id,
        workspaceId:
          change.workspaceId ?? current?.workspaceId,
        operation:
          change.operation === "delete"
            ? "boardItem.delete"
            : create
              ? "boardItem.create"
              : "boardItem.update",
        payload: boardItemMutationPayload(data),
        baseVersion: current?.version ?? 0,
        rollbackData: create ? undefined : current?.data,
        createdAt: change.updatedAt,
      });
      mutationStore.put(sanitizeForIDB(mutation));
      accountMutations.push(mutation);
      if (change.operation === "delete") {
        if (current)
          entityStore.put(
            sanitizeForIDB({
              ...current,
              deleted: true,
              updatedAt: Date.now(),
            }),
          );
      } else {
        const record: OfflineEntityRecord = {
          id: key,
          accountId,
          entity: "boardItem",
          entityId: change.id,
          workspaceId: change.workspaceId ?? current?.workspaceId,
          version: current?.version ?? 0,
          updatedAt: Date.now(),
          deleted: false,
          localDirty: false,
          data,
        };
        entityStore.put(sanitizeForIDB(record));
        accountEntities.set(key, record);
      }
    }

    // These stores remain in the schema only so older databases can be read by
    // this migration. They are never used as active Board caches after it.
    itemsStore.clear();
    columnsStore.clear();
    pendingStore.clear();
    markerStore.put(
      sanitizeForIDB({
        id: markerId,
        accountId,
        kind: "board-projection-v2",
        migratedAt: Date.now(),
      }),
    );
    await complete(transaction);
  })().catch((error) => {
    migrationPromises.delete(accountId);
    throw error;
  });
  migrationPromises.set(accountId, migration);
  return migration;
}

export async function putBoardProjectionRecord(input: {
  accountId: string;
  entity: "boardItem" | "boardColumn";
  record: BoardProjectionRecord;
}): Promise<void> {
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(stores.OFFLINE_ENTITIES, "readwrite");
  const store = transaction.objectStore(stores.OFFLINE_ENTITIES);
  const key = scopedId(input.accountId, input.entity, input.record.id);
  const current = (await request(store.get(key))) as
    | OfflineEntityRecord
    | undefined;
  store.put(
    sanitizeForIDB({
      id: key,
      accountId: input.accountId,
      entity: input.entity,
      entityId: input.record.id,
      workspaceId:
        typeof input.record.workspaceId === "string"
          ? input.record.workspaceId
          : current?.workspaceId,
      version: Number(
        input.record.offlineRevision ?? current?.version ?? 0,
      ),
      updatedAt: Date.now(),
      deleted: false,
      localDirty: Boolean(input.record.isDirty),
      data: durableDataForEntity(input.entity, input.record),
    } satisfies OfflineEntityRecord),
  );
  await complete(transaction);
}

export async function putBoardProjectionRecords(input: {
  accountId: string;
  entity: "boardItem" | "boardColumn";
  records: BoardProjectionRecord[];
}): Promise<void> {
  if (!input.records.length) return;
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(stores.OFFLINE_ENTITIES, "readwrite");
  const store = transaction.objectStore(stores.OFFLINE_ENTITIES);
  const existing = (await request(store.getAll())) as OfflineEntityRecord[];
  const currentById = new Map(
    existing
      .filter(
        (record) =>
          record.accountId === input.accountId &&
          record.entity === input.entity,
      )
      .map((record) => [record.entityId, record]),
  );
  for (const record of input.records) {
    const current = currentById.get(record.id);
    store.put(
      sanitizeForIDB({
        id: scopedId(input.accountId, input.entity, record.id),
        accountId: input.accountId,
        entity: input.entity,
        entityId: record.id,
        workspaceId:
          typeof record.workspaceId === "string"
            ? record.workspaceId
            : current?.workspaceId,
        version: Number(record.offlineRevision ?? current?.version ?? 0),
        updatedAt: Date.now(),
        deleted: false,
        localDirty: Boolean(record.isDirty),
        data: durableDataForEntity(input.entity, record),
      } satisfies OfflineEntityRecord),
    );
  }
  await complete(transaction);
}

export async function loadBoardItemsProjection(input: {
  accountId: string;
  workspaceId?: string;
}): Promise<BoardItemProjection[]> {
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readonly",
  );
  const [entities, mutations] = await Promise.all([
    request(transaction.objectStore(stores.OFFLINE_ENTITIES).getAll()) as Promise<
      OfflineEntityRecord[]
    >,
    request(transaction.objectStore(stores.OFFLINE_MUTATIONS).getAll()) as Promise<
      StoredOfflineMutation[]
    >,
  ]);
  await complete(transaction);
  const accountMutations = mutations.filter(
    (mutation) => mutation.accountId === input.accountId && isActive(mutation),
  );
  const pendingColumnDeletes = new Set(
    accountMutations
      .filter(
        (mutation) =>
          mutation.entity === "boardColumn" &&
          mutation.operation.endsWith(".delete") &&
          mutation.workspaceId === input.workspaceId,
      )
      .map((mutation) => mutation.entityId),
  );
  const records = entities
    .filter(
      (record) =>
        record.accountId === input.accountId &&
        record.entity === "boardItem" &&
        inWorkspace(record, input.workspaceId) &&
        !record.deleted,
    )
    .filter(
      (record) =>
        !activeForEntity(accountMutations, "boardItem", record.entityId).some(
          (mutation) => mutation.operation.endsWith(".delete"),
        ),
    )
    .map((record) =>
      projectedRecord<BoardItemProjection>(
        record,
        activeForEntity(accountMutations, "boardItem", record.entityId),
      ),
    );
  const unaffected = records.filter(
    (item) => !pendingColumnDeletes.has(item.columnId ?? ""),
  );
  const moved = records
    .filter((item) => pendingColumnDeletes.has(item.columnId ?? ""))
    .sort((left, right) => (left.position ?? "").localeCompare(right.position ?? ""));
  const uncategorized = unaffected
    .filter((item) => item.columnId == null)
    .sort((left, right) => (left.position ?? "").localeCompare(right.position ?? ""));
  const categorized = unaffected.filter((item) => item.columnId != null);
  let previousPosition: string | undefined;
  const projectedUncategorized = [...uncategorized, ...moved].map(
    (item, order) => {
      if (pendingColumnDeletes.size === 0) return item;
      const position = positionBetween(previousPosition, null);
      previousPosition = position;
      return { ...item, columnId: null, order, position, isDirty: true };
    },
  );
  return [...categorized, ...projectedUncategorized];
}

export async function loadBoardColumnsProjection(input: {
  accountId: string;
  workspaceId?: string;
}): Promise<BoardColumnProjection[]> {
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readonly",
  );
  const [entities, mutations] = await Promise.all([
    request(transaction.objectStore(stores.OFFLINE_ENTITIES).getAll()) as Promise<
      OfflineEntityRecord[]
    >,
    request(transaction.objectStore(stores.OFFLINE_MUTATIONS).getAll()) as Promise<
      StoredOfflineMutation[]
    >,
  ]);
  await complete(transaction);
  const accountMutations = mutations.filter(
    (mutation) => mutation.accountId === input.accountId && isActive(mutation),
  );
  return entities
    .filter(
      (record) =>
        record.accountId === input.accountId &&
        record.entity === "boardColumn" &&
        inWorkspace(record, input.workspaceId) &&
        !record.deleted,
    )
    .filter(
      (record) =>
        !activeForEntity(accountMutations, "boardColumn", record.entityId).some(
          (mutation) => mutation.operation.endsWith(".delete"),
        ),
    )
    .map((record) =>
      projectedRecord<BoardColumnProjection>(
        record,
        activeForEntity(accountMutations, "boardColumn", record.entityId),
      ),
    );
}

/**
 * Authoritative replacement for one Board workspace. Only Offline V2 stores
 * participate, so refresh cannot leave a second durable cache behind.
 */
export async function reconcileBoardWorkspaceProjection<
  T extends BoardProjectionRecord,
>(input: {
  accountId: string;
  workspaceId?: string;
  entity: "boardItem" | "boardColumn";
  serverRecords: T[];
  volatileRecords?: T[];
  volatileDeletedIds?: string[];
}): Promise<T[]> {
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readwrite",
  );
  const entityStore = transaction.objectStore(stores.OFFLINE_ENTITIES);
  const mutationStore = transaction.objectStore(stores.OFFLINE_MUTATIONS);
  const [allEntities, allMutations] = await Promise.all([
    request(entityStore.getAll()) as Promise<OfflineEntityRecord[]>,
    request(mutationStore.getAll()) as Promise<StoredOfflineMutation[]>,
  ]);
  const local = allEntities.filter(
    (record) =>
      record.accountId === input.accountId &&
      record.entity === input.entity &&
      inWorkspace(record, input.workspaceId),
  );
  const localById = new Map(local.map((record) => [record.entityId, record]));
  const activeMutations = allMutations.filter(
    (mutation) =>
      mutation.accountId === input.accountId &&
      mutation.entity === input.entity &&
      isActive(mutation) &&
      (mutation.workspaceId === input.workspaceId ||
        localById.has(mutation.entityId)),
  );
  const activeByEntity = new Map<string, StoredOfflineMutation[]>();
  for (const mutation of activeMutations) {
    const list = activeByEntity.get(mutation.entityId) ?? [];
    list.push(mutation);
    activeByEntity.set(mutation.entityId, list);
  }
  const desired = new Map<string, OfflineEntityRecord>();
  for (const serverRecord of input.serverRecords) {
    desired.set(serverRecord.id, {
      id: scopedId(input.accountId, input.entity, serverRecord.id),
      accountId: input.accountId,
      entity: input.entity,
      entityId: serverRecord.id,
      workspaceId: input.workspaceId,
      version: Number(serverRecord.offlineRevision ?? 0),
      updatedAt: Date.now(),
      deleted: false,
      localDirty: false,
      data: durableDataForEntity(input.entity, serverRecord),
    });
  }
  for (const [entityId, mutations] of activeByEntity) {
    if (mutations.some((mutation) => mutation.operation.endsWith(".delete"))) {
      desired.delete(entityId);
      continue;
    }
    const current = localById.get(entityId);
    if (current) desired.set(entityId, { ...current, deleted: false });
  }
  // A draft write can exist briefly before its keyed committer reaches the
  // outbox. It is still authoritative local intent and must survive refresh.
  for (const current of local) {
    if (current.localDirty && !activeByEntity.has(current.entityId))
      desired.set(current.entityId, { ...current, deleted: false });
  }
  for (const record of input.volatileRecords ?? []) {
    const current = localById.get(record.id);
    desired.set(record.id, {
      id: scopedId(input.accountId, input.entity, record.id),
      accountId: input.accountId,
      entity: input.entity,
      entityId: record.id,
      workspaceId: input.workspaceId,
      version: Number(record.offlineRevision ?? current?.version ?? 0),
      updatedAt: Date.now(),
      deleted: false,
      localDirty: true,
      data: durableDataForEntity(input.entity, record),
    });
  }
  for (const id of input.volatileDeletedIds ?? []) desired.delete(id);

  for (const current of local) {
    if (desired.has(current.entityId)) continue;
    entityStore.put(
      sanitizeForIDB({ ...current, deleted: true, updatedAt: Date.now() }),
    );
  }
  for (const record of desired.values())
    entityStore.put(sanitizeForIDB(record));
  await complete(transaction);

  return Array.from(desired.values()).map((record) =>
    projectedRecord<T>(record, activeByEntity.get(record.entityId) ?? []),
  );
}

function relationMatchesItem(
  entity: "boardLink" | "boardComment",
  data: Record<string, unknown>,
  itemId: string,
) {
  return entity === "boardComment"
    ? data.itemId === itemId
    : data.sourceId === itemId || data.targetId === itemId;
}

/** Seed/reconcile relation revisions from an ordinary detail-panel GET. */
export async function reconcileBoardRelationsForItem<
  T extends BoardItemLink | BoardItemComment,
>(input: {
  accountId: string;
  workspaceId?: string;
  itemId: string;
  entity: "boardLink" | "boardComment";
  serverRecords: T[];
}): Promise<T[]> {
  await migrateLegacyBoardProjection(input.accountId);
  const db = await openUnifiedDB();
  const transaction = db.transaction(
    [stores.OFFLINE_ENTITIES, stores.OFFLINE_MUTATIONS],
    "readwrite",
  );
  const entityStore = transaction.objectStore(stores.OFFLINE_ENTITIES);
  const mutationStore = transaction.objectStore(stores.OFFLINE_MUTATIONS);
  const [entities, mutations] = await Promise.all([
    request(entityStore.getAll()) as Promise<OfflineEntityRecord[]>,
    request(mutationStore.getAll()) as Promise<StoredOfflineMutation[]>,
  ]);
  const local = entities.filter(
    (record) =>
      record.accountId === input.accountId &&
      record.entity === input.entity &&
      relationMatchesItem(input.entity, record.data, input.itemId),
  );
  const localById = new Map(local.map((record) => [record.entityId, record]));
  const active = mutations.filter(
    (mutation) =>
      mutation.accountId === input.accountId &&
      mutation.entity === input.entity &&
      isActive(mutation) &&
      (localById.has(mutation.entityId) ||
        relationMatchesItem(input.entity, mutation.payload, input.itemId)),
  );
  const activeById = new Map<string, StoredOfflineMutation[]>();
  for (const mutation of active) {
    const list = activeById.get(mutation.entityId) ?? [];
    list.push(mutation);
    activeById.set(mutation.entityId, list);
  }
  const desired = new Map<string, OfflineEntityRecord>();
  for (const serverRecord of input.serverRecords) {
    desired.set(serverRecord.id, {
      id: scopedId(input.accountId, input.entity, serverRecord.id),
      accountId: input.accountId,
      entity: input.entity,
      entityId: serverRecord.id,
      workspaceId: input.workspaceId,
      version: Number(serverRecord.offlineRevision ?? 0),
      updatedAt: Date.now(),
      deleted: false,
      localDirty: false,
      data: durableDataForEntity(
        input.entity,
        serverRecord as unknown as BoardProjectionRecord,
      ),
    });
  }
  for (const [entityId, entityMutations] of activeById) {
    if (
      entityMutations.some((mutation) =>
        mutation.operation.endsWith(".delete"),
      )
    ) {
      desired.delete(entityId);
      continue;
    }
    const current = localById.get(entityId);
    if (current) desired.set(entityId, { ...current, deleted: false });
  }
  for (const current of local) {
    if (desired.has(current.entityId)) continue;
    entityStore.put(
      sanitizeForIDB({ ...current, deleted: true, updatedAt: Date.now() }),
    );
  }
  for (const record of desired.values())
    entityStore.put(sanitizeForIDB(record));
  await complete(transaction);
  return Array.from(desired.values()).map((record) => ({
    ...(record.data as T),
    id: record.entityId,
    offlineRevision: record.version,
  }));
}
