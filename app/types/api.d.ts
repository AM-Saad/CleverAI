import type WorkspacesModule from "~/services/Workspace";
import type AuthModule from "~/services/AuthService";
import type { ReviewService } from "~/services/ReviewService";
import type { MaterialService } from "~/services/Material";
import type { NoteService } from "~/services/Note";
import type { NoteGroupService } from "~/services/NoteGroup";
import type { BoardItemService } from "~/services/BoardItem";
import type { BoardColumnService } from "~/services/BoardColumn";
import type { BoardIntegrationService } from "~/features/board/services/boardIntegrationService";
import type { WorkspaceIntegrationService } from "~/features/integrations/services/workspaceIntegrationService";
import type { UserService } from "~/services/UserService";
import type { UserTagService } from "~/services/UserTagService";
import type GatewayService from "~/services/GatewayService";
import type { LanguageService } from "~/services/LanguageService";
import type { NotificationsService } from "~/services/Notifications";

export interface IApiInstance {
  workspaces: WorkspacesModule;
  auth: AuthModule;
  review: ReviewService;
  materials: MaterialService;
  notes: NoteService;
  noteGroups: NoteGroupService;
  boardItems: BoardItemService;
  boardColumns: BoardColumnService;
  boardIntegrations: BoardIntegrationService;
  workspaceIntegrations: WorkspaceIntegrationService;
  user: UserService;
  userTags: UserTagService;
  gateway: GatewayService;
  language: LanguageService;
  notifications: NotificationsService;
}
