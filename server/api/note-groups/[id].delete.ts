import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Note group ID is required");
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

  await prisma.$transaction(async (tx: any) => {
    await tx.note.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });
    await tx.noteGroup.delete({ where: { id } });
  });
  await advanceOfflineEntityState({ prisma, userId: user.id, entity: "noteGroup", entityId: id, changedFields: ["deleted"], deleted: true });

  return success(
    { success: true },
    {
      message: "Note group deleted successfully",
      groupId: id,
      workspaceId: group.workspaceId,
    },
  );
});
