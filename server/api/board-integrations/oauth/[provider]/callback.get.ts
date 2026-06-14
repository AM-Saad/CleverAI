import { Buffer } from "node:buffer";
import { deleteCookie, getCookie, sendRedirect } from "h3";
import { BoardIntegrationProviderSchema } from "../../../../../shared/utils/boardIntegration.contract";
import { requireRole } from "~~/server/utils/auth";
import { Errors } from "@server/utils/error";
import { encryptIntegrationToken } from "@server/modules/integrations/infrastructure/tokenCipher";
import {
  getIntegrationBaseUrl,
  getProviderOAuthConfig,
} from "@server/modules/integrations/application/oauthConfig";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

async function exchangeJiraToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  return $fetch<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    },
  });
}

async function exchangeNotionToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const encoded = Buffer.from(`${input.clientId}:${input.clientSecret}`).toString("base64");
  return $fetch<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    workspace_id?: string;
    workspace_name?: string;
    workspace_icon?: string;
    bot_id?: string;
    owner?: unknown;
  }>("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: {
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    },
  });
}

async function resolveJiraResources(accessToken: string) {
  const resources = await $fetch<Array<{
    id: string;
    name: string;
    url: string;
    scopes?: string[];
    avatarUrl?: string;
  }>>("https://api.atlassian.com/oauth/token/accessible-resources", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return resources.filter((resource) =>
    (resource.scopes ?? []).some((scope) => scope.includes("jira")),
  );
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const provider = BoardIntegrationProviderSchema.parse(
    getRouterParam(event, "provider"),
  );
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";
  const oauthError = typeof query.error === "string" ? query.error : "";
  const oauthErrorDescription =
    typeof query.error_description === "string"
      ? query.error_description
      : typeof query.errorDescription === "string"
        ? query.errorDescription
        : "";

  if ((!code && !oauthError) || !state) {
    throw Errors.badRequest("Missing OAuth code or state");
  }

  const cookieName = `board_integration_oauth_${provider}`;
  const cookieValue = getCookie(event, cookieName);
  deleteCookie(event, cookieName, { path: "/" });
  if (!cookieValue) throw Errors.badRequest("Missing OAuth state");

  const parsedState = JSON.parse(cookieValue) as {
    state?: string;
    workspaceId?: string;
  };
  if (parsedState.state !== state) {
    throw Errors.badRequest("Invalid OAuth state");
  }

  if (oauthError) {
    const workspacePath = parsedState.workspaceId
      ? `/workspaces/${encodeURIComponent(parsedState.workspaceId)}`
      : "/workspaces";
    const message = oauthErrorDescription || oauthError;
    return sendRedirect(
      event,
      `${getIntegrationBaseUrl()}${workspacePath}?integration_error=${encodeURIComponent(message)}`,
      302,
    );
  }

  try {
    const oauth = getProviderOAuthConfig(provider);

    if (provider === "jira") {
      const token = await exchangeJiraToken({ code, ...oauth });
      const resources = await resolveJiraResources(token.access_token);
      if (resources.length === 0) {
        throw new Error("No Jira site is available for this grant");
      }

      await Promise.all(resources.map((resource) =>
        integrationRepository.upsertAccount(prisma, {
          userId: user.id,
          provider,
          externalAccountId: resource.id,
          data: {
            displayName: resource.name,
            accountUrl: resource.url,
            accessTokenCiphertext: encryptIntegrationToken(token.access_token),
            refreshTokenCiphertext: encryptIntegrationToken(token.refresh_token),
            tokenExpiresAt: token.expires_in
              ? new Date(Date.now() + token.expires_in * 1000)
              : null,
            scopes: resource.scopes ?? token.scope?.split(" ") ?? [],
            metadata: { cloudId: resource.id, avatarUrl: resource.avatarUrl },
          },
        }),
      ));
    } else {
      const token = await exchangeNotionToken({ code, ...oauth });
      const externalAccountId = token.workspace_id || token.bot_id;
      if (!externalAccountId) throw new Error("No Notion workspace id returned");
      await integrationRepository.upsertAccount(prisma, {
        userId: user.id,
        provider,
        externalAccountId,
        data: {
          displayName: token.workspace_name || "Notion workspace",
          accountUrl: null,
          accessTokenCiphertext: encryptIntegrationToken(token.access_token),
          refreshTokenCiphertext: encryptIntegrationToken(token.refresh_token),
          tokenExpiresAt: token.expires_in
            ? new Date(Date.now() + token.expires_in * 1000)
            : null,
          scopes: [],
          metadata: {
            workspaceIcon: token.workspace_icon,
            botId: token.bot_id,
            owner: token.owner,
          },
        },
      });
    }

    const workspacePath = parsedState.workspaceId
      ? `/workspaces/${encodeURIComponent(parsedState.workspaceId)}`
      : "/workspaces";
    return sendRedirect(event, `${getIntegrationBaseUrl()}${workspacePath}`, 302);
  } catch (error: any) {
    console.error(`Failed to complete ${provider} OAuth:`, error);
    throw Errors.server(error?.message || `Failed to connect ${provider}`);
  }
});
