import { ObjectId } from "mongodb";

type MongoId = { $oid: string };

export function isDuplicateKeyError(error: unknown) {
  const candidate = error as { code?: number; message?: string };
  return candidate?.code === 11000 || /duplicate key/i.test(String(candidate?.message));
}

function oid(id?: string | null): MongoId | null {
  return id ? { $oid: id } : null;
}

function newOid(): MongoId {
  return { $oid: new ObjectId().toHexString() };
}

function idToString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "object" && "$oid" in value) {
    return String((value as MongoId).$oid);
  }
  return String(value);
}

function normalizeDoc<T extends Record<string, any>>(doc: T | null | undefined) {
  if (!doc) return null;
  return {
    ...doc,
    id: idToString(doc._id),
    userId: idToString(doc.userId),
    workspaceId: doc.workspaceId ? idToString(doc.workspaceId) : doc.workspaceId,
    accountId: doc.accountId ? idToString(doc.accountId) : doc.accountId,
    mappingId: doc.mappingId ? idToString(doc.mappingId) : doc.mappingId,
    itemId: doc.itemId ? idToString(doc.itemId) : doc.itemId,
    targetGroupId: doc.targetGroupId ? idToString(doc.targetGroupId) : doc.targetGroupId,
    targetId: doc.targetId ? idToString(doc.targetId) : doc.targetId,
  };
}

function normalizeDocs<T extends Record<string, any>>(docs: T[]) {
  return docs.map((doc) => normalizeDoc(doc));
}

async function findMany(prisma: any, collection: string, filter: Record<string, unknown>, sort?: Record<string, 1 | -1>) {
  const result = await prisma.$runCommandRaw({
    find: collection,
    filter,
    ...(sort ? { sort } : {}),
  }) as any;
  return normalizeDocs(result.cursor?.firstBatch ?? []);
}

async function findOne(prisma: any, collection: string, filter: Record<string, unknown>) {
  const docs = await findMany(prisma, collection, filter);
  return docs[0] ?? null;
}

async function insertOne(prisma: any, collection: string, document: Record<string, unknown>) {
  const now = new Date();
  const next = {
    _id: newOid(),
    createdAt: now,
    updatedAt: now,
    ...document,
  };
  await prisma.$runCommandRaw({
    insert: collection,
    documents: [next],
  });
  return normalizeDoc(next);
}

async function updateOne(
  prisma: any,
  collection: string,
  filter: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  await prisma.$runCommandRaw({
    update: collection,
    updates: [{
      q: filter,
      u: { $set: { ...data, updatedAt: new Date() } },
      multi: false,
    }],
  });
  return findOne(prisma, collection, filter);
}

async function deleteOne(prisma: any, collection: string, filter: Record<string, unknown>) {
  await prisma.$runCommandRaw({
    delete: collection,
    deletes: [{ q: filter, limit: 1 }],
  });
}

