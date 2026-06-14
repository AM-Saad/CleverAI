import type {
  ExternalDocument,
  ExternalTask,
  IntegrationTarget,
  RunWorkspaceImportDTO,
} from "../../../../shared/utils/workspaceIntegration.contract";
import { RunWorkspaceImportResponseSchema } from "../../../../shared/utils/workspaceIntegration.contract";
import { getWorkspaceProvider } from "../infrastructure/providers";
import { integrationRepository, isDuplicateKeyError } from "../infrastructure/integrationRepository";
import { getProviderAccountContext } from "./providerAccountContext";
import {
  serializeWorkspaceImportRefResult,
  serializeWorkspaceMapping,
} from "./workspaceIntegrationSerialization";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function titleCaseProvider(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getStatusToColumnId(fieldMapping: Record<string, unknown>) {
  return asRecord(fieldMapping.statusToColumnId);
}

async function findColumnIdForStatus(input: {
  prisma: any;
  workspaceId: string;
  status: string | null | undefined;
  fieldMapping: Record<string, unknown>;
  warnings: string[];
}) {
  if (!input.status) return null;
  const mapping = getStatusToColumnId(input.fieldMapping);
  const normalizedStatus = input.status.trim().toLowerCase();
  const exact = mapping[input.status];
  const fuzzy = Object.entries(mapping).find(
    ([key]) => key.trim().toLowerCase() === normalizedStatus,
  )?.[1];
  const candidate = typeof exact === "string"
    ? exact
    : typeof fuzzy === "string"
      ? fuzzy
      : null;

  if (!candidate) {
    input.warnings.push(
      `No board column is mapped for external status "${input.status}". The item was imported without a column.`,
    );
    return null;
  }

  const column = await input.prisma.boardColumn.findFirst({
    where: { id: candidate, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!column) {
    input.warnings.push(
      `The mapped board column for "${input.status}" no longer exists. The item was imported without a column.`,
    );
    return null;
  }
  return candidate;
}

function hasBothChanged(input: {
  localUpdatedAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
  previousExternalUpdatedAt?: Date | string | null;
  nextExternalUpdatedAt?: Date | null;
}) {
  const lastSyncedAt = input.lastSyncedAt ? new Date(input.lastSyncedAt) : null;
  if (!lastSyncedAt) return false;
  const localUpdatedAt = input.localUpdatedAt ? new Date(input.localUpdatedAt) : null;
  const previousExternalUpdatedAt = input.previousExternalUpdatedAt
    ? new Date(input.previousExternalUpdatedAt)
    : null;
  return Boolean(
    localUpdatedAt &&
      localUpdatedAt > lastSyncedAt &&
      input.nextExternalUpdatedAt &&
      (!previousExternalUpdatedAt ||
        input.nextExternalUpdatedAt > previousExternalUpdatedAt),
  );
}

function hasLocalChanged(input: {
  localUpdatedAt?: Date | string | null;
  lastSyncedAt?: Date | string | null;
}) {
  const lastSyncedAt = input.lastSyncedAt ? new Date(input.lastSyncedAt) : null;
  const localUpdatedAt = input.localUpdatedAt ? new Date(input.localUpdatedAt) : null;
  return Boolean(lastSyncedAt && localUpdatedAt && localUpdatedAt > lastSyncedAt);
}

function hasExternalChanged(input: {
  previousExternalUpdatedAt?: Date | string | null;
  nextExternalUpdatedAt?: Date | null;
}) {
  if (!input.nextExternalUpdatedAt) return true;
  if (!input.previousExternalUpdatedAt) return true;
  return input.nextExternalUpdatedAt > new Date(input.previousExternalUpdatedAt);
}

async function getOrCreateMapping(input: {
  prisma: any;
  userId: string;
  account: any;
  request: RunWorkspaceImportDTO;
  targetGroupId?: string | null;
}) {
  const { prisma, userId, account, request } = input;
  if (request.mappingId) {
    const mapping = await integrationRepository.findWorkspaceMapping(prisma, {
      id: request.mappingId,
      userId,
      workspaceId: request.workspaceId,
    });
    if (!mapping) throw new Error("Workspace integration mapping not found");
    if (mapping.accountId !== account.id) {
      throw new Error("Workspace integration mapping belongs to a different account");
    }
    return mapping;
  }

  return integrationRepository.upsertWorkspaceMapping(prisma, {
    userId,
    workspaceId: request.workspaceId,
    provider: account.provider,
    externalSourceId: request.sourceId,
    targetType: request.targetType,
    data: {
      accountId: account.id,
      externalSourceKey: request.sourceKey ?? null,
      sourceKind: request.contentKinds.join(","),
      targetGroupId: input.targetGroupId ?? request.noteGroupId ?? null,
      name: request.sourceName || request.sourceId,
      fieldMapping: request.fieldMapping,
      importOptions: {
        ...request.importOptions,
        limit: request.limit,
        contentKinds: request.contentKinds,
        noteGroupTitle: request.noteGroupTitle,
      },
      status: "ACTIVE",
      lastError: null,
    },
  });
}

async function getOrCreateNoteGroup(input: {
  prisma: any;
  workspaceId: string;
  noteGroupId?: string | null;
  title: string;
}) {
  if (input.noteGroupId) {
    const group = await input.prisma.noteGroup.findFirst({
      where: { id: input.noteGroupId, workspaceId: input.workspaceId },
    });
    if (!group) throw new Error("Destination note group not found");
    return group;
  }

  const existing = await input.prisma.noteGroup.findFirst({
    where: { workspaceId: input.workspaceId, title: input.title },
  });
  if (existing) return existing;

  const lastGroup = await input.prisma.noteGroup.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return input.prisma.noteGroup.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      order: (lastGroup?.order ?? -1) + 1,
    },
  });
}

