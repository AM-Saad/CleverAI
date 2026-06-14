import FetchFactory from "~/services/FetchFactory";
import type { Result } from "@/types/Result";
import type {
  ExternalSource,
  IntegrationProvider,
  PreviewWorkspaceImportDTO,
  PreviewWorkspaceImportResponse,
  RefreshWorkspaceImportDTO,
  RunWorkspaceImportDTO,
  RunWorkspaceImportResponse,
  WorkspaceImportMappingSummary,
  WorkspaceIntegrationAccount,
} from "@@/shared/utils/workspaceIntegration.contract";

export class WorkspaceIntegrationService extends FetchFactory {
  private readonly RESOURCE = "/api/workspace-integrations";

  getOAuthStartUrl(provider: IntegrationProvider, workspaceId?: string) {
    const query = new URLSearchParams();
    if (workspaceId) query.set("workspaceId", workspaceId);
    return `${this.RESOURCE}/oauth/${provider}/start?${query.toString()}`;
  }

  async getAccounts(provider?: IntegrationProvider): Promise<Result<WorkspaceIntegrationAccount[]>> {
    const query = new URLSearchParams();
    if (provider) query.set("provider", provider);
    return this.call<WorkspaceIntegrationAccount[]>(
      "GET",
      `${this.RESOURCE}/accounts?${query.toString()}`,
    );
  }

  async disconnectAccount(id: string): Promise<Result<null>> {
    return this.call<null>("DELETE", `${this.RESOURCE}/accounts/${id}`);
  }

  async getSources(accountId: string): Promise<Result<ExternalSource[]>> {
    const query = new URLSearchParams({ accountId });
    return this.call<ExternalSource[]>(
      "GET",
      `${this.RESOURCE}/sources?${query.toString()}`,
    );
  }

  async getMappings(workspaceId?: string): Promise<Result<WorkspaceImportMappingSummary[]>> {
    const query = new URLSearchParams();
    if (workspaceId) query.set("workspaceId", workspaceId);
    return this.call<WorkspaceImportMappingSummary[]>(
      "GET",
      `${this.RESOURCE}/mappings?${query.toString()}`,
    );
  }

  async previewImport(payload: PreviewWorkspaceImportDTO): Promise<Result<PreviewWorkspaceImportResponse>> {
    return this.call<PreviewWorkspaceImportResponse>(
      "POST",
      `${this.RESOURCE}/preview`,
      payload,
    );
  }

  async runImport(payload: RunWorkspaceImportDTO): Promise<Result<RunWorkspaceImportResponse>> {
    return this.call<RunWorkspaceImportResponse>(
      "POST",
      `${this.RESOURCE}/import`,
      payload,
    );
  }

  async refreshImport(payload: RefreshWorkspaceImportDTO): Promise<Result<RunWorkspaceImportResponse>> {
    return this.call<RunWorkspaceImportResponse>(
      "POST",
      `${this.RESOURCE}/refresh`,
      payload,
    );
  }

  async getDiagnostics(workspaceId?: string): Promise<Result<unknown>> {
    const query = new URLSearchParams();
    if (workspaceId) query.set("workspaceId", workspaceId);
    return this.call<unknown>(
      "GET",
      `${this.RESOURCE}/diagnostics?${query.toString()}`,
    );
  }
}
