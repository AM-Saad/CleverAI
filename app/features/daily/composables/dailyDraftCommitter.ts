/**
 * Daily-scoped mirror of `app/features/notes/composables/notesDraftCommitter.ts`.
 * Ports the save-state shape and commit-payload pattern from that pipeline;
 * drops what Notes needs but Daily's `{userId, dateKey, content}` note has no
 * use for (title derivation, HTML sanitization, collaboration).
 */

export type DailyEditorSaveState =
  | "editing"
  | "saved-local"
  | "syncing"
  | "conflict";

export interface DailyNoteDraftCommit {
  content: unknown;
}

export function buildDailyNoteDraftCommit(content: unknown): DailyNoteDraftCommit {
  return { content };
}

export function resolveDailyEditorSaveState(input: {
  hasLocalDraft: boolean;
  isSyncing?: boolean;
  isConflicted?: boolean;
}): DailyEditorSaveState {
  if (input.isConflicted) return "conflict";
  if (input.hasLocalDraft) return "editing";
  if (input.isSyncing) return "syncing";
  return "saved-local";
}

export function dailySaveStateLabel(state: DailyEditorSaveState): string {
  switch (state) {
    case "editing":
      return "Editing";
    case "syncing":
      return "Syncing…";
    case "conflict":
      return "Conflict";
    case "saved-local":
    default:
      return "Saved locally";
  }
}

function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const record = node as { text?: unknown; content?: unknown[] };
  if (typeof record.text === "string") out.push(record.text);
  if (Array.isArray(record.content)) {
    for (const child of record.content) collectText(child, out);
  }
}

/** Plain-text snippet of a Tiptap JSON doc, for conflict-preview display. */
export function previewDailyNoteContent(content: unknown): string {
  const out: string[] = [];
  collectText(content, out);
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 700) : "No content";
}
