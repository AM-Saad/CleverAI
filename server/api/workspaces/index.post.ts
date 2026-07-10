import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { WorkspaceSummarySchema } from "@@/shared/utils/workspace.contract";
import { workspaceSummarySelect } from "~~/server/utils/workspaceSummary";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { positionBetween } from "@@/shared/utils/position-key";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const parsed = CreateWorkspaceDTO.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const { metadata } = parsed.data;
  const title = parsed.data.title.trim();
  const description = parsed.data.description?.trim() ?? null;


  const maxOrder = await prisma.workspace.aggregate({
    _max: { order: true },
    where: { userId: user.id },
  });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;
  const lastPositioned = await prisma.workspace.findFirst({ where: { userId: user.id }, orderBy: { position: "desc" }, select: { position: true } });

  const created = await prisma.workspace.create({
    data: {
      title,
      description: description ?? null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      order: nextOrder,
      position: positionBetween(lastPositioned?.position, null),
      user: { connect: { id: user.id } },
    },
    select: workspaceSummarySelect,
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "workspace", entityId: created.id, changedFields: ["title", "description", "metadata", "position"] });

  if (process.env.NODE_ENV === "development") {
    WorkspaceSummarySchema.parse(created);
  }
  setResponseStatus(event, 201);
  return success(created);
});
