import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  NotesSyncRequestSchema,
  NotesSyncResponseSchema,
} from "@@/shared/utils/note-sync.contract";
import { syncWorkspaceNotes } from "@server/modules/notes/application/syncWorkspaceNotes";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  let parsed: ReturnType<typeof NotesSyncRequestSchema.parse>;
  try {
    parsed = NotesSyncRequestSchema.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const response = await syncWorkspaceNotes({
    prisma,
    userId: user.id,
    request: parsed,
  });

  if (process.env.NODE_ENV === "development") {
    NotesSyncResponseSchema.parse(response);
  }

  return success(response);
});
