export type NoteRowAction =
  | "delete"
  | "download-txt"
  | "download-doc"
  | "download-pdf";

export type NoteRowIntent =
  | { type: "OPEN_NOTE"; noteId: string }
  | { type: "START_REORDER"; noteId: string }
  | { type: "SPLIT_CLICK"; noteId: string }
  | { type: "SPLIT_DRAG_START"; noteId: string }
  | { type: "SPLIT_DRAG_END"; noteId: string }
  | { type: "ACTION"; noteId: string; action: NoteRowAction };
