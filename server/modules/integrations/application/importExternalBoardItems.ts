import type { ImportExternalBoardDTO } from "../../../../shared/utils/boardIntegration.contract";
import { ImportExternalBoardResponseSchema } from "../../../../shared/utils/boardIntegration.contract";
import type { ExternalBoardItem } from "../domain/boardProvider";
import {
  serializeBoardItemExternalRef,
  serializeExternalBoardMapping,
} from "./boardIntegrationSerialization";
import { getBoardProvider } from "../infrastructure/providers";
import { integrationRepository } from "../infrastructure/integrationRepository";
import { getProviderAccountContext } from "./providerAccountContext";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getStatusToColumnId(fieldMapping: Record<string, unknown>) {
  return asRecord(fieldMapping.statusToColumnId);
}

function findColumnIdForStatus(
  status: string | null | undefined,
  fieldMapping: Record<string, unknown>,
) {
  if (!status) return null;
  const mapping = getStatusToColumnId(fieldMapping);
  const exact = mapping[status];
  if (typeof exact === "string") return exact;

  const normalizedStatus = status.trim().toLowerCase();
  const fallback = Object.entries(mapping).find(
    ([key]) => key.trim().toLowerCase() === normalizedStatus,
  );
  return typeof fallback?.[1] === "string" ? fallback[1] : null;
}

function externalUpdatedAt(item: ExternalBoardItem) {
  return item.updatedAt ? new Date(item.updatedAt) : null;
}

function dueDate(item: ExternalBoardItem) {
  return item.dueDate ? new Date(item.dueDate) : null;
}

async function getOrCreateMapping(input: {
  prisma: any;
  userId: string;
  account: any;
  request: ImportExternalBoardDTO;
}) {
  const { prisma, userId, account, request } = input;
  if (request.mappingId) {
    const mapping = await integrationRepository.findMapping(prisma, {
      id: request.mappingId,
      userId,
      workspaceId: request.workspaceId,
    });
    if (!mapping) throw new Error("External board mapping not found");
    return mapping;
  }

  return integrationRepository.upsertMapping(prisma, {
    userId,
    workspaceId: request.workspaceId,
    provider: account.provider,
    externalContainerId: request.externalContainerId,
    data: {
      accountId: integrationRepository.oid(account.id),
      externalContainerKey: request.externalContainerKey ?? null,
      name: request.name,
      syncDirection: request.syncDirection,
      fieldMapping: request.fieldMapping,
      status: "ACTIVE",
      lastError: null,
    },
  });
}

