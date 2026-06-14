import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { decryptIntegrationToken } from "@server/modules/integrations/infrastructure/tokenCipher";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";
import { getProviderAccountContext } from "@server/modules/integrations/application/providerAccountContext";
import { getBoardProvider } from "@server/modules/integrations/infrastructure/providers";
import { getIntegrationBaseUrl } from "@server/modules/integrations/application/oauthConfig";
import { getProviderOAuthConfig } from "@server/modules/integrations/application/oauthConfig";

const QuerySchema = z.object({
  accountId: z.string().optional(),
  checkSources: z.coerce.boolean().default(false),
});

function tokenState(account: any) {
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  return {
    hasAccessToken: Boolean(decryptIntegrationToken(account.accessTokenCiphertext)),
    hasRefreshToken: Boolean(decryptIntegrationToken(account.refreshTokenCiphertext)),
    tokenExpiresAt: expiresAt?.toISOString() ?? null,
    tokenExpired: expiresAt ? expiresAt.getTime() <= Date.now() : false,
  };
}

function providerErrorMessage(error: any) {
  return (
    error?.data?.errorMessages?.join?.(", ") ||
    error?.data?.message ||
    error?.response?._data?.message ||
    error?.message ||
    "Unknown provider error"
  );
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid diagnostics query");
    }
    throw error;
  }

  const config = useRuntimeConfig();
  let accounts: any[];
  if (query.accountId) {
    const account = await integrationRepository.findAccount(prisma, {
      id: query.accountId,
      userId: user.id,
    });
    accounts = account ? [account] : [];
  } else {
    accounts = await integrationRepository.listAccounts(prisma, { userId: user.id });
  }

  const diagnostics = [];

  for (const account of accounts) {
    const base = {
      id: account.id,
      provider: account.provider,
      displayName: account.displayName,
      accountUrl: account.accountUrl ?? null,
      scopes: account.scopes ?? [],
      metadataKeys: Object.keys(account.metadata ?? {}),
    };

    try {
      const state = tokenState(account);
      const sourceCheck = query.checkSources
        ? await (async () => {
          try {
            const providerAccount = await getProviderAccountContext({
              prisma,
              userId: user.id,
              account,
            });
            const sources = await getBoardProvider(account.provider).listSources(providerAccount);
            return { ok: true, count: sources.length, message: null };
          } catch (error: any) {
            return {
              ok: false,
              count: 0,
              message: providerErrorMessage(error),
              status: error?.response?.status || error?.status || error?.statusCode || null,
            };
          }
        })()
        : undefined;

      diagnostics.push({ ...base, ...state, ...(sourceCheck ? { sourceCheck } : {}) });
    } catch (error: any) {
      diagnostics.push({
        ...base,
        hasAccessToken: false,
        hasRefreshToken: false,
        tokenExpiresAt: account.tokenExpiresAt ?? null,
        tokenExpired: null,
        tokenError: providerErrorMessage(error),
      });
    }
  }

  return success({
    runtime: {
      appBaseUrl: getIntegrationBaseUrl(),
      jiraConfigured: Boolean(config.jiraClientId && config.jiraClientSecret),
      jiraRedirectUri: config.jiraClientId && config.jiraClientSecret
        ? getProviderOAuthConfig("jira").redirectUri
        : null,
      notionConfigured: Boolean(config.notionClientId && config.notionClientSecret),
      integrationTokenSecretConfigured: Boolean(
        process.env.INTEGRATION_TOKEN_SECRET ||
        config.integrationTokenSecret ||
        config.auth?.secret ||
        process.env.NUXT_AUTH_SECRET ||
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET,
      ),
    },
    accounts: diagnostics,
  });
});
