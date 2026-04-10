import FetchFactory from "./FetchFactory";

import type { Result } from "@/types/Result";
import type {
  BoardItem,
  BoardItemLink,
  BoardItemComment,
  CreateBoardItemDTO,
  UpdateBoardItemDTO,
  ReorderBoardItemsDTO,
  CreateBoardItemLinkDTO,
  CreateBoardItemCommentDTO,
} from "@@/shared/utils/boardItem.contract.ts";
import type {
  MoveItemToColumnDTO,
  ReorderItemsInColumnDTO,
} from "@@/shared/utils/boardColumn.contract.ts";

export class BoardItemService extends FetchFactory {
  private readonly RESOURCE = "/api/board-items";
  private readonly LINKS_RESOURCE = "/api/board-item-links";
  private readonly COMMENTS_RESOURCE = "/api/board-item-comments";

  /**
   * Get all board items for the current user
   */
  async getAll(workspaceId?: string): Promise<Result<BoardItem[]>> {
    const query = new URLSearchParams();
    if (workspaceId) {
      query.append("workspaceId", workspaceId);
    }
    return this.call<BoardItem[]>("GET", `${this.RESOURCE}?${query.toString()}`);
  }

  /**
   * Create a new board item
   */
  async create(payload: CreateBoardItemDTO): Promise<Result<BoardItem>> {
    return this.call<BoardItem>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing board item (content, tags, dueDate, attachments)
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

  // ─── Links ─────────────────────────────────────────────────────────────────

  /**
   * Get all links for a board item (both directions)
   */
  async getLinks(itemId: string): Promise<Result<{ sent: BoardItemLink[]; received: BoardItemLink[] }>> {
    return this.call("GET", `${this.LINKS_RESOURCE}?itemId=${encodeURIComponent(itemId)}`);
  }

  /**
   * Create a link between two board items
   */
  async createLink(payload: CreateBoardItemLinkDTO): Promise<Result<BoardItemLink>> {
    return this.call<BoardItemLink>("POST", this.LINKS_RESOURCE, payload);
  }

  /**
   * Delete a board item link
   */
  async deleteLink(linkId: string): Promise<Result<null>> {
    return this.call("DELETE", `${this.LINKS_RESOURCE}/${linkId}`);
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  /**
   * Get all comments for a board item
   */
  async getComments(itemId: string): Promise<Result<BoardItemComment[]>> {
    return this.call("GET", `${this.COMMENTS_RESOURCE}?itemId=${encodeURIComponent(itemId)}`);
  }

  /**
   * Add a comment to a board item
   */
  async createComment(payload: CreateBoardItemCommentDTO): Promise<Result<BoardItemComment>> {
    return this.call<BoardItemComment>("POST", this.COMMENTS_RESOURCE, payload);
  }
}

