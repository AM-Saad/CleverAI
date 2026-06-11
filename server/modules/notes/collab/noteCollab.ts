import jwt from "jsonwebtoken";
import * as Y from "yjs";

export const NOTE_COLLAB_SCHEMA_VERSION = 1;
export const NOTE_COLLAB_FIELD = "body";

export type NoteCollabTokenPayload = {
  userId: string;
  workspaceId: string;
  noteId: string;
  roomName: string;
};

export function buildNoteCollabRoomName(input: {
  workspaceId: string;
  noteId: string;
}) {
  return `workspace:${input.workspaceId}:note:${input.noteId}:body`;
}

export function parseNoteCollabRoomName(roomName: string) {
  const match = /^workspace:([^:]+):note:([^:]+):body$/.exec(roomName);
  if (!match) return null;
  return {
    workspaceId: match[1],
    noteId: match[2],
  };
}

function getCollabJwtSecret() {
  const secret = process.env.COLLAB_JWT_SECRET || process.env.AUTH_SECRET || process.env.NUXT_AUTH_SECRET;
  if (!secret) {
    throw new Error("COLLAB_JWT_SECRET is required for notes collaboration");
  }
  return secret;
}

export function signNoteCollabToken(payload: NoteCollabTokenPayload) {
  return jwt.sign(payload, getCollabJwtSecret(), {
    expiresIn: "5m",
    audience: "notes-collaboration",
    issuer: "clever-notes",
  });
}

export function verifyNoteCollabToken(token: string): NoteCollabTokenPayload {
  return jwt.verify(token, getCollabJwtSecret(), {
    audience: "notes-collaboration",
    issuer: "clever-notes",
  }) as NoteCollabTokenPayload;
}

export async function findOwnedTextNote(input: {
  prisma: any;
  userId: string;
  noteId: string;
}) {
  const note = await input.prisma.note.findFirst({
    where: { id: input.noteId },
  });
  if (!note || note.noteType === "MATH" || note.noteType === "CANVAS") return null;

  const workspace = await input.prisma.workspace.findFirst({
    where: { id: note.workspaceId, userId: input.userId },
  });
  if (!workspace) return null;

  return note;
}

export async function loadNoteCollabDocument(input: {
  prisma: any;
  roomName: string;
}) {
  const parsed = parseNoteCollabRoomName(input.roomName);
  if (!parsed) return new Y.Doc();

  const record = await input.prisma.noteCollabDocument.findUnique({
    where: { noteId: parsed.noteId },
  });
  const doc = new Y.Doc();
  if (record?.state) {
    Y.applyUpdate(doc, new Uint8Array(record.state));
  }
  return doc;
}

export async function storeNoteCollabDocument(input: {
  prisma: any;
  roomName: string;
  document: Y.Doc;
}) {
  const parsed = parseNoteCollabRoomName(input.roomName);
  if (!parsed) return;

  const state = Buffer.from(Y.encodeStateAsUpdate(input.document));
  await input.prisma.noteCollabDocument.upsert({
    where: { noteId: parsed.noteId },
    update: {
      state,
      initialized: state.length > 0,
      schemaVersion: NOTE_COLLAB_SCHEMA_VERSION,
    },
    create: {
      noteId: parsed.noteId,
      workspaceId: parsed.workspaceId,
      state,
      initialized: state.length > 0,
      schemaVersion: NOTE_COLLAB_SCHEMA_VERSION,
    },
  });
}
