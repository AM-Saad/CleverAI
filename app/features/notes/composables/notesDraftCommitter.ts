import { normalizeWorkspaceNoteContent, normalizeWorkspaceNoteTitle } from "../../../../shared/utils/workspaceNote";

export type NotesEditorSaveState =
  | "editing"
  | "saved-local"
  | "syncing"
  | "synced"
  | "conflict";

export interface WorkspaceTextDraftCommit {
  title: string;
  content: string;
}

export function buildWorkspaceTextDraftCommit(content: string): WorkspaceTextDraftCommit {
  const normalizedContent = normalizeWorkspaceNoteContent(content);
  return {
    title: normalizeWorkspaceNoteTitle(undefined, normalizedContent),
    content: normalizedContent,
  };
}

export function resolveEditorSaveState(input: {
  hasLocalDraft: boolean;
  isDirty?: boolean;
  isLoading?: boolean;
  error?: string | null;
}): NotesEditorSaveState {
  if (input.error) return "conflict";
  if (input.hasLocalDraft) return "editing";
  if (input.isLoading) return "syncing";
  if (input.isDirty) return "saved-local";
  return "synced";
}

export function saveStateLabel(state: NotesEditorSaveState): string {
  switch (state) {
    case "editing":
      return "Editing";
    case "saved-local":
      return "Saved locally";
    case "syncing":
      return "Syncing";
    case "conflict":
      return "Conflict";
    case "synced":
    default:
      return "Synced";
  }
}
