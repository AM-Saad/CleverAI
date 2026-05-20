import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  NoteGroupSchema,
  ReorderNoteGroupsDTO,
  type ReorderNoteGroupsDTO as ReorderNoteGroupsPayload,
} from "@@/shared/utils/note-group.contract";
import { applyWorkspaceNoteLayout } from "@server/modules/notes/application/applyWorkspaceNoteLayout";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let data: ReorderNoteGroupsPayload;
  try {
    data = ReorderNoteGroupsDTO.parse(await readBody(event));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message })),
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
      notes: [],
      groups: data.groupOrders,
    },
  });

  return success({ layoutApplied: true }, {
    message: "Note groups reordered successfully",
    workspaceId: data.workspaceId,
  });
});
