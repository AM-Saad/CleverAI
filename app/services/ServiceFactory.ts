import type { $Fetch } from "ofetch"
import type FetchFactory from "./FetchFactory"
import FoldersModule from "./Folder"
import { MaterialService } from "./Material"

export class ServiceFactory {
  private $fetch: $Fetch

  constructor(fetcher: $Fetch) {
    this.$fetch = fetcher
  }

  create(service: 'folders'): FoldersModule
  create(service: 'materials'): MaterialService
  create(service: string): FetchFactory
  create(service: string): FetchFactory {
    switch (service) {
      case 'folders':
        return new FoldersModule(this.$fetch)
      case 'materials':
        return new MaterialService(this.$fetch)
      default:
        throw new Error(`Unknown service: ${service}`)
    }
  }
}
