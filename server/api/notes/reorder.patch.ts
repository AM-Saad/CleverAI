import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderNotesDTO, NoteSchema } from "@@/shared/utils/note.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data;
    try {
      data = ReorderNotesDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: data.workspaceId, userId: user.id },
    });
    if (!workspace) {
      throw Errors.notFound("Workspace");
    }

    // Verify all notes belong to this workspace
    const noteIds = data.noteOrders.map((n) => n.id);
    const notes = await prisma.note.findMany({
      where: {
        id: { in: noteIds },
        workspaceId: data.workspaceId,
      },
    });

    if (notes.length !== noteIds.length) {
      throw Errors.badRequest("Some notes do not belong to this workspace");
    }

    // Update all note orders in a transaction
    const updatePromises = data.noteOrders.map((noteOrder) =>
      prisma.note.update({
        where: { id: noteOrder.id },
        data: { order: noteOrder.order },
      })
    );

    await prisma.$transaction(updatePromises);

    // Fetch updated notes for verification
    const updatedNotes = await prisma.note.findMany({
      where: { workspaceId: data.workspaceId },
      orderBy: { order: "asc" },
    });

    if (process.env.NODE_ENV === "development") {
      updatedNotes.forEach((n) => NoteSchema.parse(n));
    }

    return success(updatedNotes, {
      message: "Notes reordered successfully",
      count: updatedNotes.length,
      workspaceId: data.workspaceId,
    });
  } catch (error: any) {
    console.error("💥 [API /notes/reorder] Unhandled error:", error);
    console.error("Stack trace:", error.stack);
    throw Errors.server(
      `Failed to reorder notes: ${error.message || "Unknown error"}`
    );
  }
});
