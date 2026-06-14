import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  RunWorkspaceImportDTO,
  RunWorkspaceImportResponseSchema,
} from "../../../shared/utils/workspaceIntegration.contract";
import { importWorkspaceContent } from "@server/modules/integrations/application/importWorkspaceContent";
import { throwActionableIntegrationError } from "@server/modules/integrations/application/integrationRouteErrors";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let body: RunWorkspaceImportDTO;
  try {
    body = RunWorkspaceImportDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid import payload", error.issues);
    }
    throw error;
  }

  try {
    const result = await importWorkspaceContent({
      prisma,
      userId: user.id,
      request: body,
    });
    return success(RunWorkspaceImportResponseSchema.parse(result), {
      message: "Workspace content imported",
    });
  } catch (error) {
    throwActionableIntegrationError(error, undefined, "import workspace content");
  }
});
