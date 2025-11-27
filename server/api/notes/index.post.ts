import { ZodError } from "zod";
import { requireRole } from "@server/middleware/auth";

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

  const folder = await prisma.folder.findFirst({
    where: { id: data.folderId, userId: user.id },
  });
  if (!folder) {
    throw Errors.notFound("Folder");
  }

  // Get the current max order value for this folder
  const maxOrderNote = await prisma.note.findFirst({
    where: { folderId: data.folderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const nextOrder = maxOrderNote ? maxOrderNote.order + 1 : 0;

  const note = await prisma.note.create({
    data: {
      folderId: data.folderId,
      content: data.content,
      order: nextOrder,
    },
  });

  if (process.env.NODE_ENV === "development") {
    NoteSchema.parse(note);
  }

  return success(note, {
    message: "Note created successfully",
    noteId: note.id,
    folderId: data.folderId,
  });
});