export const integrationRepository = {
  oid,

  async listAccounts(prisma: any, input: { userId: string; provider?: string }) {
    return findMany(
      prisma,
      "IntegrationAccount",
      {
        userId: oid(input.userId),
        ...(input.provider ? { provider: input.provider } : {}),
      },
      { updatedAt: -1 },
    );
  },

  async findAccount(prisma: any, input: { id?: string; userId: string; provider?: string; externalAccountId?: string }) {
    return findOne(prisma, "IntegrationAccount", {
      ...(input.id ? { _id: oid(input.id) } : {}),
      userId: oid(input.userId),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.externalAccountId ? { externalAccountId: input.externalAccountId } : {}),
    });
  },

  async upsertAccount(prisma: any, input: {
    userId: string;
    provider: string;
    externalAccountId: string;
    data: Record<string, unknown>;
  }) {
    const filter = {
      userId: oid(input.userId),
      provider: input.provider,
      externalAccountId: input.externalAccountId,
    };
    const existing = await findOne(prisma, "IntegrationAccount", filter);
    if (existing) return updateOne(prisma, "IntegrationAccount", filter, input.data);
    return insertOne(prisma, "IntegrationAccount", {
      ...input.data,
      userId: oid(input.userId),
      provider: input.provider,
      externalAccountId: input.externalAccountId,
    });
  },

  async deleteAccount(prisma: any, input: { id: string; userId: string }) {
    return deleteOne(prisma, "IntegrationAccount", {
      _id: oid(input.id),
      userId: oid(input.userId),
    });
  },

  async updateAccount(prisma: any, input: { id: string; userId: string; data: Record<string, unknown> }) {
    return updateOne(prisma, "IntegrationAccount", {
      _id: oid(input.id),
      userId: oid(input.userId),
    }, input.data);
  },

  async deleteAccountGraph(prisma: any, input: { id: string; userId: string }) {
    const filter = {
      accountId: oid(input.id),
      userId: oid(input.userId),
    };

    await prisma.$runCommandRaw({
      delete: "BoardItemExternalRef",
      deletes: [{ q: filter, limit: 0 }],
    });
    await prisma.$runCommandRaw({
      delete: "ExternalBoardMapping",
      deletes: [{ q: filter, limit: 0 }],
    });
    await prisma.$runCommandRaw({
      delete: "WorkspaceExternalRef",
      deletes: [{ q: filter, limit: 0 }],
    });
    await prisma.$runCommandRaw({
      delete: "ExternalWorkspaceMapping",
      deletes: [{ q: filter, limit: 0 }],
    });

    return deleteOne(prisma, "IntegrationAccount", {
      _id: oid(input.id),
      userId: oid(input.userId),
    });
  },

  async listMappings(prisma: any, input: { userId: string; workspaceId?: string }) {
    return findMany(
      prisma,
      "ExternalBoardMapping",
      {
        userId: oid(input.userId),
        ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
      },
      { updatedAt: -1 },
    );
  },

  async findMapping(prisma: any, input: { id?: string; userId: string; workspaceId?: string; provider?: string; externalContainerId?: string }) {
    return findOne(prisma, "ExternalBoardMapping", {
      ...(input.id ? { _id: oid(input.id) } : {}),
      userId: oid(input.userId),
      ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.externalContainerId ? { externalContainerId: input.externalContainerId } : {}),
    });
  },

  async upsertMapping(prisma: any, input: {
    userId: string;
    workspaceId: string;
    provider: string;
    externalContainerId: string;
    data: Record<string, unknown>;
  }) {
    const filter = {
      workspaceId: oid(input.workspaceId),
      provider: input.provider,
      externalContainerId: input.externalContainerId,
    };
    const existing = await findOne(prisma, "ExternalBoardMapping", filter);
    if (existing) return updateOne(prisma, "ExternalBoardMapping", filter, input.data);
    return insertOne(prisma, "ExternalBoardMapping", {
      ...input.data,
      userId: oid(input.userId),
      workspaceId: oid(input.workspaceId),
      provider: input.provider,
      externalContainerId: input.externalContainerId,
    });
  },

  async updateMapping(prisma: any, id: string, data: Record<string, unknown>) {
    return updateOne(prisma, "ExternalBoardMapping", { _id: oid(id) }, data);
  },

  async listItemRefs(prisma: any, input: { userId: string; itemId: string }) {
    return findMany(
      prisma,
      "BoardItemExternalRef",
      {
        userId: oid(input.userId),
        itemId: oid(input.itemId),
      },
      { updatedAt: -1 },
    );
  },

  async findItemRef(prisma: any, input: { userId: string; provider: string; externalId: string }) {
    return findOne(prisma, "BoardItemExternalRef", {
      userId: oid(input.userId),
      provider: input.provider,
      externalId: input.externalId,
    });
  },

  async createItemRef(prisma: any, data: Record<string, unknown>) {
    return insertOne(prisma, "BoardItemExternalRef", {
      ...data,
      userId: oid(String(data.userId)),
      itemId: oid(String(data.itemId)),
      accountId: oid(String(data.accountId)),
      mappingId: data.mappingId ? oid(String(data.mappingId)) : null,
    });
  },

  async updateItemRef(prisma: any, id: string, data: Record<string, unknown>) {
    return updateOne(prisma, "BoardItemExternalRef", { _id: oid(id) }, {
      ...data,
      ...(data.mappingId ? { mappingId: oid(String(data.mappingId)) } : {}),
    });
  },

  async listWorkspaceMappings(prisma: any, input: { userId: string; workspaceId?: string }) {
    return findMany(
      prisma,
      "ExternalWorkspaceMapping",
      {
        userId: oid(input.userId),
        ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
      },
      { updatedAt: -1 },
    );
  },

  async findWorkspaceMapping(prisma: any, input: {
    id?: string;
    userId: string;
    workspaceId?: string;
    accountId?: string;
    provider?: string;
    externalSourceId?: string;
    targetType?: string;
  }) {
    return findOne(prisma, "ExternalWorkspaceMapping", {
      ...(input.id ? { _id: oid(input.id) } : {}),
      userId: oid(input.userId),
      ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
      ...(input.accountId ? { accountId: oid(input.accountId) } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.externalSourceId ? { externalSourceId: input.externalSourceId } : {}),
      ...(input.targetType ? { targetType: input.targetType } : {}),
    });
  },

  async upsertWorkspaceMapping(prisma: any, input: {
    userId: string;
    workspaceId: string;
    provider: string;
    externalSourceId: string;
    targetType: string;
    data: Record<string, unknown>;
  }) {
    const filter = {
      workspaceId: oid(input.workspaceId),
      ...(input.data.accountId ? { accountId: oid(String(input.data.accountId)) } : {}),
      provider: input.provider,
      externalSourceId: input.externalSourceId,
      targetType: input.targetType,
    };
    const data = {
      ...input.data,
      ...(input.data.accountId ? { accountId: oid(String(input.data.accountId)) } : {}),
      ...(input.data.targetGroupId ? { targetGroupId: oid(String(input.data.targetGroupId)) } : {}),
    };
    const existing = await findOne(prisma, "ExternalWorkspaceMapping", filter);
    if (existing) return updateOne(prisma, "ExternalWorkspaceMapping", filter, data);
    return insertOne(prisma, "ExternalWorkspaceMapping", {
      ...data,
      userId: oid(input.userId),
      workspaceId: oid(input.workspaceId),
      provider: input.provider,
      externalSourceId: input.externalSourceId,
      targetType: input.targetType,
    });
  },

  async updateWorkspaceMapping(prisma: any, id: string, data: Record<string, unknown>) {
    return updateOne(prisma, "ExternalWorkspaceMapping", { _id: oid(id) }, {
      ...data,
      ...(data.targetGroupId ? { targetGroupId: oid(String(data.targetGroupId)) } : {}),
    });
  },

  async listWorkspaceRefs(prisma: any, input: {
    userId: string;
    workspaceId?: string;
    accountId?: string;
    mappingId?: string;
    targetType?: string;
    targetId?: string;
  }) {
    return findMany(
      prisma,
      "WorkspaceExternalRef",
      {
        userId: oid(input.userId),
        ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
        ...(input.accountId ? { accountId: oid(input.accountId) } : {}),
        ...(input.mappingId ? { mappingId: oid(input.mappingId) } : {}),
        ...(input.targetType ? { targetType: input.targetType } : {}),
        ...(input.targetId ? { targetId: oid(input.targetId) } : {}),
      },
      { updatedAt: -1 },
    );
  },

  async findWorkspaceRef(prisma: any, input: {
    userId: string;
    workspaceId?: string;
    accountId?: string;
    provider: string;
    externalId: string;
    targetType: string;
  }) {
    return findOne(prisma, "WorkspaceExternalRef", {
      userId: oid(input.userId),
      ...(input.workspaceId ? { workspaceId: oid(input.workspaceId) } : {}),
      ...(input.accountId ? { accountId: oid(input.accountId) } : {}),
      provider: input.provider,
      externalId: input.externalId,
      targetType: input.targetType,
    });
  },

  async createWorkspaceRef(prisma: any, data: Record<string, unknown>) {
    return insertOne(prisma, "WorkspaceExternalRef", {
      ...data,
      userId: oid(String(data.userId)),
      workspaceId: oid(String(data.workspaceId)),
      accountId: oid(String(data.accountId)),
      mappingId: data.mappingId ? oid(String(data.mappingId)) : null,
      targetId: oid(String(data.targetId)),
    });
  },

  async updateWorkspaceRef(prisma: any, id: string, data: Record<string, unknown>) {
    return updateOne(prisma, "WorkspaceExternalRef", { _id: oid(id) }, {
      ...data,
      ...(data.mappingId ? { mappingId: oid(String(data.mappingId)) } : {}),
      ...(data.targetId ? { targetId: oid(String(data.targetId)) } : {}),
    });
  },
};
