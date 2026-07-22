import { ZodError, z } from "zod";
import type {
  OfflineConflict,
  OfflineMutation,
  OfflineSyncResponse,
  OfflineSyncResult,
} from "@@/shared/utils/offline-sync.contract";
import { enrollLanguageWord } from "../../language-learning/application/enrollLanguageWord";
import { gradeReviewCard } from "../../review/application/gradeReviewCard";
import { PrismaCardReviewRepository } from "../../review/infrastructure/PrismaCardReviewRepository";
import { PrismaLanguageReviewRepository } from "../../language-learning/infrastructure/PrismaLanguageReviewRepository";
import { PrismaXpPort } from "../../review/infrastructure/PrismaXpPort";
import { LanguagePreferencesDTO } from "../../../../shared/utils/language.contract";
import { NotificationPreferencesDTO } from "../../../../shared/utils/notification.contract";
import { orderOfflineMutations } from "../../../../shared/utils/offline-mutation-order";
import {
  isPositionKey,
  positionBetween,
} from "../../../../shared/utils/position-key";
import {
  CompleteOccurrenceDTO,
  CreateActionItemDTO,
  DailyNoteUpsertDTO,
  OccurrenceCommandDTO,
  RescheduleOccurrenceDTO,
  UpdateActionItemDTO,
} from "../../../../shared/utils/daily.contract";
import { placementStateAfterMove } from "../../../../shared/utils/daily-placement";
import { occurrenceKey as occurrenceKeyFor } from "../../../../shared/utils/daily-recurrence";
import { ensureOccurrence, ownedActionItem } from "../../daily/domain/ensureOccurrence";

type JsonRecord = Record<string, unknown>;

// Legacy database/client rows used null for "not ranked yet". Treat it as an
// omitted field so creates generate a key and updates leave the current key
// untouched; malformed non-null values are still rejected.
const position = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().refine(isPositionKey, "Invalid position key").optional(),
);
const createWorkspace = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    position,
  })
  .strict();
const updateWorkspace = createWorkspace
  .extend({ order: z.number().int().optional() })
  .partial();
const createMaterial = z
  .object({
    workspaceId: z.string().min(1),
    title: z.string().trim().min(1),
    content: z.string(),
    type: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();
const updateMaterial = createMaterial.omit({ workspaceId: true }).partial();
const notePayload = z
  .object({
    workspaceId: z.string().min(1),
    groupId: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    noteType: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    position,
    order: z.number().int().optional(),
  })
  .strict();
const noteGroupPayload = z
  .object({
    workspaceId: z.string().min(1),
    title: z.string().trim().min(1).optional(),
    position,
    order: z.number().int().optional(),
  })
  .strict();
const boardItemPayload = z
  .object({
    workspaceId: z.string().nullable().optional(),
    columnId: z.string().nullable().optional(),
    content: z.string().min(0).optional(),
    tags: z.array(z.string()).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    attachments: z.array(z.unknown()).optional(),
    position,
    order: z.number().optional(),
  })
  .strict();
const boardColumnPayload = z
  .object({
    workspaceId: z.string().nullable().optional(),
    name: z.string().trim().min(1).optional(),
    position,
  })
  .strict();
const tagPayload = z
  .object({
    name: z.string().trim().min(1).optional(),
    color: z.string().min(1).optional(),
    position,
  })
  .strict();
const boardCommentPayload = z
  .object({
    itemId: z.string().min(1),
    content: z.string().trim().min(1).max(10_000),
  })
  .strict();
const boardLinkPayload = z
  .object({
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
    linkType: z.string().min(1).max(32).optional(),
  })
  .strict();
const reviewGrade = z
  .object({
    cardId: z.string().min(1),
    grade: z.coerce.number().int().min(0).max(5),
    reviewedAt: z.string().datetime(),
    requestId: z.string().optional(),
  })
  .strict();

const localId = (id: string) => /^(temp-|local:)/.test(id);

function json(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object") return null;
  return JSON.parse(
    JSON.stringify(value, (_key, entry) =>
      entry instanceof Date ? entry.toISOString() : entry,
    ),
  );
}

function remap(value: unknown, idMap: Record<string, string>): unknown {
  if (typeof value === "string") return idMap[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => remap(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [
        key,
        remap(item, idMap),
      ]),
    );
  }
  return value;
}

function fieldVersions(value: unknown): Record<string, number> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as JsonRecord).map(([key, version]) => [
          key,
          Number(version) || 0,
        ]),
      )
    : {};
}

