import FetchFactory from "~/services/FetchFactory";

import type { Result } from "@/types/Result";
import type {
  CreateNoteGroupDTO,
  NoteGroup,
  ReorderNoteGroupsDTO,
  UpdateNoteGroupDTO,
} from "@@/shared/utils/note-group.contract";

import type { FetchOptions } from "ofetch";

export class NoteGroupService extends FetchFactory {
  private readonly RESOURCE = "/api/note-groups";

  async getByWorkspace(workspaceId: string): Promise<Result<NoteGroup[]>> {
    return this.call<NoteGroup[]>("GET", `${this.RESOURCE}?workspaceId=${workspaceId}`);
  }

  async create(payload: CreateNoteGroupDTO): Promise<Result<NoteGroup>> {
    return this.call<NoteGroup>("POST", this.RESOURCE, payload);
  }

  async update(id: string, payload: UpdateNoteGroupDTO): Promise<Result<NoteGroup>> {
    return this.call<NoteGroup>("PATCH", `${this.RESOURCE}/${id}`, payload);
  }

  async delete(id: string): Promise<Result<{ success: boolean }>> {
    return this.call<{ success: boolean }>("DELETE", `${this.RESOURCE}/${id}`);
  }

  async reorder(payload: ReorderNoteGroupsDTO, options?: FetchOptions<"json">): Promise<Result<{ layoutApplied: boolean }>> {
    return this.call<{ layoutApplied: boolean }>("PATCH", `${this.RESOURCE}/reorder`, payload, options);
  }
}
