import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  CreateNoteGroupDTO,
  NoteGroupSchema,
} from "@@/shared/utils/note-group.contract";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { positionBetween } from "@@/shared/utils/position-key";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let data: CreateNoteGroupDTO;
  try {
    data = CreateNoteGroupDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: data.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const maxOrderGroup = await prisma.noteGroup.findFirst({
    where: { workspaceId: data.workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const group = await prisma.noteGroup.create({
    data: {
      workspaceId: data.workspaceId,
      title: data.title,
      order: maxOrderGroup ? maxOrderGroup.order + 1 : 0,
      position: positionBetween((await prisma.noteGroup.findFirst({ where: { workspaceId: data.workspaceId }, orderBy: { position: "desc" }, select: { position: true } }))?.position, null),
    },
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "noteGroup", entityId: group.id, changedFields: ["title", "position"] });

  if (process.env.NODE_ENV === "development") {
    NoteGroupSchema.parse(group);
  }

  return success(group, {
    message: "Note group created successfully",
    groupId: group.id,
    workspaceId: data.workspaceId,
  });
});
