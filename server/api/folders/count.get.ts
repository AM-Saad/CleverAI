import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]); // throws if unauthorized
  const prisma = event.context.prisma;

  const folderCount = await prisma.folder.count({ where: { userId: user.id } });
  return success({ count: folderCount });
});
