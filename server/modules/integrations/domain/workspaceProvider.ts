import type {
  ExternalDocumentPage,
  ExternalSource,
  ExternalTaskPage,
  IntegrationProvider,
  PreviewWorkspaceImportResponse,
} from "../../../../shared/utils/workspaceIntegration.contract";
import type { ProviderAccountContext } from "./boardProvider";

export type { ProviderAccountContext };

export interface WorkspaceProvider {
  provider: IntegrationProvider;
  listSources(account: ProviderAccountContext): Promise<ExternalSource[]>;
  previewSource(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    targetType?: string | null;
    contentKinds?: string[];
    fieldMapping?: Record<string, unknown>;
    importOptions?: Record<string, unknown>;
  }): Promise<PreviewWorkspaceImportResponse>;
  listTasks(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
    importOptions?: Record<string, unknown>;
  }): Promise<ExternalTaskPage>;
  listDocuments(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
    importOptions?: Record<string, unknown>;
  }): Promise<ExternalDocumentPage>;
}
