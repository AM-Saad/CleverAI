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
  let request: ReturnType<typeof NotesSyncRequestSchema.parse>;

  try {
    request = NotesSyncRequestSchema.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const response = await syncWorkspaceNotes({
    prisma: event.context.prisma,
    userId: user.id,
    request,
  });

  if (process.env.NODE_ENV === "development") {
    NotesSyncResponseSchema.parse(response);
  }

  return success(response);
});
