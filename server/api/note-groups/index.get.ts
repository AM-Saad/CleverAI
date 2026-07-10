import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { NoteGroupSchema } from "@@/shared/utils/note-group.contract";

const QuerySchema = z.object({
  workspaceId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Workspace ID must be a valid MongoDB ObjectId"),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest("Invalid query parameters", err.issues);
    }
    throw Errors.badRequest("Invalid query parameters.");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: query.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const groups = await prisma.noteGroup.findMany({
    where: { workspaceId: query.workspaceId },
    orderBy: { position: "asc" },
  });

  if (process.env.NODE_ENV === "development") {
    groups.forEach((group: unknown) => NoteGroupSchema.parse(group));
  }

  return success(groups, {
    count: groups.length,
    workspaceId: query.workspaceId,
  });
});
