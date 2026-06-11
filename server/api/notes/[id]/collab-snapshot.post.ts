import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { normalizeWorkspaceNoteTitle } from "@@/shared/utils/workspaceNote";
import {
  NoteCollabSnapshotRequestSchema,
  NoteCollabSnapshotResponseSchema,
} from "@@/shared/utils/note-collab.contract";
import { findOwnedTextNote } from "@server/modules/notes/collab/noteCollab";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");
  if (!id) throw Errors.badRequest("Note ID is required");

  let body: ReturnType<typeof NoteCollabSnapshotRequestSchema.parse>;
  try {
    body = NoteCollabSnapshotRequestSchema.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const note = await findOwnedTextNote({ prisma, userId: user.id, noteId: id });
  if (!note) throw Errors.notFound("Note");

  const title = normalizeWorkspaceNoteTitle(body.title ?? note.title, body.content);
  const updated = await prisma.note.update({
    where: { id },
    data: {
      title,
      content: body.content,
      metadata: {
        ...((note.metadata && typeof note.metadata === "object" && !Array.isArray(note.metadata))
          ? note.metadata
          : {}),
        collabProjectionUpdatedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  const response = {
    id: updated.id,
    title: normalizeWorkspaceNoteTitle(updated.title, updated.content),
    content: updated.content,
    version: updated.version ?? note.version ?? 1,
    updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : undefined,
  };

  if (process.env.NODE_ENV === "development") {
    NoteCollabSnapshotResponseSchema.parse(response);
  }

  return success(response);
});
