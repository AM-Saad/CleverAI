import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const linkId = getRouterParam(event, "linkId");

  if (!linkId) throw Errors.badRequest("Link ID is required");

  // Only allow deletion if this link belongs to the user
  const link = await prisma.boardItemLink.findFirst({
    where: { id: linkId, userId: user.id },
    select: { id: true },
  });

  if (!link) throw Errors.notFound("Board item link");

  try {
    await prisma.boardItemLink.delete({ where: { id: linkId } });
    setResponseStatus(event, 204);
    return null;
  } catch (error) {
    console.error("Failed to delete board item link:", error);
    throw Errors.server("Failed to delete board item link");
  }
});
