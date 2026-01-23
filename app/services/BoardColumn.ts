import FetchFactory from "./FetchFactory";

import type { Result } from "@/types/Result";
import type {
  BoardColumn,
  CreateBoardColumnDTO,
  UpdateBoardColumnDTO,
  ReorderBoardColumnsDTO,
} from "@@/shared/utils/boardColumn.contract.ts";

export class BoardColumnService extends FetchFactory {
  private readonly RESOURCE = "/api/board-columns";

  /**
   * Get all board columns for the current user
   */
  async getAll(): Promise<Result<BoardColumn[]>> {
    return this.call<BoardColumn[]>("GET", this.RESOURCE);
  }

  /**
   * Create a new board column
   */
  async create(payload: CreateBoardColumnDTO): Promise<Result<BoardColumn>> {
    return this.call<BoardColumn>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing board column
   */
  async update(id: string, payload: UpdateBoardColumnDTO): Promise<Result<BoardColumn>> {
    return this.call<BoardColumn>("PATCH", `${this.RESOURCE}/${id}`, payload);
  }

  /**
   * Delete a board column
   */
  async delete(id: string): Promise<Result<unknown>> {
    return this.call("DELETE", `${this.RESOURCE}/${id}`);
  }

  /**
   * Reorder board columns
   */
  async reorder(payload: ReorderBoardColumnsDTO): Promise<Result<BoardColumn[]>> {
    return this.call<BoardColumn[]>("PATCH", `${this.RESOURCE}/reorder`, payload);
  }
}
