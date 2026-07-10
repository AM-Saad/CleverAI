import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  NoteGroupSchema,
  UpdateNoteGroupDTO,
  type UpdateNoteGroupDTO as UpdateNoteGroupPayload,
} from "@@/shared/utils/note-group.contract";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Note group ID is required");
  }

  let data: UpdateNoteGroupPayload;
  try {
    data = UpdateNoteGroupDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const group = await prisma.noteGroup.findFirst({ where: { id } });
  if (!group) {
    throw Errors.notFound("Note group");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: group.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Note group");
  }

  const updatedGroup = await prisma.noteGroup.update({
    where: { id },
    data: { title: data.title },
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "noteGroup", entityId: id, changedFields: ["title"] });

  if (process.env.NODE_ENV === "development") {
    NoteGroupSchema.parse(updatedGroup);
  }

  return success(updatedGroup, {
    message: "Note group updated successfully",
    groupId: id,
  });
});
