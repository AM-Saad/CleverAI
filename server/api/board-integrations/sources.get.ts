import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { getBoardProvider } from "@server/modules/integrations/infrastructure/providers";
import { getProviderAccountContext } from "@server/modules/integrations/application/providerAccountContext";
import { ExternalBoardSourceSchema } from "../../../shared/utils/boardIntegration.contract";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

const QuerySchema = z.object({
  accountId: z.string(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid sources query");
    }
    throw error;
  }

  const account = await integrationRepository.findAccount(prisma, {
    id: query.accountId,
    userId: user.id,
  });
  if (!account) throw Errors.notFound("Integration account");

  try {
    const provider = getBoardProvider(account.provider);
    const providerAccount = await getProviderAccountContext({
      prisma,
      userId: user.id,
      account,
    });
    const sources = await provider.listSources(providerAccount);
    return success(sources.map((source) => ExternalBoardSourceSchema.parse(source)));
  } catch (error: any) {
    const providerName = account.provider === "jira" ? "Jira" : "Notion";
    const status = error?.response?.status || error?.status || error?.statusCode;
    const providerMessage =
      error?.data?.errorMessages?.join?.(", ") ||
      error?.data?.message ||
      error?.response?._data?.message ||
      error?.message;

    console.error(`Failed to load ${account.provider} sources:`, {
      status,
      message: providerMessage,
      accountId: account.id,
    });

    if (/decrypt|auth|cipher|token|access token/i.test(String(providerMessage))) {
      throw Errors.badRequest(
        `${providerName} needs to be reconnected. The saved token could not be read with the current server secret.`,
      );
    }

    if (status === 401 || status === 403) {
      throw Errors.badRequest(
        `${providerName} denied access to this account. Reconnect it and make sure your ${providerName} workspace or site is selected and accessible.`,
      );
    }

    throw Errors.badRequest(
      `Could not load ${providerName} sources${providerMessage ? `: ${providerMessage}` : ""}`,
    );
  }
});
