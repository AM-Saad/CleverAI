import type { $Fetch } from "ofetch"
import type FetchFactory from "./FetchFactory"
import FoldersModule from "./Folder"

export class ServiceFactory {
  private $fetch: $Fetch

  constructor(fetcher: $Fetch) {
    this.$fetch = fetcher
  }

  create(service: 'folders'): FoldersModule
  create(service: string): FetchFactory
  create(service: string): FetchFactory {
    switch (service) {
      case 'folders':
        return new FoldersModule(this.$fetch)
      default:
        throw new Error(`Unknown service: ${service}`)
    }
  }
}
