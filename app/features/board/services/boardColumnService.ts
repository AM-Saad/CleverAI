import FetchFactory from "~/services/FetchFactory";
import type { Result } from "@/types/Result";
import type { BoardColumn } from "@@/shared/utils/boardColumn.contract.ts";

export class BoardColumnService extends FetchFactory {
  private readonly RESOURCE = "/api/board-columns";

  /**
   * Get all board columns for the current user
   */
  async getAll(workspaceId?: string): Promise<Result<BoardColumn[]>> {
    const query = new URLSearchParams();
    if (workspaceId) {
      query.append("workspaceId", workspaceId);
    }
    return this.call<BoardColumn[]>("GET", `${this.RESOURCE}?${query.toString()}`);
  }

}
