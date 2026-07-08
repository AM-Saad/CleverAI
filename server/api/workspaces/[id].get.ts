import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";
import { WorkspaceSummarySchema } from "@@/shared/utils/workspace.contract";
import {
  logWorkspaceEndpointTiming,
  measureWorkspacePayload,
  workspaceSummarySelect,
} from "~~/server/utils/workspaceSummary";

export default defineEventHandler(async (event) => {
  const authStart = performance.now();
  const user = await requireRole(event, ["USER"]); // throws if unauthorized
  const authMs = performance.now() - authStart;
  const prisma = event.context.prisma;
  const id = getRouterParam(event, "id");

  if (!id) {
    throw Errors.badRequest("Workspace ID is required");
  }

  const queryStart = performance.now();
  const workspace = await prisma.workspace.findFirst({
    where: { id, userId: user.id },
    select: workspaceSummarySelect,
  });
  const prismaMs = performance.now() - queryStart;
  if (!workspace) {
    throw Errors.notFound("Workspace");
  }
  const payload = measureWorkspacePayload(workspace);
  logWorkspaceEndpointTiming({
    route: "GET /api/workspaces/:id",
    authMs,
    prismaMs,
    serializeMs: payload.ms,
    payloadBytes: payload.bytes,
  });
  if (process.env.NODE_ENV === "development") {
    WorkspaceSummarySchema.parse(workspace);
  }
  return success(workspace);
});
