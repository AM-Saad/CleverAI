export interface LocalRepository<TRecord> {
  save(record: TRecord): Promise<void>;
  saveMany(records: TRecord[]): Promise<void>;
  loadByWorkspace(workspaceId: string): Promise<TRecord[]>;
  delete(id: string): Promise<void>;
}

export interface PendingQueue<TChange> {
  add(change: TChange): Promise<void>;
  load(workspaceId?: string): Promise<TChange[]>;
  remove(ids: string[]): Promise<void>;
  registerBackgroundSync(): Promise<void>;
}

export interface LayoutQueue<TLayout> {
  save(change: TLayout): Promise<void>;
  load(workspaceId: string): Promise<TLayout | null>;
  remove(workspaceId: string): Promise<void>;
  registerBackgroundSync(): Promise<void>;
}

export interface ConflictRepository<TConflict> {
  save(conflict: TConflict): Promise<void>;
  load(workspaceId: string): Promise<TConflict[]>;
  remove(ids: string[]): Promise<void>;
}

export interface BackgroundSyncRegistration {
  registerBackgroundSync(): Promise<void>;
}
