import FetchFactory from "~/services/FetchFactory";

import type { Result } from "@/types/Result";
import type {
  Note,
  CreateNoteDTO,
  UpdateNoteDTO,
  ReorderNotesDTO,
} from "@@/shared/utils/note.contract.ts";
import type {
  NotesSyncRequest,
  NotesSyncResponse,
} from "@@/shared/utils/note-sync.contract.ts";
import type {
  NoteCollabSnapshotRequest,
  NoteCollabSnapshotResponse,
  NoteCollabTokenResponse,
} from "@@/shared/utils/note-collab.contract.ts";

import type { FetchOptions } from "ofetch";

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
  async reorder(payload: ReorderNotesDTO, options?: FetchOptions<"json">): Promise<Result<{ layoutApplied: boolean }>> {
    return this.call<{ layoutApplied: boolean }>("PATCH", `${this.RESOURCE}/reorder`, payload, options);
  }

  /**
   * Sync pending local note changes.
   */
  async sync(payload: NotesSyncRequest): Promise<Result<NotesSyncResponse>> {
    return this.call<NotesSyncResponse>(
      "POST",
      `${this.RESOURCE}/sync`,
      payload
    );
  }

  async getCollabToken(id: string): Promise<Result<NoteCollabTokenResponse>> {
    return this.call<NoteCollabTokenResponse>(
      "GET",
      `${this.RESOURCE}/${id}/collab-token`,
    );
  }

  async saveCollabSnapshot(
    id: string,
    payload: NoteCollabSnapshotRequest,
  ): Promise<Result<NoteCollabSnapshotResponse>> {
    return this.call<NoteCollabSnapshotResponse>(
      "POST",
      `${this.RESOURCE}/${id}/collab-snapshot`,
      payload,
    );
  }
}
