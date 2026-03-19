import FetchFactory from "./FetchFactory";

import type { Result } from "@/types/Result";
import type {
  BoardItem,
  CreateBoardItemDTO,
  UpdateBoardItemDTO,
  ReorderBoardItemsDTO,
} from "@@/shared/utils/boardItem.contract.ts";
import type {
  MoveItemToColumnDTO,
  ReorderItemsInColumnDTO,
} from "@@/shared/utils/boardColumn.contract.ts";

export class BoardItemService extends FetchFactory {
  private readonly RESOURCE = "/api/board-items";

  /**
   * Get all board items for the current user
   */
  async getAll(): Promise<Result<BoardItem[]>> {
    return this.call<BoardItem[]>("GET", this.RESOURCE);
  }

  /**
   * Create a new board item
   */
  async create(payload: CreateBoardItemDTO): Promise<Result<BoardItem>> {
    return this.call<BoardItem>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing board item
   */
  async update(id: string, payload: UpdateBoardItemDTO): Promise<Result<BoardItem>> {
    return this.call<BoardItem>("PATCH", `${this.RESOURCE}/${id}`, {
      id,
      ...payload,
    });
  }

  /**
   * Delete a board item
   */
  async delete(id: string) {
    return this.call("DELETE", this.RESOURCE, { id });
  }

  /**
   * Reorder board items
   */
  async reorder(payload: ReorderBoardItemsDTO): Promise<Result<BoardItem[]>> {
    return this.call<BoardItem[]>("PATCH", `${this.RESOURCE}/reorder`, payload);
  }

  /**
   * Move a board item to a different column
   */
  async moveToColumn(payload: MoveItemToColumnDTO): Promise<Result<BoardItem>> {
    return this.call<BoardItem>("PATCH", `${this.RESOURCE}/move`, payload);
  }

  /**
   * Reorder board items within a specific column
   */
  async reorderInColumn(payload: ReorderItemsInColumnDTO): Promise<Result<BoardItem[]>> {
    return this.call<BoardItem[]>("PATCH", `${this.RESOURCE}/reorder-in-column`, payload);
  }

  /**
   * Sync multiple board items (for offline sync)
   */
  async sync(items: BoardItem[]): Promise<Result<any>> {
    return this.call("POST", `${this.RESOURCE}/sync`, items);
  }
}

