import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  ImportExternalBoardDTO,
  ImportExternalBoardResponseSchema,
} from "../../../shared/utils/boardIntegration.contract";
import { importExternalBoardItems } from "@server/modules/integrations/application/importExternalBoardItems";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let body: ImportExternalBoardDTO;
  try {
    body = ImportExternalBoardDTO.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid import payload",
        error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      );
    }
    throw error;
  }

  try {
    const result = await importExternalBoardItems({
      prisma,
      userId: user.id,
      request: body,
    });
    return success(ImportExternalBoardResponseSchema.parse(result), {
      message: "External board imported",
    });
  } catch (error: any) {
    const status = error?.response?.status || error?.status || error?.statusCode;
    const providerMessage =
      error?.data?.errorMessages?.join?.(", ") ||
      error?.data?.message ||
      error?.response?._data?.message ||
      error?.message;

    console.error("Failed to import external board:", {
      status,
      message: providerMessage,
    });

    if (/decrypt|auth|cipher|token|access token/i.test(String(providerMessage))) {
      throw Errors.badRequest(
        "This integration needs to be reconnected. The saved token could not be read with the current server secret.",
      );
    }

    if (status === 401 || status === 403) {
      throw Errors.badRequest(
        "The external provider denied access. Reconnect the account and make sure the workspace or site is selected and accessible.",
      );
    }

    throw Errors.badRequest(
      `Failed to import external board${providerMessage ? `: ${providerMessage}` : ""}`,
    );
  }
});
