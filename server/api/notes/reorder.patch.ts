import type { Note } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { ReorderNotesDTO, NoteSchema } from "@@/shared/utils/note.contract";
import { applyWorkspaceNoteLayout } from "@server/modules/notes/application/applyWorkspaceNoteLayout";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data: ReorderNotesDTO;
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

    await applyWorkspaceNoteLayout({
      prisma,
      userId: user.id,
      layout: {
        id: data.workspaceId,
        workspaceId: data.workspaceId,
        updatedAt: Date.now(),
        localVersion: 1,
        notes: data.noteOrders.map((noteOrder) => ({
          id: noteOrder.id,
          groupId: noteOrder.groupId ?? null,
          order: noteOrder.order,
        })),
        groups: [],
      },
    });

    return success({ layoutApplied: true }, {
      message: "Notes reordered successfully",
      workspaceId: data.workspaceId,
    });
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }

    console.error("💥 [API /notes/reorder] Unhandled error:", error);
    console.error("Stack trace:", error.stack);
    throw Errors.server(
      `Failed to reorder notes: ${error.message || "Unknown error"}`
    );
  }
});
