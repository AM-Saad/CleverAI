import {
  useNotesWorkspaceRuntime,
  type NoteGroupsFacade,
} from "./notesWorkspaceRuntime";

export type NoteGroupsStore = NoteGroupsFacade;

export function useNoteGroupsStore(workspaceId: string): NoteGroupsStore {
  return useNotesWorkspaceRuntime(workspaceId).groupFacade;
}
