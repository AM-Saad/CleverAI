import { ZodError } from "zod";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";

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

  let data;
  try {
    data = UpdateNoteDTO.parse(body);
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

    const updatedNote = await retryPrismaUpdate(() =>
      prisma.note.update({
        where: { id },
        data: {
          content: data.content,
        },
      })
    );

    if (process.env.NODE_ENV === "development") {
      NoteSchema.parse(updatedNote);
    }

    return success(updatedNote, {
      message: "Note updated successfully",
      noteId: updatedNote.id,
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
