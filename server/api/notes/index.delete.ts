import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const { id } = body;

  if (!id || typeof id !== "string") {
    throw Errors.badRequest("Note ID is required");
  }

  // Find the note and verify ownership
  const note = await prisma.note.findFirst({
    where: { id },
  });

  if (!note) {
    throw Errors.notFound("Note");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: note.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Note");
  }

  await prisma.note.delete({
    where: { id },
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "note", entityId: id, changedFields: ["deleted"], deleted: true });

  return success(
    { success: true },
    { message: "Note deleted successfully", noteId: id }
  );
});
