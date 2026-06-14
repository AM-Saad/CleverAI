import type {
  BoardIntegrationProvider,
} from "../../../../../shared/utils/boardIntegration.contract";
import type { BoardProvider } from "../../domain/boardProvider";
import type { IntegrationProvider } from "../../../../../shared/utils/workspaceIntegration.contract";
import type { WorkspaceProvider } from "../../domain/workspaceProvider";
import { JiraBoardProvider, JiraWorkspaceProvider } from "./jiraProvider";
import { NotionBoardProvider, NotionWorkspaceProvider } from "./notionProvider";

const jiraProvider = new JiraBoardProvider();
const notionProvider = new NotionBoardProvider();
const jiraWorkspaceProvider = new JiraWorkspaceProvider();
const notionWorkspaceProvider = new NotionWorkspaceProvider();

const providers: Record<BoardIntegrationProvider, BoardProvider> = {
  jira: jiraProvider,
  notion: notionProvider,
};

const workspaceProviders: Record<IntegrationProvider, WorkspaceProvider> = {
  jira: jiraWorkspaceProvider,
  notion: notionWorkspaceProvider,
};

export function getBoardProvider(provider: BoardIntegrationProvider) {
  return providers[provider];
}

export function getWorkspaceProvider(provider: IntegrationProvider) {
  return workspaceProviders[provider];
}