function externalAttachment(provider: string, task: ExternalTask) {
  if (!task.externalUrl) return [];
  return [{
    id: `external-${provider}-${task.externalId}`,
    name: `${titleCaseProvider(provider)}: ${task.externalKey || task.title}`,
    url: task.externalUrl,
    type: "link",
  }];
}

function noteContent(provider: string, document: ExternalDocument) {
  const footer = document.externalUrl
    ? `<p><a href="${escapeHtmlAttribute(document.externalUrl)}" target="_blank" rel="noreferrer">Open source in ${titleCaseProvider(provider)}</a></p>`
    : "";
  return `${document.htmlContent}\n<hr>\n${footer}`;
}

async function findScopedWorkspaceRef(input: {
  prisma: any;
  userId: string;
  workspaceId: string;
  accountId: string;
  provider: string;
  externalId: string;
  targetType: "BOARD_ITEM" | "NOTE";
}) {
  return integrationRepository.findWorkspaceRef(input.prisma, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    provider: input.provider,
    externalId: input.externalId,
    targetType: input.targetType,
  });
}

async function importTasks(input: {
  prisma: any;
  userId: string;
  account: any;
  mapping: any;
  request: RunWorkspaceImportDTO;
  tasks: ExternalTask[];
  warnings: string[];
  now: Date;
}) {
  let created = 0;
  let updated = 0;
  let conflicted = 0;
  let skipped = 0;
  const refs: any[] = [];
  const lastItem = await input.prisma.boardItem.findFirst({
    where: { userId: input.userId, workspaceId: input.request.workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (lastItem?.order ?? -1) + 1;

  for (const task of input.tasks) {
    const nextExternalUpdatedAt = toDate(task.updatedAt);
    const existingRef = await findScopedWorkspaceRef({
      prisma: input.prisma,
      userId: input.userId,
      workspaceId: input.request.workspaceId,
      accountId: input.account.id,
      provider: input.account.provider,
      externalId: task.externalId,
      targetType: "BOARD_ITEM",
    });
    const existingItem = existingRef
      ? await input.prisma.boardItem.findFirst({
        where: { id: existingRef.targetId, userId: input.userId },
      })
      : null;

    const columnId = await findColumnIdForStatus({
      prisma: input.prisma,
      workspaceId: input.request.workspaceId,
      status: task.status,
      fieldMapping: input.request.fieldMapping,
      warnings: input.warnings,
    });
    const boardData = {
      content: task.title,
      tags: task.tags,
      dueDate: toDate(task.dueDate),
      columnId,
    };

    if (!existingRef) {
      const item = await input.prisma.boardItem.create({
        data: {
          userId: input.userId,
          workspaceId: input.request.workspaceId,
          ...boardData,
          attachments: externalAttachment(input.account.provider, task),
          order: nextOrder,
        },
      });
      let ref: any;
      try {
        ref = await integrationRepository.createWorkspaceRef(input.prisma, {
          userId: input.userId,
          workspaceId: input.request.workspaceId,
          accountId: input.account.id,
          mappingId: input.mapping.id,
          targetType: "BOARD_ITEM",
          targetId: item.id,
          provider: input.account.provider,
          externalId: task.externalId,
          externalKey: task.externalKey ?? null,
          externalUrl: task.externalUrl ?? null,
          externalUpdatedAt: nextExternalUpdatedAt,
          syncStatus: "SYNCED",
          lastSyncedAt: input.now,
          raw: task.raw,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        await input.prisma.boardItem.deleteMany({ where: { id: item.id, userId: input.userId } });
        ref = await findScopedWorkspaceRef({
          prisma: input.prisma,
          userId: input.userId,
          workspaceId: input.request.workspaceId,
          accountId: input.account.id,
          provider: input.account.provider,
          externalId: task.externalId,
          targetType: "BOARD_ITEM",
        });
        if (!ref) throw error;
        skipped += 1;
        refs.push(ref);
        continue;
      }
      refs.push(ref);
      created += 1;
      nextOrder += 1;
      continue;
    }

    if (!existingItem) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        syncStatus: "ERROR",
        lastError: "The imported board item was deleted locally. Local content was not recreated automatically.",
        raw: task.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    if (hasBothChanged({
      localUpdatedAt: existingItem.updatedAt,
      lastSyncedAt: existingRef.lastSyncedAt,
      previousExternalUpdatedAt: existingRef.externalUpdatedAt,
      nextExternalUpdatedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        syncStatus: "CONFLICT",
        lastError: "Local and external task changed since last sync.",
        externalUpdatedAt: nextExternalUpdatedAt,
        raw: task.raw,
      });
      refs.push(ref);
      conflicted += 1;
      continue;
    }

    if (hasLocalChanged({
      localUpdatedAt: existingItem.updatedAt,
      lastSyncedAt: existingRef.lastSyncedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        mappingId: input.mapping.id,
        syncStatus: "LOCAL_CHANGED",
        lastError: "Local board item edits were preserved. External task has no newer change.",
        raw: task.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    if (!hasExternalChanged({
      previousExternalUpdatedAt: existingRef.externalUpdatedAt,
      nextExternalUpdatedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        mappingId: input.mapping.id,
        syncStatus: "SYNCED",
        lastError: null,
        lastSyncedAt: input.now,
        raw: task.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    await input.prisma.boardItem.update({
      where: { id: existingRef.targetId },
      data: boardData,
    });
    const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
      mappingId: input.mapping.id,
      externalKey: task.externalKey ?? null,
      externalUrl: task.externalUrl ?? null,
      externalUpdatedAt: nextExternalUpdatedAt,
      syncStatus: "SYNCED",
      lastSyncedAt: input.now,
      lastError: null,
      raw: task.raw,
    });
    refs.push(ref);
    updated += 1;
  }

  return { created, updated, conflicted, skipped, refs };
}

async function importDocuments(input: {
  prisma: any;
  userId: string;
  account: any;
  mapping: any;
  request: RunWorkspaceImportDTO;
  documents: ExternalDocument[];
  noteGroupId: string;
  now: Date;
}) {
  let created = 0;
  let updated = 0;
  let conflicted = 0;
  let skipped = 0;
  const refs: any[] = [];
  const lastNote = await input.prisma.note.findFirst({
    where: { workspaceId: input.request.workspaceId, groupId: input.noteGroupId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (lastNote?.order ?? -1) + 1;

  for (const document of input.documents) {
    const nextExternalUpdatedAt = toDate(document.updatedAt);
    const existingRef = await findScopedWorkspaceRef({
      prisma: input.prisma,
      userId: input.userId,
      workspaceId: input.request.workspaceId,
      accountId: input.account.id,
      provider: input.account.provider,
      externalId: document.externalId,
      targetType: "NOTE",
    });
    const existingNote = existingRef
      ? await input.prisma.note.findFirst({
        where: { id: existingRef.targetId, workspaceId: input.request.workspaceId },
      })
      : null;
    const content = noteContent(input.account.provider, document);

    if (!existingRef) {
      const note = await input.prisma.note.create({
        data: {
          workspaceId: input.request.workspaceId,
          groupId: input.noteGroupId,
          title: document.title,
          content,
          tags: input.request.importOptions?.includeProviderTags === false
            ? []
            : [input.account.provider],
          order: nextOrder,
          noteType: "TEXT",
          metadata: {
            importedFrom: input.account.provider,
            externalId: document.externalId,
            externalUrl: document.externalUrl,
          },
        },
      });
      let ref: any;
      try {
        ref = await integrationRepository.createWorkspaceRef(input.prisma, {
          userId: input.userId,
          workspaceId: input.request.workspaceId,
          accountId: input.account.id,
          mappingId: input.mapping.id,
          targetType: "NOTE",
          targetId: note.id,
          provider: input.account.provider,
          externalId: document.externalId,
          externalKey: document.externalKey ?? null,
          externalUrl: document.externalUrl ?? null,
          externalUpdatedAt: nextExternalUpdatedAt,
          syncStatus: "SYNCED",
          lastSyncedAt: input.now,
          raw: document.raw,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        await input.prisma.note.deleteMany({ where: { id: note.id, workspaceId: input.request.workspaceId } });
        ref = await findScopedWorkspaceRef({
          prisma: input.prisma,
          userId: input.userId,
          workspaceId: input.request.workspaceId,
          accountId: input.account.id,
          provider: input.account.provider,
          externalId: document.externalId,
          targetType: "NOTE",
        });
        if (!ref) throw error;
        skipped += 1;
        refs.push(ref);
        continue;
      }
      refs.push(ref);
      created += 1;
      nextOrder += 1;
      continue;
    }

    if (!existingNote) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        syncStatus: "ERROR",
        lastError: "The imported note was deleted locally. Local content was not recreated automatically.",
        raw: document.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    if (hasBothChanged({
      localUpdatedAt: existingNote.updatedAt,
      lastSyncedAt: existingRef.lastSyncedAt,
      previousExternalUpdatedAt: existingRef.externalUpdatedAt,
      nextExternalUpdatedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        syncStatus: "CONFLICT",
        lastError: "Local and external document changed since last sync.",
        externalUpdatedAt: nextExternalUpdatedAt,
        raw: document.raw,
      });
      refs.push(ref);
      conflicted += 1;
      continue;
    }

    if (hasLocalChanged({
      localUpdatedAt: existingNote.updatedAt,
      lastSyncedAt: existingRef.lastSyncedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        mappingId: input.mapping.id,
        syncStatus: "LOCAL_CHANGED",
        lastError: "Local note edits were preserved. External document has no newer change.",
        raw: document.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    if (!hasExternalChanged({
      previousExternalUpdatedAt: existingRef.externalUpdatedAt,
      nextExternalUpdatedAt,
    })) {
      const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
        mappingId: input.mapping.id,
        syncStatus: "SYNCED",
        lastError: null,
        lastSyncedAt: input.now,
        raw: document.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    await input.prisma.note.update({
      where: { id: existingRef.targetId },
      data: {
        groupId: input.noteGroupId,
        title: document.title,
        content,
        version: { increment: 1 },
        metadata: {
          ...(asRecord(existingNote.metadata)),
          importedFrom: input.account.provider,
          externalId: document.externalId,
          externalUrl: document.externalUrl,
        },
      },
    });
    const ref = await integrationRepository.updateWorkspaceRef(input.prisma, existingRef.id, {
      mappingId: input.mapping.id,
      externalKey: document.externalKey ?? null,
      externalUrl: document.externalUrl ?? null,
      externalUpdatedAt: nextExternalUpdatedAt,
      syncStatus: "SYNCED",
      lastSyncedAt: input.now,
      lastError: null,
      raw: document.raw,
    });
    refs.push(ref);
    updated += 1;
  }

  return { created, updated, conflicted, skipped, refs };
}

export async function importWorkspaceContent(input: {
  prisma: any;
  userId: string;
  request: RunWorkspaceImportDTO;
}) {
  const { prisma, request, userId } = input;
  const [workspace, account] = await Promise.all([
    prisma.workspace.findFirst({
      where: { id: request.workspaceId, userId },
      select: { id: true },
    }),
    integrationRepository.findAccount(prisma, {
      id: request.accountId,
      userId,
    }),
  ]);

  if (!workspace) throw new Error("Workspace not found");
  if (!account) throw new Error("Integration account not found");

  const warnings: string[] = [];
  const now = new Date();
  const provider = getWorkspaceProvider(account.provider);
  const providerAccount = await getProviderAccountContext({ prisma, userId, account });
  let noteGroupId: string | null = request.noteGroupId ?? null;

  if (request.targetType === "NOTE") {
    const group = await getOrCreateNoteGroup({
      prisma,
      workspaceId: request.workspaceId,
      noteGroupId,
      title: request.noteGroupTitle || `Imported from ${titleCaseProvider(account.provider)}`,
    });
    noteGroupId = group.id;
  }

  const mapping = await getOrCreateMapping({
    prisma,
    userId,
    account,
    request,
    targetGroupId: noteGroupId,
  });
  if (!mapping) throw new Error("Workspace integration mapping could not be created");

  let page: { items: ExternalTask[] | ExternalDocument[]; warnings?: string[] };
  try {
    page = request.targetType === "BOARD_ITEM"
      ? await provider.listTasks({
        account: providerAccount,
        sourceId: request.sourceId,
        sourceKey: request.sourceKey,
        limit: request.limit,
        fieldMapping: request.fieldMapping,
        importOptions: request.importOptions,
      })
      : await provider.listDocuments({
        account: providerAccount,
        sourceId: request.sourceId,
        sourceKey: request.sourceKey,
        limit: request.limit,
        fieldMapping: request.fieldMapping,
        importOptions: request.importOptions,
      });
  } catch (error: any) {
    await integrationRepository.updateWorkspaceMapping(prisma, mapping.id, {
      status: "ERROR",
      lastError:
        error?.data?.errorMessages?.join?.(", ") ||
        error?.data?.message ||
        error?.response?._data?.message ||
        error?.message ||
        "Provider request failed",
    });
    throw error;
  }

  warnings.push(...(page.warnings ?? []));

  const stats = request.targetType === "BOARD_ITEM"
    ? await importTasks({
      prisma,
      userId,
      account,
      mapping,
      request,
      tasks: page.items as ExternalTask[],
      warnings,
      now,
    })
    : await importDocuments({
      prisma,
      userId,
      account,
      mapping,
      request,
      documents: page.items as ExternalDocument[],
      noteGroupId: String(noteGroupId),
      now,
    });

  const updatedMapping = await integrationRepository.updateWorkspaceMapping(prisma, mapping.id, {
    lastSyncedAt: now,
    lastError: null,
    status: "ACTIVE",
    ...(noteGroupId ? { targetGroupId: noteGroupId } : {}),
    importOptions: {
      ...request.importOptions,
      limit: request.limit,
      contentKinds: request.contentKinds,
      noteGroupTitle: request.noteGroupTitle,
    },
  });
  if (!updatedMapping) throw new Error("Workspace integration mapping could not be updated");

  return RunWorkspaceImportResponseSchema.parse({
    mapping: serializeWorkspaceMapping(updatedMapping),
    created: stats.created,
    updated: stats.updated,
    conflicted: stats.conflicted,
    skipped: stats.skipped,
    warnings,
    refs: stats.refs.map(serializeWorkspaceImportRefResult),
  });
}

export type WorkspaceImportTarget = IntegrationTarget;
