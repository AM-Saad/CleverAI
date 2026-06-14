import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  PreviewWorkspaceImportDTO,
  PreviewWorkspaceImportResponseSchema,
} from "../../../shared/utils/workspaceIntegration.contract";
import { previewWorkspaceImport } from "@server/modules/integrations/application/previewWorkspaceImport";
import { throwActionableIntegrationError } from "@server/modules/integrations/application/integrationRouteErrors";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let body: PreviewWorkspaceImportDTO;
  try {
    body = PreviewWorkspaceImportDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid preview payload", error.issues);
    }
    throw error;
  }

  try {
    const result = await previewWorkspaceImport({
      prisma,
      userId: user.id,
      request: body,
    });
    return success(PreviewWorkspaceImportResponseSchema.parse(result));
  } catch (error) {
    throwActionableIntegrationError(error, undefined, "preview workspace import");
  }
});
