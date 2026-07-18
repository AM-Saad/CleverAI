import FetchFactory from "~/services/FetchFactory";
import type { Result } from "@/types/Result";
import type {
  BoardItem,
  BoardItemLink,
  BoardItemComment,
} from "@@/shared/utils/boardItem.contract.ts";

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

  // ─── Links ─────────────────────────────────────────────────────────────────

  /**
   * Get all links for a board item (both directions)
   */
  async getLinks(itemId: string): Promise<Result<{ sent: BoardItemLink[]; received: BoardItemLink[] }>> {
    return this.call("GET", `${this.LINKS_RESOURCE}?itemId=${encodeURIComponent(itemId)}`);
  }

  // ─── Comments ──────────────────────────────────────────────────────────────

  /**
   * Get all comments for a board item
   */
  async getComments(itemId: string): Promise<Result<BoardItemComment[]>> {
    return this.call("GET", `${this.COMMENTS_RESOURCE}?itemId=${encodeURIComponent(itemId)}`);
  }

}
