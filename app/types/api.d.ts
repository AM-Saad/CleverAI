import type FoldersModule from "~/services/Folder"
import type AuthModule from "~/services/AuthService"
export interface IApiInstance {
  folders: FoldersModule
  auth: AuthModule

}
