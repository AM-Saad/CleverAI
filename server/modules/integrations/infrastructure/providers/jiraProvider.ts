import type {
  BoardProvider,
  ExternalBoardItem,
  ProviderAccountContext,
} from "../../domain/boardProvider";
import type { WorkspaceProvider } from "../../domain/workspaceProvider";
import type {
  ExternalDocumentPage,
  ExternalSource,
  ExternalTask,
  ExternalTaskPage,
  PreviewWorkspaceImportResponse,
} from "../../../../../shared/utils/workspaceIntegration.contract";

const JIRA_API_BASE = "https://api.atlassian.com/ex/jira";

function getCloudId(account: ProviderAccountContext) {
  const cloudId =
    typeof account.metadata?.cloudId === "string"
      ? account.metadata.cloudId
      : account.externalAccountId;
  if (!cloudId) throw new Error("Missing Jira cloud id");
  return cloudId;
}

function jiraHeaders(account: ProviderAccountContext) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${account.accessToken}`,
  };
}

function getIssueUrl(account: ProviderAccountContext, key: string) {
  if (!account.accountUrl) return null;
  return `${account.accountUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`;
}

export class JiraWorkspaceProvider implements WorkspaceProvider {
  provider = "jira" as const;

  async listSources(account: ProviderAccountContext): Promise<ExternalSource[]> {
    const cloudId = getCloudId(account);
    const response = await $fetch<{
      values?: Array<{
        id: string;
        key: string;
        name: string;
        self?: string;
        projectTypeKey?: string;
      }>;
    }>(`${JIRA_API_BASE}/${cloudId}/rest/api/3/project/search`, {
      method: "GET",
      headers: jiraHeaders(account),
      query: { maxResults: 50 },
    });

    return (response.values ?? []).map((project) => ({
      provider: this.provider,
      accountId: account.id,
      id: project.id,
      key: project.key,
      name: project.name,
      url: account.accountUrl
        ? `${account.accountUrl.replace(/\/$/, "")}/jira/software/projects/${project.key}`
        : null,
      metadata: {
        projectTypeKey: project.projectTypeKey,
        self: project.self,
      },
      supportedKinds: ["TASK"],
      defaultTarget: "BOARD_ITEM",
    }));
  }

  async listTasks(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
  }): Promise<ExternalTaskPage> {
    const cloudId = getCloudId(input.account);
    const projectKey = input.sourceKey || String(input.fieldMapping?.projectKey || "");
    const projectClause = projectKey
      ? `project = "${projectKey.replace(/"/g, '\\"')}"`
      : `project = ${input.sourceId}`;
    const jql =
      typeof input.fieldMapping?.jql === "string" && input.fieldMapping.jql.trim()
        ? input.fieldMapping.jql.trim()
        : `${projectClause} ORDER BY updated DESC`;

    const response = await $fetch<{
      issues?: Array<{
        id: string;
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
          labels?: string[];
          duedate?: string | null;
          updated?: string | null;
        };
      }>;
    }>(`${JIRA_API_BASE}/${cloudId}/rest/api/3/search/jql`, {
      method: "POST",
      headers: jiraHeaders(input.account),
      body: {
        jql,
        maxResults: input.limit,
        fields: ["summary", "status", "labels", "duedate", "updated"],
      },
    });

    const items = (response.issues ?? []).map<ExternalTask>((issue) => {
      const fields = issue.fields ?? {};
      return {
        provider: this.provider,
        externalId: issue.id,
        externalKey: issue.key,
        externalUrl: getIssueUrl(input.account, issue.key),
        title: fields.summary || issue.key,
        status: fields.status?.name ?? null,
        tags: fields.labels ?? [],
        dueDate: fields.duedate ?? null,
        updatedAt: fields.updated ?? null,
        raw: issue as unknown as Record<string, unknown>,
      };
    });

    return { items, warnings: [] };
  }

  async listDocuments(): Promise<ExternalDocumentPage> {
    return {
      items: [],
      warnings: ["Jira document import is not supported yet. Import Jira issues as board tasks."],
    };
  }

  async previewSource(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
  }): Promise<PreviewWorkspaceImportResponse> {
    const tasks = await this.listTasks(input);
    return {
      tasks: tasks.items,
      documents: [],
      warnings: tasks.warnings,
    };
  }

}

export class JiraBoardProvider implements BoardProvider {
  provider = "jira" as const;
  private readonly workspaceProvider = new JiraWorkspaceProvider();

  async listSources(account: ProviderAccountContext) {
    return this.workspaceProvider.listSources(account);
  }

  async listItems(input: {
    account: ProviderAccountContext;
    sourceId: string;
    sourceKey?: string | null;
    limit: number;
    fieldMapping?: Record<string, unknown>;
  }): Promise<ExternalBoardItem[]> {
    const page = await this.workspaceProvider.listTasks(input);
    return page.items.map((item) => ({
      ...item,
      externalKey: item.externalKey ?? undefined,
    }));
  }
}
