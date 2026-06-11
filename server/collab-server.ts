import { Server } from "@hocuspocus/server";
import { prisma } from "./utils/prisma";
import {
  findOwnedTextNote,
  loadNoteCollabDocument,
  parseNoteCollabRoomName,
  storeNoteCollabDocument,
  verifyNoteCollabToken,
} from "./modules/notes/collab/noteCollab";

const port = Number(process.env.COLLAB_PORT || 1234);

const server = new Server({
  port,
  debounce: 1000,
  maxDebounce: 5000,
  quiet: process.env.NODE_ENV === "test",

  async onAuthenticate({ documentName, token }) {
    if (!token || typeof token !== "string") {
      throw new Error("Missing collaboration token");
    }

    const parsedRoom = parseNoteCollabRoomName(documentName);
    if (!parsedRoom) {
      throw new Error("Invalid collaboration room");
    }

    const payload = verifyNoteCollabToken(token);
    if (
      payload.roomName !== documentName ||
      payload.noteId !== parsedRoom.noteId ||
      payload.workspaceId !== parsedRoom.workspaceId
    ) {
      throw new Error("Collaboration token does not match room");
    }

    const note = await findOwnedTextNote({
      prisma,
      userId: payload.userId,
      noteId: payload.noteId,
    });
    if (!note || note.workspaceId !== payload.workspaceId) {
      throw new Error("Not authorized for collaboration room");
    }

    return payload;
  },

  async onLoadDocument({ documentName }) {
    return loadNoteCollabDocument({ prisma, roomName: documentName });
  },

  async onStoreDocument({ documentName, document }) {
    await storeNoteCollabDocument({
      prisma,
      roomName: documentName,
      document,
    });
  },
});

server.listen().then(() => {
  console.log(`[Notes Collab] Hocuspocus listening on ws://127.0.0.1:${port}`);
});

const shutdown = async () => {
  await server.destroy();
  await prisma.$disconnect();
};

process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
