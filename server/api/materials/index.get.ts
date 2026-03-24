import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const QuerySchema = z.object({
  workspaceId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Workspace ID must be a valid MongoDB ObjectId"),
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
      throw Errors.badRequest("Invalid query parameters..", err.issues);
    }
    throw Errors.badRequest("Invalid query parameters.");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: query.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const materials = await prisma.material.findMany({
    where: { workspaceId: query.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (process.env.NODE_ENV === "development") {
    materials.forEach((m) => MaterialSchema.parse(m));
  }

  return success(materials, {
    count: materials.length,
    workspaceId: query.workspaceId,
  });
});
