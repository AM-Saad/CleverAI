import type { Prisma } from "@prisma/client";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  MaterialLibraryPageSchema,
  MaterialLibraryQuerySchema,
  type MaterialLibraryTypeFilter,
} from "@@/shared/utils/material.contract";

const DOCUMENT_TYPES = ["docx", "document"];
const TEXT_TYPES = ["txt", "text"];
const KNOWN_TYPES = ["pdf", ...DOCUMENT_TYPES, ...TEXT_TYPES];

function typeWhere(type: MaterialLibraryTypeFilter): Prisma.MaterialWhereInput {
  if (type === "pdf") return { type: "pdf" };
  if (type === "docx") return { type: { in: DOCUMENT_TYPES } };
  if (type === "txt") return { type: { in: TEXT_TYPES } };
  if (type === "other") {
    return {
      OR: [{ type: null }, { type: { notIn: KNOWN_TYPES } }],
    };
  }
  return {};
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const parsed = MaterialLibraryQuerySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw Errors.badRequest(
      "Invalid material library query.",
      parsed.error.issues,
    );
  }

  const query = parsed.data;
  const prisma = event.context.prisma;
  const workspace = await prisma.workspace.findFirst({
    where: { id: query.workspaceId, userId: user.id },
    select: { id: true },
  });
  if (!workspace) throw Errors.notFound("Workspace");

  const where: Prisma.MaterialWhereInput = {
    workspaceId: query.workspaceId,
    ...typeWhere(query.type),
    ...(query.search
      ? {
          title: {
            contains: query.search,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  if (query.cursor) {
    const cursorExists = await prisma.material.findFirst({
      where: { ...where, id: query.cursor },
      select: { id: true },
    });
    if (!cursorExists) throw Errors.badRequest("Invalid material cursor.");
  }

  const orderBy: Prisma.MaterialOrderByWithRelationInput[] =
    query.sort === "name"
      ? [{ title: "asc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.material.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        title: true,
        type: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    prisma.material.count({ where }),
  ]);

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const page = {
    items,
    total,
    hasMore,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };

  if (process.env.NODE_ENV === "development") {
    MaterialLibraryPageSchema.parse(page);
  }

  return success(page, {
    workspaceId: query.workspaceId,
    count: items.length,
  });
});
