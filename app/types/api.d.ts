import type FoldersModule from "~/services/Folder"
import type AuthModule from "~/services/AuthService"
import type { ReviewService } from "~/services/ReviewService"
import type { MaterialService } from "~/services/Material"
import type { NoteService } from "~/services/Note"
export interface IApiInstance {
  folders: FoldersModule
  auth: AuthModule
  review: ReviewService
  materials: MaterialService
  notes: NoteService
}
