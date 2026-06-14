import { randomUUID } from "node:crypto";
import { sendRedirect, setCookie } from "h3";
import { BoardIntegrationProviderSchema } from "../../../../../shared/utils/boardIntegration.contract";
import { requireRole } from "~~/server/utils/auth";
import { Errors } from "@server/utils/error";
import { getProviderOAuthConfig } from "@server/modules/integrations/application/oauthConfig";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["USER"]);
  const provider = BoardIntegrationProviderSchema.parse(
    getRouterParam(event, "provider"),
  );
  const query = getQuery(event);
  const workspaceId = typeof query.workspaceId === "string" ? query.workspaceId : "";
  const state = randomUUID();

  setCookie(
    event,
    `workspace_integration_oauth_${provider}`,
    JSON.stringify({ state, workspaceId }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    },
  );

  try {
    const oauth = getProviderOAuthConfig(provider, "workspace-integrations");
    const url = new URL(
      provider === "jira"
        ? "https://auth.atlassian.com/authorize"
        : "https://api.notion.com/v1/oauth/authorize",
    );

    if (provider === "jira") {
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set("client_id", oauth.clientId);
      url.searchParams.set("scope", [
        "read:jira-work",
        "read:jira-user",
        "offline_access",
      ].join(" "));
      url.searchParams.set("redirect_uri", oauth.redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("prompt", "consent");
    } else {
      url.searchParams.set("owner", "user");
      url.searchParams.set("client_id", oauth.clientId);
      url.searchParams.set("redirect_uri", oauth.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
    }

    return sendRedirect(event, url.toString(), 302);
  } catch (error: any) {
    throw Errors.server(error?.message || "Failed to start integration OAuth");
  }
});
