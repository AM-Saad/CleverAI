import FetchFactory from "~/services/FetchFactory";
import type { Result } from "@/types/Result";
import type {
  BoardIntegrationAccount,
  BoardIntegrationProvider,
  BoardItemExternalRef,
  CreateExternalBoardMappingDTO,
  ExternalBoardMapping,
  ExternalBoardSource,
  ImportExternalBoardDTO,
  ImportExternalBoardResponse,
} from "@@/shared/utils/boardIntegration.contract";

export class BoardIntegrationService extends FetchFactory {
  private readonly RESOURCE = "/api/board-integrations";

  getOAuthStartUrl(provider: BoardIntegrationProvider, workspaceId?: string) {
    const query = new URLSearchParams();
    if (workspaceId) query.set("workspaceId", workspaceId);
    return `${this.RESOURCE}/oauth/${provider}/start?${query.toString()}`;
  }

  async getAccounts(provider?: BoardIntegrationProvider): Promise<Result<BoardIntegrationAccount[]>> {
    const query = new URLSearchParams();
    if (provider) query.set("provider", provider);
    return this.call<BoardIntegrationAccount[]>(
      "GET",
      `${this.RESOURCE}/accounts?${query.toString()}`,
    );
  }

  async disconnectAccount(id: string): Promise<Result<null>> {
    return this.call<null>("DELETE", `${this.RESOURCE}/accounts/${id}`);
  }

  async getSources(accountId: string): Promise<Result<ExternalBoardSource[]>> {
    const query = new URLSearchParams({ accountId });
    return this.call<ExternalBoardSource[]>(
      "GET",
      `${this.RESOURCE}/sources?${query.toString()}`,
    );
  }

  async getMappings(workspaceId?: string): Promise<Result<ExternalBoardMapping[]>> {
    const query = new URLSearchParams();
    if (workspaceId) query.set("workspaceId", workspaceId);
    return this.call<ExternalBoardMapping[]>(
      "GET",
      `${this.RESOURCE}/mappings?${query.toString()}`,
    );
  }

  async createMapping(payload: CreateExternalBoardMappingDTO): Promise<Result<ExternalBoardMapping>> {
    return this.call<ExternalBoardMapping>(
      "POST",
      `${this.RESOURCE}/mappings`,
      payload,
    );
  }

  async importSource(payload: ImportExternalBoardDTO): Promise<Result<ImportExternalBoardResponse>> {
    return this.call<ImportExternalBoardResponse>(
      "POST",
      `${this.RESOURCE}/import`,
      payload,
    );
  }

  async getItemRefs(itemId: string): Promise<Result<BoardItemExternalRef[]>> {
    const query = new URLSearchParams({ itemId });
    return this.call<BoardItemExternalRef[]>(
      "GET",
      `${this.RESOURCE}/item-refs?${query.toString()}`,
    );
  }
}
