import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  RefreshWorkspaceImportDTO,
  RunWorkspaceImportResponseSchema,
} from "../../../shared/utils/workspaceIntegration.contract";
import { refreshWorkspaceImport } from "@server/modules/integrations/application/refreshWorkspaceImport";
import { throwActionableIntegrationError } from "@server/modules/integrations/application/integrationRouteErrors";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let body: RefreshWorkspaceImportDTO;
  try {
    body = RefreshWorkspaceImportDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid refresh payload", error.issues);
    }
    throw error;
  }

  try {
    const result = await refreshWorkspaceImport({
      prisma,
      userId: user.id,
      request: body,
    });
    return success(RunWorkspaceImportResponseSchema.parse(result), {
      message: "Workspace import refreshed",
    });
  } catch (error) {
    throwActionableIntegrationError(error, undefined, "refresh workspace import");
  }
});
