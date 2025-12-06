import { requireRole } from "@server/middleware/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const { id } = body;

  if (!id || typeof id !== "string") {
    throw Errors.badRequest("Note ID is required");
  }

  // Find the note and verify ownership through folder
  const note = await prisma.note.findFirst({
    where: {
      id,
      folder: { userId: user.id },
    },
  });

  if (!note) {
    throw Errors.notFound("Note");
  }

  await prisma.note.delete({
    where: { id },
  });

  return success(
    { success: true },
    { message: "Note deleted successfully", noteId: id }
  );
});
