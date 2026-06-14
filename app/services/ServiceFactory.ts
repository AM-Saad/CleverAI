import type { $Fetch } from "ofetch";
import type FetchFactory from "./FetchFactory";
import WorkspacesModule from "./Workspace";
import { MaterialService } from "./Material";
import { NoteService } from "./Note";
import { NoteGroupService } from "./NoteGroup";
import { BoardItemService } from "./BoardItem";
import { BoardColumnService } from "./BoardColumn";
import { BoardIntegrationService } from "~/features/board/services/boardIntegrationService";
import { WorkspaceIntegrationService } from "~/features/integrations/services/workspaceIntegrationService";
import { ReviewService } from "./ReviewService";
import AuthModule from "./AuthService";
import { UserService } from "./UserService";
import { UserTagService } from "./UserTagService";
import GatewayService from "./GatewayService";
import { LanguageService } from "./LanguageService";

export class ServiceFactory {
  private $fetch: $Fetch;

  constructor(fetcher: $Fetch) {
    this.$fetch = fetcher;
  }

  create(service: "workspaces"): WorkspacesModule;
  create(service: "materials"): MaterialService;
  create(service: "notes"): NoteService;
  create(service: "noteGroups"): NoteGroupService;
  create(service: "boardItems"): BoardItemService;
  create(service: "boardColumns"): BoardColumnService;
  create(service: "boardIntegrations"): BoardIntegrationService;
  create(service: "workspaceIntegrations"): WorkspaceIntegrationService;
  create(service: "review"): ReviewService;
  create(service: "auth"): AuthModule;
  create(service: "user"): UserService;
  create(service: "userTags"): UserTagService;
  create(service: "gateway"): GatewayService;
  create(service: "language"): LanguageService;
  create(service: string): FetchFactory;
  create(service: string): FetchFactory {
    switch (service) {
      case "workspaces":
        return new WorkspacesModule(this.$fetch);
      case "materials":
        return new MaterialService(this.$fetch);
      case "notes":
        return new NoteService(this.$fetch);
      case "noteGroups":
        return new NoteGroupService(this.$fetch);
      case "boardItems":
        return new BoardItemService(this.$fetch);
      case "boardColumns":
        return new BoardColumnService(this.$fetch);
      case "boardIntegrations":
        return new BoardIntegrationService(this.$fetch);
      case "workspaceIntegrations":
        return new WorkspaceIntegrationService(this.$fetch);
      case "review":
        return new ReviewService(this.$fetch);
      case "auth":
        return new AuthModule(this.$fetch);
      case "user":
        return new UserService(this.$fetch);
      case "userTags":
        return new UserTagService(this.$fetch);
      case "gateway":
        return new GatewayService(this.$fetch);
      case "language":
        return new LanguageService(this.$fetch);
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }
}
