import type { Note, Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { type UpdateNoteDTO, UpdateNoteDTO as UpdateNoteDTOSchema, NoteSchema } from "~/shared/utils/note.contract";
import { normalizeWorkspaceNoteTitle } from "@@/shared/utils/workspaceNote";

// Simple retry helper for transient Prisma write conflicts / deadlocks.
// Uses exponential backoff with jitter. Keep local to this route for now; can be
// promoted to a shared util if needed elsewhere.
async function retryPrismaUpdate<T>(
  fn: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      // Prisma deadlock / write conflict message heuristic. Older Prisma (4.x) does not expose a distinct error code.
      const msg = String(err?.message || "");
      const isConflict = /write conflict|deadlock/i.test(msg);
      if (!isConflict) throw err; // Non-transient, propagate immediately.
      lastErr = err;
      // Backoff: base 50ms -> 50 * 2^i plus jitter (0-25ms)
      const sleep = 50 * Math.pow(2, i) + Math.floor(Math.random() * 25);
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  throw lastErr;
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);

  let data: UpdateNoteDTO;
  try {
    data = UpdateNoteDTOSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const { id } = body;
  if (!id || typeof id !== "string") {
    throw Errors.badRequest("Note ID is required");
  }

  try {
    // Find the note and verify ownership
    const note = await prisma.note.findFirst({
      where: { id },
    });

    if (!note) {
      throw Errors.notFound("Note");
    }

    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: note.workspaceId, userId: user.id },
    });
    if (!workspace) {
      throw Errors.notFound("Note");
    }

    if (data.groupId) {
      const group = await (prisma as any).noteGroup.findFirst({
        where: { id: data.groupId, workspaceId: note.workspaceId },
      });
      if (!group) {
        throw Errors.badRequest("Note group does not belong to this workspace");
      }
    }

    const updateData: any = {
      title: normalizeWorkspaceNoteTitle(
        data.title !== undefined ? data.title : note.title,
        data.content !== undefined ? data.content : note.content,
      ),
      ...(data.groupId !== undefined && { groupId: data.groupId }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.noteType !== undefined && { noteType: data.noteType }),
      ...(data.metadata !== undefined && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
      version: { increment: 1 },
    };

    const updatedNote: Note = await retryPrismaUpdate(() =>
      prisma.note.update({
        where: { id },
        data: updateData,
      })
    );

    const normalizedNote = {
      ...updatedNote,
      title: normalizeWorkspaceNoteTitle(updatedNote.title, updatedNote.content),
    };

    if (process.env.NODE_ENV === "development") {
      NoteSchema.parse(normalizedNote);
    }

    return success(normalizedNote, {
      message: "Note updated successfully",
      noteId: normalizedNote.id,
    });
  } catch (error: any) {
    // Provide slightly more actionable messaging for conflict scenario (frontend can optionally surface a soft warning)
    const msg = String(error?.message || "");
    if (/write conflict|deadlock/i.test(msg)) {
      console.error("Prisma write conflict after retries for note", id, error);
      throw Errors.server("Note update temporarily conflicted. Please retry.");
    }
    console.error("Error updating note:", error);
    throw Errors.server("An error occurred while updating the note.");
  }
});
