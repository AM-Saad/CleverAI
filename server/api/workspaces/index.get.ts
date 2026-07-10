import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
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
  try {
    const queryStart = performance.now();
    const workspaces = await prisma.workspace.findMany({
      where: { userId: user.id },
      select: workspaceSummarySelect,
      orderBy: { position: "asc" },
    });
    const prismaMs = performance.now() - queryStart;
    const payload = measureWorkspacePayload(workspaces);
    logWorkspaceEndpointTiming({
      route: "GET /api/workspaces",
      authMs,
      prismaMs,
      serializeMs: payload.ms,
      payloadBytes: payload.bytes,
    });
    if (process.env.NODE_ENV === "development") {
      WorkspaceSummarySchema.array().parse(workspaces);
    }
    return success(workspaces);
  } catch {
    throw Errors.server("Failed to fetch workspaces");
  }
});
