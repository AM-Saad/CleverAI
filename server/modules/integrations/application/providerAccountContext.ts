import type { BoardIntegrationProvider } from "../../../../shared/utils/boardIntegration.contract";
import type { ProviderAccountContext } from "../domain/boardProvider";
import { getProviderOAuthConfig } from "./oauthConfig";
import {
  encryptIntegrationToken,
  decryptIntegrationToken,
} from "../infrastructure/tokenCipher";
import { integrationRepository } from "../infrastructure/integrationRepository";

const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

type RefreshTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

function getTokenExpiresAt(account: any) {
  if (!account.tokenExpiresAt) return null;
  const date = new Date(account.tokenExpiresAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shouldRefresh(account: any) {
  const expiresAt = getTokenExpiresAt(account);
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now() + TOKEN_REFRESH_SKEW_MS);
}

function buildContext(account: any, accessToken: string, refreshToken?: string | null): ProviderAccountContext {
  return {
    id: account.id,
    provider: account.provider,
    externalAccountId: account.externalAccountId,
    displayName: account.displayName,
    accountUrl: account.accountUrl ?? null,
    accessToken,
    refreshToken,
    metadata: account.metadata ?? {},
  };
}

async function refreshOAuthToken(provider: BoardIntegrationProvider, refreshToken: string) {
  const oauth = getProviderOAuthConfig(provider);
  const tokenUrl =
    provider === "jira"
      ? "https://auth.atlassian.com/oauth/token"
      : "https://api.notion.com/v1/oauth/token";

  return $fetch<RefreshTokenResponse>(tokenUrl, {
    method: "POST",
    body: {
      grant_type: "refresh_token",
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: refreshToken,
    },
  });
}

export async function getProviderAccountContext(input: {
  prisma: any;
  userId: string;
  account: any;
}) {
  const { prisma, userId, account } = input;
  const accessToken = decryptIntegrationToken(account.accessTokenCiphertext);
  const refreshToken = decryptIntegrationToken(account.refreshTokenCiphertext);

  if (!accessToken) {
    throw new Error("Missing saved integration access token");
  }

  if (!shouldRefresh(account)) {
    return buildContext(account, accessToken, refreshToken);
  }

  if (!refreshToken) {
    throw new Error("Integration access token expired and no refresh token is available");
  }

  const token = await refreshOAuthToken(account.provider, refreshToken);
  const nextRefreshToken = token.refresh_token ?? refreshToken;
  const updatedAccount = await integrationRepository.updateAccount(prisma, {
    id: account.id,
    userId,
    data: {
      accessTokenCiphertext: encryptIntegrationToken(token.access_token),
      refreshTokenCiphertext: encryptIntegrationToken(nextRefreshToken),
      tokenExpiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      scopes: token.scope?.split(" ") ?? account.scopes ?? [],
    },
  });

  return buildContext(
    updatedAccount ?? account,
    token.access_token,
    nextRefreshToken,
  );
}
