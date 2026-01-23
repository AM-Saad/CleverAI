import FetchFactory from "./FetchFactory";

import type { Result } from "@/types/Result";
import type {
  UserTag,
  CreateUserTagDTO,
  UpdateUserTagDTO,
  ReorderUserTagsDTO,
} from "~/shared/utils/user-tag.contract";

export class UserTagService extends FetchFactory {
  private readonly RESOURCE = "/api/user/tags";

  /**
   * Get all tags for the current user
   */
  async getAll(): Promise<Result<UserTag[]>> {
    return this.call<UserTag[]>("GET", this.RESOURCE);
  }

  /**
   * Create a new tag
   */
  async create(payload: CreateUserTagDTO): Promise<Result<UserTag>> {
    return this.call<UserTag>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing tag
   */
  async update(id: string, payload: UpdateUserTagDTO): Promise<Result<UserTag>> {
    return this.call<UserTag>("PATCH", `${this.RESOURCE}/${id}`, payload);
  }

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<Result<void>> {
    return this.call<void>("DELETE", `${this.RESOURCE}/${id}`);
  }

  /**
   * Reorder tags
   */
  async reorder(payload: ReorderUserTagsDTO): Promise<Result<void>> {
    return this.call<void>("PATCH", `${this.RESOURCE}/reorder`, payload);
  }
}
