import { z } from "zod";
import { requireRole } from "@server/middleware/auth";

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
    console.log("Parsed query:", query);
  } catch (err) {
    console.log("Query parsing error:", err);
    if (err instanceof z.ZodError) {
      throw Errors.badRequest("Invalid query parameters..", err.issues);
    }
    throw Errors.badRequest("Invalid query parameters.");
  }

  const folder = await prisma.folder.findFirst({
    where: { id: query.folderId, userId: user.id },
  });
  if (!folder) {
    throw Errors.notFound("Folder");
  }

  const materials = await prisma.material.findMany({
    where: { folderId: query.folderId },
    orderBy: { createdAt: "desc" },
  });

  if (process.env.NODE_ENV === "development") {
    materials.forEach((m) => MaterialSchema.parse(m));
  }

  return success(materials, {
    count: materials.length,
    folderId: query.folderId,
  });
});
