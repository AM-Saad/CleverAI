import { ZodError } from "zod";
import { requireRole } from "@server/middleware/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderNotesDTO } from "@@/shared/utils/note.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);
    console.log("🔄 [API /notes/reorder] Request received:", { userId: user.id, body });
    
    let data;
    try {
      data = ReorderNotesDTO.parse(body);
      console.log("✅ [API /notes/reorder] Validation passed:", data);
    } catch (err) {
      console.error("❌ [API /notes/reorder] Validation failed:", err);
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

  // Verify folder ownership
  const folder = await prisma.folder.findFirst({
    where: { id: data.folderId, userId: user.id },
  });
  if (!folder) {
    console.error("❌ [API /notes/reorder] Folder not found or not owned:", data.folderId);
    throw Errors.notFound("Folder");
  }
  console.log("✅ [API /notes/reorder] Folder verified:", folder.id);

  // Verify all notes belong to this folder
  const noteIds = data.noteOrders.map((n) => n.id);
  const notes = await prisma.note.findMany({
    where: {
      id: { in: noteIds },
      folderId: data.folderId,
    },
  });
  console.log("📝 [API /notes/reorder] Found notes:", { requested: noteIds.length, found: notes.length });

  if (notes.length !== noteIds.length) {
    console.error("❌ [API /notes/reorder] Some notes don't belong to folder");
    throw Errors.badRequest("Some notes do not belong to this folder");
  }

  // Update all note orders in a transaction
  console.log("🔄 [API /notes/reorder] Starting transaction to update orders...");
  const updatePromises = data.noteOrders.map((noteOrder) =>
    prisma.note.update({
      where: { id: noteOrder.id },
      data: { order: noteOrder.order },
    })
  );

  await prisma.$transaction(updatePromises);
  console.log("✅ [API /notes/reorder] Transaction completed");

  // Fetch updated notes for verification
  const updatedNotes = await prisma.note.findMany({
    where: { folderId: data.folderId },
    orderBy: { order: "asc" },
  });
  console.log("📦 [API /notes/reorder] Returning updated notes:", updatedNotes.length);

  if (process.env.NODE_ENV === "development") {
    updatedNotes.forEach((n) => NoteSchema.parse(n));
  }

  return success(updatedNotes, {
    message: "Notes reordered successfully",
    count: updatedNotes.length,
    folderId: data.folderId,
  });
  } catch (error: any) {
    console.error("💥 [API /notes/reorder] Unhandled error:", error);
    console.error("Stack trace:", error.stack);
    throw Errors.server(`Failed to reorder notes: ${error.message || 'Unknown error'}`);
  }
});
