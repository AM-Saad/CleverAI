import type { Note } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { NoteSchema } from "~/shared/utils/note.contract";
import { normalizeWorkspaceNoteTitle } from "@@/shared/utils/workspaceNote";

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

  const notes: Note[] = await prisma.note.findMany({
    where: { workspaceId: query.workspaceId },
    orderBy: { order: "asc" },
  });

  const normalizedNotes = notes.map((note) => ({
    ...note,
    title: normalizeWorkspaceNoteTitle(note.title, note.content),
  }));

  if (process.env.NODE_ENV === "development") {
    normalizedNotes.forEach((note) => NoteSchema.parse(note));
  }

  return success(normalizedNotes, {
    count: normalizedNotes.length,
    workspaceId: query.workspaceId,
  });
});
