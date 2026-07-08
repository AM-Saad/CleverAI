import { Errors, success } from "@server/utils/error";
import { WorkspaceStudyContentSchema } from "@@/shared/utils/workspace.contract";
import { requireRole } from "~~/server/utils/auth";
import {
  logWorkspaceEndpointTiming,
  measureWorkspacePayload,
} from "~~/server/utils/workspaceSummary";

export default defineEventHandler(async (event) => {
  const authStart = performance.now();
  const user = await requireRole(event, ["USER"]);
  const authMs = performance.now() - authStart;
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id) {
    throw Errors.badRequest("Workspace ID is required");
  }

  const queryStart = performance.now();
  const workspace = await prisma.workspace.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  const [flashcards, questions] = await Promise.all([
    prisma.flashcard.findMany({
      where: { workspaceId: id },
      select: {
        id: true,
        workspaceId: true,
        materialId: true,
        front: true,
        back: true,
        sourceRef: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.findMany({
      where: { workspaceId: id },
      select: {
        id: true,
        workspaceId: true,
        materialId: true,
        type: true,
        question: true,
        choices: true,
        answerIndex: true,
        sourceRef: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const prismaMs = performance.now() - queryStart;
  const data = { flashcards, questions };
  const payload = measureWorkspacePayload(data);
  logWorkspaceEndpointTiming({
    route: "GET /api/workspaces/:id/study-content",
    authMs,
    prismaMs,
    serializeMs: payload.ms,
    payloadBytes: payload.bytes,
  });

  if (process.env.NODE_ENV === "development") {
    WorkspaceStudyContentSchema.parse(data);
  }

  return success(data);
});
