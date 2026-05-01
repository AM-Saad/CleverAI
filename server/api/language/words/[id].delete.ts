import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Word ID is required");
  }

  const word = await prisma.languageWord.findFirst({
    where: { id, userId: user.id },
  });
  if (!word) {
    throw Errors.notFound("Word");
  }

  await prisma.languageWord.delete({ where: { id } });

  return success({ message: "Word deleted successfully" });
});
