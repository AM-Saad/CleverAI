import { z } from "zod";
import { requireRole } from "@server/middleware/auth";
import { Errors, success } from "@server/utils/error";

const QuerySchema = z.object({
  folderId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Folder ID must be a valid MongoDB ObjectId"),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const rawQuery = getQuery(event);
  let query;
  try {
    query = QuerySchema.parse(rawQuery);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest("Invalid query parameters", err.issues);
    }
    throw Errors.badRequest("Invalid query parameters.");
  }

  const folder = await prisma.folder.findFirst({
    where: { id: query.folderId, userId: user.id },
  });
  if (!folder) {
    throw Errors.notFound("Folder");
  }

  const notes = await prisma.note.findMany({
    where: { folderId: query.folderId },
    orderBy: { order: "asc" },
  });

  if (process.env.NODE_ENV === "development") {
    notes.forEach((n) => NoteSchema.parse(n));
  }

  return success(notes, { count: notes.length, folderId: query.folderId });
});
