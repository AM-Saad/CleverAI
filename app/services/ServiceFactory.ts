import type { $Fetch } from "ofetch";
import type FetchFactory from "./FetchFactory";
import FoldersModule from "./Folder";
import { MaterialService } from "./Material";
import { NoteService } from "./Note";
import { ReviewService } from "./ReviewService";
import AuthModule from "./AuthService";
import { UserService } from "./UserService";
import GatewayService from "./GatewayService";

export class ServiceFactory {
  private $fetch: $Fetch;

  constructor(fetcher: $Fetch) {
    this.$fetch = fetcher;
  }

  create(service: "folders"): FoldersModule;
  create(service: "materials"): MaterialService;
  create(service: "notes"): NoteService;
  create(service: "review"): ReviewService;
  create(service: "auth"): AuthModule;
  create(service: "user"): UserService;
  create(service: "gateway"): GatewayService;
  create(service: string): FetchFactory;
  create(service: string): FetchFactory {
    switch (service) {
      case "folders":
        return new FoldersModule(this.$fetch);
      case "materials":
        return new MaterialService(this.$fetch);
      case "notes":
        return new NoteService(this.$fetch);
      case "review":
        return new ReviewService(this.$fetch);
      case "auth":
        return new AuthModule(this.$fetch);
      case "user":
        return new UserService(this.$fetch);
      case "gateway":
        return new GatewayService(this.$fetch);
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }
}
