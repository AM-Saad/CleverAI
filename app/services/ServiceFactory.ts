import type { $Fetch } from "ofetch"
import type FetchFactory from "./FetchFactory"
import FoldersModule from "./Folder"
import { MaterialService } from "./Material"
import { NoteService } from "./Note"
import { ReviewService } from "./ReviewService"
import AuthModule from "./AuthService"

export class ServiceFactory {
  private $fetch: $Fetch

  constructor(fetcher: $Fetch) {
    this.$fetch = fetcher
  }

  create(service: 'folders'): FoldersModule
  create(service: 'materials'): MaterialService
  create(service: 'notes'): NoteService
  create(service: 'review'): ReviewService
  create(service: 'auth'): AuthModule
  create(service: string): FetchFactory
  create(service: string): FetchFactory {
    switch (service) {
      case 'folders':
        return new FoldersModule(this.$fetch)
      case 'materials':
        return new MaterialService(this.$fetch)
      case 'notes':
        return new NoteService(this.$fetch)
      case 'review':
        return new ReviewService(this.$fetch)
       case 'auth':
        return new AuthModule(this.$fetch)
      default:
        throw new Error(`Unknown service: ${service}`)
    }
  }
}