async function currentSnapshot(
  prisma: any,
  userId: string,
  entity: string,
  entityId: string,
): Promise<JsonRecord | null> {
  switch (entity) {
    case "workspace":
      return json(
        await prisma.workspace.findFirst({ where: { id: entityId, userId } }),
      );
    case "material":
      return json(
        await prisma.material.findFirst({
          where: { id: entityId, workspace: { userId } },
        }),
      );
    case "note":
      return json(
        await prisma.note.findFirst({
          where: { id: entityId, workspace: { userId } },
        }),
      );
    case "noteGroup":
      return json(
        await prisma.noteGroup.findFirst({
          where: { id: entityId, workspace: { userId } },
        }),
      );
    case "boardItem":
      return json(
        await prisma.boardItem.findFirst({ where: { id: entityId, userId } }),
      );
    case "boardColumn":
      return json(
        await prisma.boardColumn.findFirst({ where: { id: entityId, userId } }),
      );
    case "boardComment":
      return json(
        await prisma.boardItemComment.findFirst({
          where: { id: entityId, userId },
        }),
      );
    case "boardLink":
      return json(
        await prisma.boardItemLink.findFirst({
          where: { id: entityId, userId },
        }),
      );
    case "userTag":
      return json(
        await prisma.userTag.findFirst({ where: { id: entityId, userId } }),
      );
    case "languageWord":
      return json(
        await prisma.languageWord.findFirst({
          where: { id: entityId, userId },
          include: { stories: true },
        }),
      );
    case "languagePreference":
      return json(
        await prisma.userLanguagePreferences.findUnique({ where: { userId } }),
      );
    case "notificationPreference":
      return json(
        await prisma.userNotificationPreferences.findUnique({
          where: { userId },
        }),
      );
    case "review":
      return json(
        await prisma.cardReview.findFirst({ where: { id: entityId, userId } }),
      );
    case "languageReview":
      return json(
        await prisma.languageCardReview.findFirst({
          where: { id: entityId, userId },
        }),
      );
    case "dailyNote":
      return json(
        await prisma.dailyNote.findFirst({ where: { id: entityId, userId } }),
      );
    case "actionItem":
      return json(
        await prisma.actionItem.findFirst({ where: { id: entityId, userId } }),
      );
    case "actionOccurrence":
      return json(
        await prisma.actionOccurrence.findFirst({
          where: { id: entityId, userId },
          include: { placements: true },
        }),
      );
    case "actionPlacement":
      return json(
        await prisma.actionPlacement.findFirst({
          where: { id: entityId, userId },
        }),
      );
    default:
      return null;
  }
}

type RelatedDomainChange = {
  entity: OfflineMutation["entity"];
  entityId: string;
  changedFields: string[];
  canonical?: JsonRecord | null;
};

