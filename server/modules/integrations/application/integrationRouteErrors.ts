import { Errors } from "@server/utils/error";

export function throwActionableIntegrationError(error: any, provider?: string, action = "complete integration request"): never {
  const providerName = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : "The integration";
  const status = error?.response?.status || error?.status || error?.statusCode;
  const providerMessage =
    error?.data?.errorMessages?.join?.(", ") ||
    error?.data?.message ||
    error?.response?._data?.message ||
    error?.message;

  console.error(`Failed to ${action}:`, {
    provider,
    status,
    message: providerMessage,
  });

  if (/decrypt|auth|cipher|token|access token/i.test(String(providerMessage))) {
    throw Errors.badRequest(
      `${providerName} needs to be reconnected. The saved token could not be read with the current server secret.`,
    );
  }

  if (status === 401 || status === 403) {
    throw Errors.badRequest(
      `${providerName} denied access. Reconnect the account and make sure the workspace, page, project, or Jira site is selected and accessible.`,
    );
  }

  throw Errors.badRequest(
    `Could not ${action}${providerMessage ? `: ${providerMessage}` : ""}`,
  );
}
