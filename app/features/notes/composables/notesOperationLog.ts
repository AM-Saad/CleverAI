export type NotesOperationName =
  | "select"
  | "split"
  | "drag-start"
  | "layout-queued"
  | "content-queued"
  | "sync-start"
  | "sync-success"
  | "sync-failure";

export function logNotesOperation(
  operation: NotesOperationName,
  details: Record<string, unknown> = {},
) {
  if (!import.meta.dev) return;
  console.debug(`[notes:${operation}]`, details);
}
