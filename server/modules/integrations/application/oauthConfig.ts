import type { BoardIntegrationProvider } from "../../../../shared/utils/boardIntegration.contract";

export type IntegrationOAuthRouteNamespace =
  | "board-integrations"
  | "workspace-integrations";

export function getIntegrationBaseUrl() {
  const config = useRuntimeConfig();
  return (
    config.public?.APP_BASE_URL ||
    config.public?.AUTH_ORIGIN ||
    process.env.APP_BASE_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export function getProviderOAuthConfig(
  provider: BoardIntegrationProvider,
  routeNamespace: IntegrationOAuthRouteNamespace = "board-integrations",
) {
  const config = useRuntimeConfig();
  const baseUrl = getIntegrationBaseUrl();
  const redirectUri = `${baseUrl}/api/${routeNamespace}/oauth/${provider}/callback`;

  if (provider === "jira") {
    if (!config.jiraClientId || !config.jiraClientSecret) {
      throw new Error("Missing JIRA_CLIENT_ID or JIRA_CLIENT_SECRET");
    }
    return {
      clientId: String(config.jiraClientId),
      clientSecret: String(config.jiraClientSecret),
      redirectUri,
    };
  }

  if (!config.notionClientId || !config.notionClientSecret) {
    throw new Error("Missing NOTION_CLIENT_ID or NOTION_CLIENT_SECRET");
  }
  return {
    clientId: String(config.notionClientId),
    clientSecret: String(config.notionClientSecret),
    redirectUri,
  };
}
