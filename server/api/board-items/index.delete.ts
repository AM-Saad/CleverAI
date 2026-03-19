import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const { id } = body;

  if (!id || typeof id !== "string") {
    throw Errors.badRequest("Board item ID is required");
  }

  const item = await prisma.boardItem.findFirst({
    where: { id, userId: user.id },
  });

  if (!item) {
    throw Errors.notFound("Board item");
  }

  await prisma.boardItem.delete({
    where: { id },
  });

  return success(null, { message: "Board item deleted successfully" });
});