export async function importExternalBoardItems(input: {
  prisma: any;
  userId: string;
  request: ImportExternalBoardDTO;
}) {
  const { prisma, request, userId } = input;
  const account = await integrationRepository.findAccount(prisma, {
    id: request.accountId,
    userId,
  });
  if (!account) throw new Error("Integration account not found");

  const workspace = await prisma.workspace.findFirst({
    where: { id: request.workspaceId, userId },
    select: { id: true },
  });
  if (!workspace) throw new Error("Workspace not found");

  const mapping = await getOrCreateMapping({ prisma, userId, account, request }) as any;
  const provider = getBoardProvider(account.provider);
  const fieldMapping = asRecord(mapping.fieldMapping);
  const providerAccount = await getProviderAccountContext({ prisma, userId, account });
  const externalItems = await provider.listItems({
    account: providerAccount,
    sourceId: mapping.externalContainerId,
    sourceKey: mapping.externalContainerKey,
    limit: request.limit,
    fieldMapping,
  });

  let created = 0;
  let updated = 0;
  let conflicted = 0;
  let skipped = 0;
  const refs: any[] = [];
  const now = new Date();

  for (const externalItem of externalItems) {
    const nextExternalUpdatedAt = externalUpdatedAt(externalItem);
    const existingRef = await integrationRepository.findItemRef(prisma, {
      userId,
      provider: account.provider,
      externalId: externalItem.externalId,
    });
    const existingItem = existingRef
      ? await prisma.boardItem.findFirst({
        where: { id: existingRef.itemId, userId },
      })
      : null;

    const columnId = findColumnIdForStatus(externalItem.status, fieldMapping);
    const baseBoardData = {
      content: externalItem.title,
      tags: externalItem.tags,
      dueDate: dueDate(externalItem),
      ...(columnId !== null ? { columnId } : {}),
    };

    if (!existingRef) {
      const item = await prisma.boardItem.create({
        data: {
          userId,
          workspaceId: request.workspaceId,
          content: externalItem.title,
          tags: externalItem.tags,
          dueDate: dueDate(externalItem),
          columnId,
          attachments: externalItem.externalUrl
            ? [{
              id: `external-${account.provider}-${externalItem.externalId}`,
              name: `${account.provider}: ${externalItem.externalKey || externalItem.title}`,
              url: externalItem.externalUrl,
              type: "link",
            }]
            : [],
          order: 0,
        },
      });

      const ref = await integrationRepository.createItemRef(prisma, {
        itemId: item.id,
        userId,
        accountId: account.id,
        mappingId: mapping.id,
        provider: account.provider,
        externalId: externalItem.externalId,
        externalKey: externalItem.externalKey ?? null,
        externalUrl: externalItem.externalUrl ?? null,
        externalUpdatedAt: nextExternalUpdatedAt,
        syncStatus: "SYNCED",
        lastSyncedAt: now,
        raw: externalItem.raw,
      });
      refs.push(ref);
      created += 1;
      continue;
    }

    const lastSyncedAt = existingRef.lastSyncedAt
      ? new Date(existingRef.lastSyncedAt)
      : null;
    if (!existingItem) {
      skipped += 1;
      continue;
    }

    const localChangedSinceLastSync =
      lastSyncedAt && existingItem.updatedAt > lastSyncedAt;
    const externalChangedSinceLastSync =
      nextExternalUpdatedAt &&
      (!existingRef.externalUpdatedAt ||
        nextExternalUpdatedAt > existingRef.externalUpdatedAt);

    if (localChangedSinceLastSync && externalChangedSinceLastSync) {
      const ref = await integrationRepository.updateItemRef(prisma, existingRef.id, {
        syncStatus: "CONFLICT",
        lastError: "Local and external item changed since last sync.",
        externalUpdatedAt: nextExternalUpdatedAt,
        raw: externalItem.raw,
      });
      refs.push(ref);
      conflicted += 1;
      continue;
    }

    if (!externalChangedSinceLastSync) {
      const ref = await integrationRepository.updateItemRef(prisma, existingRef.id, {
        syncStatus: "SYNCED",
        lastError: null,
        lastSyncedAt: now,
        raw: externalItem.raw,
      });
      refs.push(ref);
      skipped += 1;
      continue;
    }

    await prisma.boardItem.update({
      where: { id: existingRef.itemId },
      data: baseBoardData,
    });
    const ref = await integrationRepository.updateItemRef(prisma, existingRef.id, {
      mappingId: mapping.id,
      externalKey: externalItem.externalKey ?? null,
      externalUrl: externalItem.externalUrl ?? null,
      externalUpdatedAt: nextExternalUpdatedAt,
      syncStatus: "SYNCED",
      lastSyncedAt: now,
      lastError: null,
      raw: externalItem.raw,
    });
    refs.push(ref);
    updated += 1;
  }

  const updatedMapping = await integrationRepository.updateMapping(prisma, mapping.id, {
    lastSyncedAt: now,
    lastError: null,
    status: "ACTIVE",
  });

  return ImportExternalBoardResponseSchema.parse({
    mapping: serializeExternalBoardMapping(updatedMapping),
    created,
    updated,
    conflicted,
    skipped,
    refs: refs.map(serializeBoardItemExternalRef),
  });
}
