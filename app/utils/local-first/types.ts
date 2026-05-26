export type LocalFirstQueueStatus =
  | "idle"
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type LocalFirstChangeScope =
  | "content"
  | "group"
  | "layout"
  | "board"
  | "material";

export interface LocalFirstConflictRecord<TLocal = unknown, TServer = unknown> {
  id: string;
  workspaceId: string;
  scope: LocalFirstChangeScope;
  entityId: string;
  reason: string;
  createdAt: number;
  updatedAt: number;
  localSnapshot?: TLocal;
  serverSnapshot?: TServer;
  serverVersion?: number;
  clientServerVersion?: number;
  resolution?: "keep-local" | "keep-server" | "manual-merge";
}
