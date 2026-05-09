import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CreateNoteDTO, NoteSchema } from "~/shared/utils/note.contract";
import { normalizeWorkspaceNoteTitle } from "@@/shared/utils/workspaceNote";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let data;
  try {
    data = CreateNoteDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const workspace = await prisma.workspace.findFirst({
    where: { id: data.workspaceId, userId: user.id },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const maxOrderNote = await prisma.note.findFirst({
    where: { workspaceId: data.workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const nextOrder = maxOrderNote ? maxOrderNote.order + 1 : 0;

  const note = await prisma.note.create({
    data: {
      workspaceId: data.workspaceId,
      title: normalizeWorkspaceNoteTitle(data.title, data.content),
      content: data.content,
      tags: data.tags || [],
      order: nextOrder,
      noteType: data.noteType ?? "TEXT",
      metadata: data.metadata as any,
    },
  });

  const normalizedNote = {
    ...note,
    title: normalizeWorkspaceNoteTitle(note.title, note.content),
  };

  if (process.env.NODE_ENV === "development") {
    NoteSchema.parse(normalizedNote);
  }

  return success(normalizedNote, {
    message: "Note created successfully",
    noteId: normalizedNote.id,
    workspaceId: data.workspaceId,
  });
});
