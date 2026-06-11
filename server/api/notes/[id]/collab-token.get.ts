import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  buildNoteCollabRoomName,
  findOwnedTextNote,
  signNoteCollabToken,
} from "@server/modules/notes/collab/noteCollab";
import { NoteCollabTokenResponseSchema } from "@@/shared/utils/note-collab.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");
  if (!id) throw Errors.badRequest("Note ID is required");

  const note = await findOwnedTextNote({ prisma, userId: user.id, noteId: id });
  if (!note) throw Errors.notFound("Note");

  const roomName = buildNoteCollabRoomName({
    workspaceId: note.workspaceId,
    noteId: note.id,
  });
  const token = signNoteCollabToken({
    userId: user.id,
    workspaceId: note.workspaceId,
    noteId: note.id,
    roomName,
  });
  const websocketUrl =
    useRuntimeConfig().public.collabWsUrl ||
    process.env.NUXT_PUBLIC_COLLAB_WS_URL ||
    "ws://127.0.0.1:1234";
  const response = {
    token,
    roomName,
    websocketUrl,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    NoteCollabTokenResponseSchema.parse(response);
  }

  return success(response);
});