async function applyDomainMutation(input: {
  prisma: any;
  userId: string;
  mutation: OfflineMutation;
}): Promise<{
  entityId: string;
  canonical: JsonRecord | null;
  idMap?: Record<string, string>;
  relatedChanges?: RelatedDomainChange[];
}> {
  const { prisma, userId, mutation } = input;
  const payload = mutation.payload;
  const create = mutation.operation.endsWith(".create");
  const remove = mutation.operation.endsWith(".delete");

  if (mutation.entity === "workspace") {
    if (create) {
      const data = createWorkspace.parse(payload);
      const max = await prisma.workspace.aggregate({
        where: { userId },
        _max: { order: true },
      });
      const last = await prisma.workspace.findFirst({
        where: { userId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.workspace.create({
        data: {
          userId,
          title: data.title,
          description: data.description ?? null,
          metadata: data.metadata ?? null,
          position: data.position ?? positionBetween(last?.position, null),
          order: (max._max.order ?? 0) + 1,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.workspace.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Workspace not found"), {
        statusCode: 404,
      });
    if (remove) {
      await prisma.workspace.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const data = updateWorkspace.parse(payload);
    const row = await prisma.workspace.update({
      where: { id: existing.id },
      data,
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "material") {
    if (create) {
      const data = createMaterial.parse(payload);
      const workspace = await prisma.workspace.findFirst({
        where: { id: data.workspaceId, userId },
      });
      if (!workspace)
        throw Object.assign(new Error("Workspace not found"), {
          statusCode: 404,
        });
      const row = await prisma.material.create({
        data: {
          ...data,
          type: data.type ?? "text",
          metadata: data.metadata ?? null,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.material.findFirst({
      where: { id: mutation.entityId, workspace: { userId } },
    });
    if (!existing)
      throw Object.assign(new Error("Material not found"), { statusCode: 404 });
    if (remove) {
      await prisma.material.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const row = await prisma.material.update({
      where: { id: existing.id },
      data: updateMaterial.parse(payload),
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "noteGroup") {
    if (create) {
      const data = noteGroupPayload.required({ title: true }).parse(payload);
      const workspace = await prisma.workspace.findFirst({
        where: { id: data.workspaceId, userId },
      });
      if (!workspace)
        throw Object.assign(new Error("Workspace not found"), {
          statusCode: 404,
        });
      const last = await prisma.noteGroup.findFirst({
        where: { workspaceId: data.workspaceId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.noteGroup.create({
        data: {
          workspaceId: data.workspaceId,
          title: data.title,
          position: data.position ?? positionBetween(last?.position, null),
          order: data.order ?? 0,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.noteGroup.findFirst({
      where: { id: mutation.entityId, workspace: { userId } },
    });
    if (!existing)
      throw Object.assign(new Error("Note group not found"), {
        statusCode: 404,
      });
    if (remove) {
      await prisma.noteGroup.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const row = await prisma.noteGroup.update({
      where: { id: existing.id },
      data: noteGroupPayload.omit({ workspaceId: true }).parse(payload),
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "note") {
    if (create) {
      const data = notePayload.required({ content: true }).parse(payload);
      const workspace = await prisma.workspace.findFirst({
        where: { id: data.workspaceId, userId },
      });
      if (!workspace)
        throw Object.assign(new Error("Workspace not found"), {
          statusCode: 404,
        });
      if (data.groupId) {
        const group = await prisma.noteGroup.findFirst({
          where: { id: data.groupId, workspaceId: data.workspaceId },
        });
        if (!group)
          throw Object.assign(new Error("Note group not found"), {
            statusCode: 404,
          });
      }
      const last = await prisma.note.findFirst({
        where: { workspaceId: data.workspaceId, groupId: data.groupId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.note.create({
        data: {
          workspaceId: data.workspaceId,
          groupId: data.groupId ?? null,
          title: data.title ?? null,
          content: data.content,
          tags: data.tags ?? [],
          noteType: data.noteType ?? "TEXT",
          metadata: data.metadata ?? null,
          position: data.position ?? positionBetween(last?.position, null),
          order: data.order ?? 0,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.note.findFirst({
      where: { id: mutation.entityId, workspace: { userId } },
    });
    if (!existing)
      throw Object.assign(new Error("Note not found"), { statusCode: 404 });
    if (remove) {
      await prisma.note.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const data = notePayload.omit({ workspaceId: true }).parse(payload);
    if (data.groupId) {
      const group = await prisma.noteGroup.findFirst({
        where: { id: data.groupId, workspaceId: existing.workspaceId },
      });
      if (!group)
        throw Object.assign(
          new Error("Note group not found in this workspace"),
          { statusCode: 403 },
        );
    }
    const row = await prisma.note.update({
      where: { id: existing.id },
      data: { ...data, version: { increment: 1 } },
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "boardItem") {
    if (create) {
      const data = boardItemPayload.required({ content: true }).parse(payload);
      if (data.workspaceId) {
        const workspace = await prisma.workspace.findFirst({
          where: { id: data.workspaceId, userId },
        });
        if (!workspace)
          throw Object.assign(new Error("Workspace not found"), {
            statusCode: 404,
          });
      }
      if (data.columnId) {
        const column = await prisma.boardColumn.findFirst({
          where: { id: data.columnId, userId },
        });
        if (
          !column ||
          (column.workspaceId &&
            column.workspaceId !== (data.workspaceId ?? null))
        )
          throw Object.assign(
            new Error("Board column not found in this workspace"),
            { statusCode: 403 },
          );
      }
      const last = await prisma.boardItem.findFirst({
        where: { userId, columnId: data.columnId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.boardItem.create({
        data: {
          userId,
          workspaceId: data.workspaceId ?? null,
          columnId: data.columnId ?? null,
          content: data.content,
          tags: data.tags ?? [],
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          attachments: data.attachments ?? [],
          position: data.position ?? positionBetween(last?.position, null),
          order: data.order ?? Date.now(),
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.boardItem.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Board item not found"), {
        statusCode: 404,
      });
    if (remove) {
      await prisma.boardItem.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const data = boardItemPayload.parse(payload);
    if (
      data.workspaceId !== undefined &&
      data.workspaceId !== existing.workspaceId
    ) {
      if (data.workspaceId) {
        const workspace = await prisma.workspace.findFirst({
          where: { id: data.workspaceId, userId },
        });
        if (!workspace)
          throw Object.assign(new Error("Workspace not found"), {
            statusCode: 403,
          });
      }
    }
    if (data.columnId) {
      const column = await prisma.boardColumn.findFirst({
        where: { id: data.columnId, userId },
      });
      if (!column)
        throw Object.assign(new Error("Board column not found"), {
          statusCode: 403,
        });
      const resultingWorkspaceId =
        data.workspaceId === undefined
          ? existing.workspaceId
          : data.workspaceId;
      if (column.workspaceId && column.workspaceId !== resultingWorkspaceId)
        throw Object.assign(
          new Error("Board column belongs to a different workspace"),
          { statusCode: 403 },
        );
    }
    const row = await prisma.boardItem.update({
      where: { id: existing.id },
      data: {
        ...data,
        dueDate:
          data.dueDate === undefined
            ? undefined
            : data.dueDate
              ? new Date(data.dueDate)
              : null,
      },
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "boardColumn") {
    if (create) {
      const data = boardColumnPayload.required({ name: true }).parse(payload);
      if (data.workspaceId) {
        const workspace = await prisma.workspace.findFirst({
          where: { id: data.workspaceId, userId },
        });
        if (!workspace)
          throw Object.assign(new Error("Workspace not found"), {
            statusCode: 403,
          });
      }
      const max = await prisma.boardColumn.aggregate({
        where: { userId },
        _max: { order: true },
      });
      const last = await prisma.boardColumn.findFirst({
        where: { userId, workspaceId: data.workspaceId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.boardColumn.create({
        data: {
          userId,
          workspaceId: data.workspaceId ?? null,
          name: data.name,
          position: data.position ?? positionBetween(last?.position, null),
          order: (max._max.order ?? -1) + 1,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.boardColumn.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Board column not found"), {
        statusCode: 404,
      });
    if (remove) {
      const [uncategorizedItems, sourceItems] = await Promise.all([
        prisma.boardItem.findMany({
          where: {
            userId,
            workspaceId: existing.workspaceId ?? null,
            columnId: null,
          },
          orderBy: [{ position: "asc" }, { order: "asc" }],
        }),
        prisma.boardItem.findMany({
          where: { userId, columnId: existing.id },
          orderBy: [{ position: "asc" }, { order: "asc" }],
        }),
      ]);
      let previousPosition: string | undefined;
      const normalizedItems = [...uncategorizedItems, ...sourceItems].map(
        (item, order) => {
          const nextPosition = positionBetween(previousPosition, null);
          previousPosition = nextPosition;
          return { ...item, columnId: null, order, position: nextPosition };
        },
      );
      const persistedNormalizedItems: typeof normalizedItems = [];
      for (const item of normalizedItems) {
        const persisted = await prisma.boardItem.update({
          where: { id: item.id },
          data: { columnId: null, order: item.order, position: item.position },
        });
        persistedNormalizedItems.push(persisted);
      }
      await prisma.boardColumn.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
        relatedChanges: persistedNormalizedItems.map((item) => ({
          entity: "boardItem" as const,
          entityId: item.id,
          changedFields: ["columnId", "order", "position"],
          canonical: json(item),
        })),
      };
    }
    const data = boardColumnPayload.parse(payload);
    if (data.workspaceId !== undefined && data.workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: { id: data.workspaceId, userId },
      });
      if (!workspace)
        throw Object.assign(new Error("Workspace not found"), {
          statusCode: 403,
        });
    }
    const row = await prisma.boardColumn.update({
      where: { id: existing.id },
      data,
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "userTag") {
    if (create) {
      const data = tagPayload.required({ name: true }).parse(payload);
      const duplicate = await prisma.userTag.findFirst({
        where: { userId, name: { equals: data.name, mode: "insensitive" } },
      });
      if (duplicate)
        throw Object.assign(new Error("Tag with this name already exists"), {
          statusCode: 409,
        });
      const max = await prisma.userTag.aggregate({
        where: { userId },
        _max: { order: true },
      });
      const last = await prisma.userTag.findFirst({
        where: { userId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await prisma.userTag.create({
        data: {
          userId,
          name: data.name,
          color: data.color ?? "#3b82f6",
          position: data.position ?? positionBetween(last?.position, null),
          order: (max._max.order ?? -1) + 1,
        },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        idMap: localId(mutation.entityId)
          ? { [mutation.entityId]: row.id }
          : undefined,
      };
    }
    const existing = await prisma.userTag.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Tag not found"), { statusCode: 404 });
    if (remove) {
      await prisma.userTag.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
      };
    }
    const data = tagPayload.parse(payload);
    if (data.name) {
      const duplicate = await prisma.userTag.findFirst({
        where: {
          userId,
          id: { not: existing.id },
          name: { equals: data.name, mode: "insensitive" },
        },
      });
      if (duplicate)
        throw Object.assign(new Error("Tag with this name already exists"), {
          statusCode: 409,
        });
    }
    const row = await prisma.userTag.update({
      where: { id: existing.id },
      data,
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "boardComment") {
    if (!create) {
      const existing = await prisma.boardItemComment.findFirst({
        where: { id: mutation.entityId, userId },
      });
      if (!existing)
        throw Object.assign(new Error("Comment not found"), {
          statusCode: 404,
        });
      if (remove) {
        await prisma.boardItemComment.delete({ where: { id: existing.id } });
        return {
          entityId: existing.id,
          canonical: { id: existing.id, deleted: true },
        };
      }
      const data = boardCommentPayload.pick({ content: true }).parse(payload);
      const row = await prisma.boardItemComment.update({
        where: { id: existing.id },
        data,
      });
      return { entityId: row.id, canonical: json(row) };
    }
    const data = boardCommentPayload.parse(payload);
    const item = await prisma.boardItem.findFirst({
      where: { id: data.itemId, userId },
    });
    if (!item)
      throw Object.assign(new Error("Board item not found"), {
        statusCode: 404,
      });
    const row = await prisma.boardItemComment.create({
      data: { itemId: item.id, userId, content: data.content },
    });
    return {
      entityId: row.id,
      canonical: json(row),
      idMap: localId(mutation.entityId)
        ? { [mutation.entityId]: row.id }
        : undefined,
    };
  }

  if (mutation.entity === "boardLink") {
    if (!create) {
      const existing = await prisma.boardItemLink.findFirst({
        where: { id: mutation.entityId, userId },
      });
      if (!existing)
        throw Object.assign(new Error("Link not found"), { statusCode: 404 });
      if (remove) {
        await prisma.boardItemLink.delete({ where: { id: existing.id } });
        return {
          entityId: existing.id,
          canonical: { id: existing.id, deleted: true },
        };
      }
      const data = boardLinkPayload.pick({ linkType: true }).parse(payload);
      const row = await prisma.boardItemLink.update({
        where: { id: existing.id },
        data,
      });
      return { entityId: row.id, canonical: json(row) };
    }
    const data = boardLinkPayload.parse(payload);
    if (data.sourceId === data.targetId)
      throw Object.assign(new Error("An item cannot link to itself"), {
        statusCode: 400,
      });
    const count = await prisma.boardItem.count({
      where: { userId, id: { in: [data.sourceId, data.targetId] } },
    });
    if (count !== 2)
      throw Object.assign(new Error("Board item not found"), {
        statusCode: 404,
      });
    const duplicate = await prisma.boardItemLink.findFirst({
      where: { sourceId: data.sourceId, targetId: data.targetId },
    });
    if (duplicate)
      throw Object.assign(new Error("These items are already linked"), {
        statusCode: 409,
      });
    const row = await prisma.boardItemLink.create({
      data: {
        userId,
        sourceId: data.sourceId,
        targetId: data.targetId,
        linkType: data.linkType ?? "RELATED",
      },
    });
    return {
      entityId: row.id,
      canonical: json(row),
      idMap: localId(mutation.entityId)
        ? { [mutation.entityId]: row.id }
        : undefined,
    };
  }

  if (mutation.entity === "languagePreference") {
    const data = LanguagePreferencesDTO.parse(payload);
    const row = await prisma.userLanguagePreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return { entityId: row.id, canonical: json(row) };
  }
  if (mutation.entity === "notificationPreference") {
    const data = NotificationPreferencesDTO.parse(payload);
    const row = await prisma.userNotificationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return { entityId: row.id, canonical: json(row) };
  }
  if (mutation.entity === "languageWord") {
    const existing = await prisma.languageWord.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Word not found"), { statusCode: 404 });
    if (remove) {
      const review = await prisma.languageCardReview.findUnique({
        where: { userId_wordId: { userId, wordId: existing.id } },
        select: { id: true },
      });
      await prisma.languageWord.delete({ where: { id: existing.id } });
      return {
        entityId: existing.id,
        canonical: { id: existing.id, deleted: true },
        relatedChanges: review
          ? [
              {
                entity: "languageReview",
                entityId: review.id,
                changedFields: ["deleted"],
                canonical: { id: review.id, deleted: true },
              },
            ]
          : undefined,
      };
    }
    if (mutation.operation !== "languageWord.enroll") {
      throw Object.assign(
        new Error(`Unsupported offline mutation ${mutation.operation}`),
        { statusCode: 400 },
      );
    }
    const result = await enrollLanguageWord({
      prisma,
      userId,
      wordId: existing.id,
    });
    const localReviewId =
      typeof payload.localReviewId === "string" ? payload.localReviewId : null;
    const relatedChanges: RelatedDomainChange[] = result.reviewId
      ? [
          {
            entity: "languageReview",
            entityId: result.reviewId,
            changedFields: ["reviewState", "storyId"],
            canonical: await currentSnapshot(
              prisma,
              userId,
              "languageReview",
              result.reviewId,
            ),
          },
        ]
      : [];
    return {
      entityId: existing.id,
      canonical: await currentSnapshot(
        prisma,
        userId,
        "languageWord",
        existing.id,
      ),
      idMap:
        result.reviewId && localReviewId && localId(localReviewId)
          ? { [localReviewId]: result.reviewId }
          : undefined,
      relatedChanges,
    };
  }
  if (mutation.entity === "review" || mutation.entity === "languageReview") {
    const expectedOperation =
      mutation.entity === "review" ? "review.grade" : "languageReview.grade";
    if (mutation.operation !== expectedOperation) {
      throw Object.assign(
        new Error(`Unsupported offline mutation ${mutation.operation}`),
        { statusCode: 400 },
      );
    }
    const data = reviewGrade.parse(payload);
    const reviewedAt = new Date(data.reviewedAt);
    if (
      Number.isNaN(reviewedAt.getTime()) ||
      reviewedAt.getTime() > Date.now() + 5 * 60_000
    ) {
      throw Object.assign(new Error("Invalid review timestamp"), {
        statusCode: 400,
      });
    }
    const result = await gradeReviewCard({
      prisma,
      repository:
        mutation.entity === "review"
          ? new PrismaCardReviewRepository()
          : new PrismaLanguageReviewRepository(),
      xpPort: new PrismaXpPort(),
      userId,
      cardId: data.cardId,
      grade: data.grade,
      requestId: mutation.id,
      xpSource: mutation.entity === "review" ? "review" : "language_review",
      reviewedAt,
      transaction: prisma,
      skipRequestClaim: true,
      suppressEvent: true,
    });
    return {
      entityId: result.reviewId,
      canonical: await currentSnapshot(
        prisma,
        userId,
        mutation.entity,
        result.reviewId,
      ),
      relatedChanges:
        mutation.entity === "languageReview"
          ? [
              {
                entity: "languageWord",
                entityId: result.resourceId,
                changedFields: ["status"],
                canonical: await currentSnapshot(
                  prisma,
                  userId,
                  "languageWord",
                  result.resourceId,
                ),
              },
            ]
          : undefined,
    };
  }
  if (mutation.entity === "dailyNote") {
    const data = DailyNoteUpsertDTO.parse(payload);
    const existing = await prisma.dailyNote.findUnique({
      where: { userId_dateKey: { userId, dateKey: data.dateKey } },
    });
    const row = existing
      ? await prisma.dailyNote.update({
          where: { id: existing.id },
          data: { content: json(data.content), version: { increment: 1 } },
        })
      : await prisma.dailyNote.create({
          data: {
            id: data.id,
            userId,
            dateKey: data.dateKey,
            content: json(data.content),
            contentFormat: "TIPTAP_JSON",
          },
        });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "actionItem") {
    if (create) {
      const data = CreateActionItemDTO.parse(payload);
      const key = occurrenceKeyFor(data.id, data.startDate);
      const row = await prisma.actionItem.create({
        data: {
          id: data.id,
          userId,
          title: data.title,
          description: data.description ?? null,
          timingMode: data.timingMode,
          startDate: data.startDate,
          localTime: data.localTime ?? null,
          timezone: data.timezone ?? null,
          recurrence: data.recurrence ? json(data.recurrence) : undefined,
          occurrences: {
            create: {
              id: data.occurrenceId,
              userId,
              occurrenceKey: key,
              originalDateKey: data.startDate,
              currentPlacementId: data.placementId,
              placements: {
                create: {
                  id: data.placementId,
                  userId,
                  occurrenceKey: key,
                  dateKey: data.startDate,
                  timingMode: data.timingMode,
                  localTime: data.localTime ?? null,
                  timezone: data.timezone ?? null,
                  position: data.position,
                },
              },
            },
          },
        },
        include: { occurrences: { include: { placements: true } } },
      });
      const occurrence = row.occurrences[0];
      const placement = occurrence?.placements[0];
      const relatedChanges: RelatedDomainChange[] = [];
      if (occurrence)
        relatedChanges.push({
          entity: "actionOccurrence",
          entityId: occurrence.id,
          changedFields: ["status", "completedAt", "currentPlacementId"],
          canonical: json(occurrence),
        });
      if (placement)
        relatedChanges.push({
          entity: "actionPlacement",
          entityId: placement.id,
          changedFields: ["state", "dateKey", "position"],
          canonical: json(placement),
        });
      return {
        entityId: row.id,
        canonical: json(row),
        relatedChanges: relatedChanges.length ? relatedChanges : undefined,
      };
    }
    const item = await ownedActionItem(prisma, userId, mutation.entityId);
    if (mutation.operation === "actionItem.archive") {
      const row = await prisma.actionItem.update({
        where: { id: item.id },
        data: { lifecycle: "ARCHIVED" },
      });
      return { entityId: row.id, canonical: json(row) };
    }
    const data = UpdateActionItemDTO.parse(payload);
    const row = await prisma.actionItem.update({
      where: { id: item.id },
      data,
    });
    return { entityId: row.id, canonical: json(row) };
  }

  if (mutation.entity === "actionOccurrence") {
    if (mutation.operation === "occurrence.reschedule") {
      const data = RescheduleOccurrenceDTO.parse(payload);
      const occurrence = await ensureOccurrence(prisma, userId, {
        ...data,
        occurrenceId: mutation.entityId,
      });
      const currentId = occurrence.currentPlacementId;
      if (!currentId)
        throw Object.assign(
          new Error("This occurrence has no active placement"),
          { statusCode: 409 },
        );
      if (currentId === data.targetPlacementId)
        return { entityId: occurrence.id, canonical: json(occurrence) };
      const movedFrom = await prisma.actionPlacement.update({
        where: { id: currentId },
        data: {
          state: "MOVED",
          movedToPlacementId: data.targetPlacementId,
        },
      });
      const target = await prisma.actionPlacement.create({
        data: {
          id: data.targetPlacementId,
          userId,
          occurrenceId: occurrence.id,
          occurrenceKey: occurrence.occurrenceKey,
          dateKey: data.targetDateKey,
          timingMode: data.targetTimingMode,
          localTime: data.targetLocalTime ?? null,
          timezone: data.targetTimezone ?? null,
          position: data.targetPosition,
          state: placementStateAfterMove(occurrence.status),
        },
      });
      const row = await prisma.actionOccurrence.update({
        where: { id: occurrence.id },
        data: { currentPlacementId: target.id, version: { increment: 1 } },
        include: { placements: true },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        relatedChanges: [
          {
            entity: "actionPlacement",
            entityId: movedFrom.id,
            changedFields: ["state", "movedToPlacementId"],
            canonical: json(movedFrom),
          },
          {
            entity: "actionPlacement",
            entityId: target.id,
            changedFields: ["state", "dateKey", "position"],
            canonical: json(target),
          },
        ],
      };
    }

    if (mutation.operation === "occurrence.complete") {
      const data = CompleteOccurrenceDTO.parse(payload);
      const occurrence = await ensureOccurrence(prisma, userId, {
        ...data,
        occurrenceId: mutation.entityId,
      });
      if (occurrence.status === "COMPLETED")
        return { entityId: occurrence.id, canonical: json(occurrence) };
      if (!occurrence.currentPlacementId)
        throw Object.assign(
          new Error("This occurrence has no active placement"),
          { statusCode: 409 },
        );
      const placement = await prisma.actionPlacement.update({
        where: { id: occurrence.currentPlacementId },
        data: { state: "COMPLETED" },
      });
      const row = await prisma.actionOccurrence.update({
        where: { id: occurrence.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(data.completedAt),
          version: { increment: 1 },
        },
        include: { placements: true },
      });
      return {
        entityId: row.id,
        canonical: json(row),
        relatedChanges: [
          {
            entity: "actionPlacement",
            entityId: placement.id,
            changedFields: ["state"],
            canonical: json(placement),
          },
        ],
      };
    }

    // occurrence.reopen: a reopened occurrence must already be a durable row
    // (you cannot reopen something that was never completed), so this never
    // materializes a virtual occurrence the way the operations above do.
    OccurrenceCommandDTO.parse(payload);
    const existing = await prisma.actionOccurrence.findFirst({
      where: { id: mutation.entityId, userId },
    });
    if (!existing)
      throw Object.assign(new Error("Occurrence not found"), {
        statusCode: 404,
      });
    if (!existing.currentPlacementId)
      throw Object.assign(
        new Error("This occurrence has no active placement"),
        { statusCode: 409 },
      );
    const placement = await prisma.actionPlacement.update({
      where: { id: existing.currentPlacementId },
      data: { state: "ACTIVE" },
    });
    const row = await prisma.actionOccurrence.update({
      where: { id: existing.id },
      data: { status: "OPEN", completedAt: null, version: { increment: 1 } },
      include: { placements: true },
    });
    return {
      entityId: row.id,
      canonical: json(row),
      relatedChanges: [
        {
          entity: "actionPlacement",
          entityId: placement.id,
          changedFields: ["state"],
          canonical: json(placement),
        },
      ],
    };
  }

  throw Object.assign(
    new Error(`Unsupported offline mutation ${mutation.operation}`),
    { statusCode: 400 },
  );
}

function isCreate(mutation: OfflineMutation) {
  return mutation.operation.endsWith(".create");
}

function isDuplicateReceiptError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as { code?: string }).code === "P2002",
  );
}

function isRejectedMutationError(error: unknown): boolean {
  if (error instanceof ZodError) return true;
  const statusCode = Number(
    (error as { statusCode?: number } | undefined)?.statusCode ?? 0,
  );
  if (statusCode > 0 && statusCode < 500) return true;
  const code = String((error as { code?: string } | undefined)?.code ?? "");
  return [
    "P2002",
    "P2003",
    "P2005",
    "P2006",
    "P2011",
    "P2012",
    "P2014",
    "P2019",
    "P2025",
  ].includes(code);
}

async function persistedResult(
  prisma: any,
  userId: string,
  mutationId: string,
): Promise<OfflineSyncResult | undefined> {
  const receipt = await prisma.offlineMutationReceipt.findUnique({
    where: { userId_mutationId: { userId, mutationId } },
  });
  return receipt?.result as OfflineSyncResult | undefined;
}

async function syncOne(input: {
  prisma: any;
  userId: string;
  mutation: OfflineMutation;
}): Promise<OfflineSyncResult> {
  const { prisma, userId, mutation } = input;
  const replay = await persistedResult(prisma, userId, mutation.id);
  if (replay) return replay;

  if (!isCreate(mutation) && mutation.baseVersion === undefined) {
    return {
      id: mutation.id,
      status: "rejected",
      entity: mutation.entity,
      entityId: mutation.entityId,
      message:
        "This offline update has no base revision. Refresh the downloaded data and try again.",
    };
  }

  try {
    return await prisma.$transaction(
      async (tx: any) => {
        const insideReplay = await persistedResult(tx, userId, mutation.id);
        if (insideReplay) return insideReplay;

        const state = await tx.offlineEntityState.findUnique({
          where: {
            userId_entity_entityId: {
              userId,
              entity: mutation.entity,
              entityId: mutation.entityId,
            },
          },
        });
        if (
          state &&
          !isCreate(mutation) &&
          mutation.baseVersion !== state.version
        ) {
          const versions = fieldVersions(state.fieldVersions);
          const overlappingFields = mutation.changedFields.filter(
            (field) => (versions[field] ?? 0) > mutation.baseVersion!,
          );
          if (overlappingFields.length || state.deletedAt) {
            const conflict: OfflineConflict = {
              entity: mutation.entity,
              entityId: mutation.entityId,
              serverVersion: state.version,
              overlappingFields: state.deletedAt
                ? ["deleted"]
                : overlappingFields,
              serverSnapshot: await currentSnapshot(
                tx,
                userId,
                mutation.entity,
                mutation.entityId,
              ),
              reason: state.deletedAt
                ? "This item was deleted on another device."
                : "The same fields changed on another device.",
            };
            return {
              id: mutation.id,
              status: "conflict",
              entity: mutation.entity,
              entityId: mutation.entityId,
              conflict,
            };
          }
        }

        const applied = await applyDomainMutation({
          prisma: tx,
          userId,
          mutation,
        });
        const stateEntityId = applied.entityId;
        const previous = await tx.offlineEntityState.findUnique({
          where: {
            userId_entity_entityId: {
              userId,
              entity: mutation.entity,
              entityId: stateEntityId,
            },
          },
        });
        const version = (previous?.version ?? 0) + 1;
        const nextFields = {
          ...fieldVersions(previous?.fieldVersions),
          ...Object.fromEntries(
            mutation.changedFields.map((field) => [field, version]),
          ),
        };
        await tx.offlineEntityState.upsert({
          where: {
            userId_entity_entityId: {
              userId,
              entity: mutation.entity,
              entityId: stateEntityId,
            },
          },
          update: {
            version,
            fieldVersions: nextFields,
            deletedAt: mutation.operation.endsWith(".delete")
              ? new Date()
              : null,
          },
          create: {
            userId,
            entity: mutation.entity,
            entityId: stateEntityId,
            version,
            fieldVersions: nextFields,
            deletedAt: mutation.operation.endsWith(".delete")
              ? new Date()
              : null,
          },
        });
        const relatedResults: NonNullable<OfflineSyncResult["related"]> = [];
        for (const related of applied.relatedChanges ?? []) {
          const relatedPrevious = await tx.offlineEntityState.findUnique({
            where: {
              userId_entity_entityId: {
                userId,
                entity: related.entity,
                entityId: related.entityId,
              },
            },
          });
          const relatedVersion = (relatedPrevious?.version ?? 0) + 1;
          const relatedFields = {
            ...fieldVersions(relatedPrevious?.fieldVersions),
            ...Object.fromEntries(
              related.changedFields.map((field) => [field, relatedVersion]),
            ),
          };
          await tx.offlineEntityState.upsert({
            where: {
              userId_entity_entityId: {
                userId,
                entity: related.entity,
                entityId: related.entityId,
              },
            },
            update: {
              version: relatedVersion,
              fieldVersions: relatedFields,
              deletedAt: null,
            },
            create: {
              userId,
              entity: related.entity,
              entityId: related.entityId,
              version: relatedVersion,
              fieldVersions: relatedFields,
              deletedAt: null,
            },
          });
          relatedResults.push({
            entity: related.entity,
            entityId: related.entityId,
            version: relatedVersion,
            canonical:
              related.canonical ??
              (await currentSnapshot(
                tx,
                userId,
                related.entity,
                related.entityId,
              )),
          });
        }
        const result: OfflineSyncResult = {
          id: mutation.id,
          status: "applied",
          entity: mutation.entity,
          entityId: stateEntityId,
          version,
          canonical: applied.canonical,
          idMap: applied.idMap,
          related: relatedResults.length ? relatedResults : undefined,
        };
        // The receipt is committed atomically with the domain write and entity
        // revision. A retry can therefore only observe the same canonical result.
        await tx.offlineMutationReceipt.create({
          data: {
            userId,
            mutationId: mutation.id,
            status: "applied",
            result: result as any,
          },
        });
        return result;
      },
      { maxWait: 5_000, timeout: 15_000 },
    );
  } catch (error: any) {
    if (isDuplicateReceiptError(error)) {
      const winner = await persistedResult(prisma, userId, mutation.id);
      if (winner) return winner;
    }
    const status = isRejectedMutationError(error) ? "rejected" : "retry";
    const result: OfflineSyncResult = {
      id: mutation.id,
      status,
      entity: mutation.entity,
      entityId: mutation.entityId,
      message: error?.message ?? "Offline sync failed",
    };
    if (status === "rejected") {
      try {
        await prisma.offlineMutationReceipt.create({
          data: {
            userId,
            mutationId: mutation.id,
            status,
            result: result as any,
          },
        });
      } catch (receiptError) {
        if (isDuplicateReceiptError(receiptError))
          return (await persistedResult(prisma, userId, mutation.id)) ?? result;
        throw receiptError;
      }
    }
    return result;
  }
}

export async function syncOfflineMutations(input: {
  prisma: any;
  userId: string;
  mutations: OfflineMutation[];
}): Promise<OfflineSyncResponse> {
  const idMap: Record<string, string> = {};
  const results: OfflineSyncResult[] = [];
  const { ordered, cyclic } = orderOfflineMutations(input.mutations);
  for (const mutation of cyclic) {
    results.push({
      id: mutation.id,
      status: "rejected",
      entity: mutation.entity,
      entityId: mutation.entityId,
      message: "Cyclic offline dependency",
    });
  }
  const resultsById = new Map(results.map((result) => [result.id, result]));
  for (const original of ordered) {
    const completedDependency = original.dependsOn
      .map((dependency) => resultsById.get(dependency))
      .find((result) => result && result.status !== "applied");
    if (completedDependency) {
      const result: OfflineSyncResult = {
        id: original.id,
        status: "rejected",
        entity: original.entity,
        entityId: original.entityId,
        message: `A required local change (${completedDependency.id}) was not applied.`,
      };
      results.push(result);
      resultsById.set(result.id, result);
      continue;
    }
    const dependenciesOutsideBatch = original.dependsOn.filter(
      (dependency) => !resultsById.has(dependency),
    );
    if (dependenciesOutsideBatch.length) {
      const receipts = await Promise.all(
        dependenciesOutsideBatch.map((mutationId) =>
          persistedResult(input.prisma, input.userId, mutationId),
        ),
      );
      const missing = receipts.some((receipt) => !receipt);
      const failed = receipts.find(
        (receipt) => receipt && receipt.status !== "applied",
      );
      if (missing || failed) {
        const result: OfflineSyncResult = {
          id: original.id,
          status: missing ? "retry" : "rejected",
          entity: original.entity,
          entityId: original.entityId,
          message: missing
            ? "Waiting for a required local change to sync."
            : "A required local change was rejected.",
        };
        results.push(result);
        resultsById.set(result.id, result);
        continue;
      }
    }
    const mutation = {
      ...original,
      entityId: String(remap(original.entityId, idMap)),
      payload: remap(original.payload, idMap) as JsonRecord,
    };
    const result = await syncOne({
      prisma: input.prisma,
      userId: input.userId,
      mutation,
    });
    results.push(result);
    resultsById.set(result.id, result);
    if (result.idMap) Object.assign(idMap, result.idMap);
  }
  return { serverTime: new Date().toISOString(), results };
}
