import type FoldersModule from "~/services/Folder"
import type AuthModule from "~/services/AuthService"
import type { ReviewService } from "~/services/ReviewService"
import type { MaterialService } from "~/services/Material"
import type { NoteService } from "~/services/Note"
import type { BoardItemService } from "~/services/BoardItem"
import type { BoardColumnService } from "~/services/BoardColumn"
import type { UserService } from "~/services/UserService"
import type { UserTagService } from "~/services/UserTagService"
import type GatewayService from "~/services/GatewayService"

export interface IApiInstance {
  folders: FoldersModule
  auth: AuthModule
  review: ReviewService
  materials: MaterialService
  notes: NoteService
  boardItems: BoardItemService
  boardColumns: BoardColumnService
  user: UserService
  userTags: UserTagService
  gateway: GatewayService
}
