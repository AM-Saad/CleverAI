import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]); // throws if unauthorized
  const prisma = event.context.prisma;
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: { materials: true, flashcards: true, questions: true },
      orderBy: { order: "asc" },
    });
    return success(folders);
  } catch {
    throw Errors.server("Failed to fetch folders");
  }
});
