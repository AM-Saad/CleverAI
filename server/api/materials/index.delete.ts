import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { deleteOwnedMaterial } from "@server/modules/materials/application/deleteOwnedMaterial";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const schema = z.object({ id: z.string() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const { id } = parsed.data;

  const deleted = await prisma.$transaction(async (tx: any) => {
    const result = await deleteOwnedMaterial({
      prisma: tx,
      userId: user.id,
      materialId: id,
    });
    if (result) {
      await advanceOfflineEntityState({
        prisma: tx,
        userId: user.id,
        entity: "material",
        entityId: id,
        changedFields: ["deleted"],
        deleted: true,
      });
    }
    return result;
  });
  if (!deleted) {
    throw Errors.notFound("Material");
  }

  return success({
    message: "Material deleted successfully",
    deletedReviewsCount: deleted.deletedReviewsCount,
  });
});
