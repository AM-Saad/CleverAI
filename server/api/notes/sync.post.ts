import { ZodError } from "zod";
import { requireRole } from "~~/server/middleware/_auth";
import { Errors, success } from "@server/utils/error";
import {
  NotesSyncRequestSchema,
  NotesSyncResponseSchema,
} from "@@/shared/utils/note-sync.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let parsed: ReturnType<typeof NotesSyncRequestSchema.parse>;
  try {
    parsed = NotesSyncRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const applied: string[] = [];
  const conflicts: Array<{ id: string }> = [];

  for (const change of parsed.changes) {
    try {
      if (change.operation === "delete") {
        // Verify ownership through folder
        const note = await prisma.note.findFirst({
          where: { id: change.id, folder: { userId: user.id } },
        });
        if (!note) {
          // Nothing to delete or not owned—treat as applied to unblock client
          applied.push(change.id);
          continue;
        }
        // Conflict if server updatedAt is newer than client timestamp
        if (note.updatedAt && note.updatedAt.getTime() > change.updatedAt) {
          conflicts.push({ id: change.id });
          continue;
        }
        await prisma.note.delete({ where: { id: change.id } });
        applied.push(change.id);
        continue;
      }

      // upsert
      const folder = change.folderId
        ? await prisma.folder.findFirst({
            where: { id: change.folderId, userId: user.id },
          })
        : null;
      if (change.folderId && !folder) {
        // Cannot apply without valid/owned folder
        conflicts.push({ id: change.id });
        continue;
      }

      const existing = await prisma.note.findFirst({
        where: { id: change.id, folder: { userId: user.id } },
      });

      if (!existing) {
        // Create new note with provided content/folder
        if (!change.folderId) {
          conflicts.push({ id: change.id });
          continue;
        }
        await prisma.note.create({
          data: {
            id: change.id,
            folderId: change.folderId,
            content: change.content || "",
          },
        });
        applied.push(change.id);
      } else {
        // Conflict if server newer than client
        if (
          existing.updatedAt &&
          existing.updatedAt.getTime() > change.updatedAt
        ) {
          conflicts.push({ id: change.id });
          continue;
        }
        await prisma.note.update({
          where: { id: change.id },
          data: { content: change.content ?? existing.content },
        });
        applied.push(change.id);
      }
    } catch (e) {
      // On unexpected errors per change, mark as conflict to retain client copy
      conflicts.push({ id: change.id });
    }
  }

  const response = { applied, conflicts };
  if (process.env.NODE_ENV === "development") {
    NotesSyncResponseSchema.parse(response);
  }
  return success(response);
});
