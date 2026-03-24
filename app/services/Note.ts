import FetchFactory from "./FetchFactory";

import type { Result } from "@/types/Result";
import type {
  Note,
  CreateNoteDTO,
  UpdateNoteDTO,
  ReorderNotesDTO,
} from "@@/shared/utils/note.contract.ts";

export class NoteService extends FetchFactory {
  private readonly RESOURCE = "/api/notes";

  /**
   * Get all notes for a workspace
   */
  async getByWorkspace(workspaceId: string): Promise<Result<Note[]>> {
    return this.call<Note[]>("GET", `${this.RESOURCE}?workspaceId=${workspaceId}`);
  }

  /**
   * Create a new note
   */
  async create(payload: CreateNoteDTO): Promise<Result<Note>> {
    return this.call<Note>("POST", this.RESOURCE, payload);
  }

  /**
   * Update an existing note
   */
  async update(id: string, payload: UpdateNoteDTO): Promise<Result<Note>> {
    return this.call<Note>("PATCH", `${this.RESOURCE}/${id}`, {
      id,
      ...payload,
    });
  }

  /**
   * Delete a note
   */
  async delete(id: string) {
    return this.call("DELETE", this.RESOURCE, { id });
  }

  /**
   * Reorder notes in a workspace
   */
  async reorder(payload: ReorderNotesDTO): Promise<Result<Note[]>> {
    return this.call<Note[]>("PATCH", `${this.RESOURCE}/reorder`, payload);
  }
}
