import type {
  BoardIntegrationProvider,
  ExternalBoardSource,
} from "../../../../shared/utils/boardIntegration.contract";

export interface ProviderAccountContext {
  id: string;
  provider: BoardIntegrationProvider;
  externalAccountId: string;
  displayName: string;
  accountUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExternalBoardItem {
  provider: BoardIntegrationProvider;
  externalId: string;
  externalKey?: string;
  externalUrl?: string | null;
  title: string;
  status?: string | null;
  tags: string[];
  dueDate?: string | null;
  updatedAt?: string | null;
  raw: Record<string, unknown>;
}

export interface BoardProvider {
  provider: BoardIntegrationProvider;
  listSources(account: ProviderAccountContext): Promise<ExternalBoardSource[]>;
  listItems(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
  }): Promise<ExternalBoardItem[]>;
}
