import { readBody } from "h3";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { GatewayGenerateRequest } from "~/shared/utils/llm-generate.contract";
import { runGatewayGeneration } from "@server/modules/ai-generation/application/runGatewayGeneration";

export default defineEventHandler(async (event) => {
  const requestStartTime = Date.now();
  const prisma = event.context.prisma;
  const user = await requireRole(event, ["USER"]);
  const raw = await readBody(event);
  const parseResult = GatewayGenerateRequest.safeParse(raw);
  if (!parseResult.success) {
    throw Errors.badRequest(
      "Invalid request body",
      parseResult.error.flatten()
    );
  }
  const runResult = await runGatewayGeneration({
    event,
    prisma,
    user,
    request: parseResult.data,
    requestStartTime,
  });
  Object.entries(runResult.headers).forEach(([name, value]) => {
    event.node.res.setHeader(name, value);
  });
  return success(runResult.response);
});
