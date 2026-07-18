export interface NotesSyncListenerStore {
  flushDrafts(): Promise<void>;
  syncPendingChanges(): Promise<boolean>;
  hydrateLocalNotes(): Promise<void>;
}

let listenersRegistered = false;
let activeWorkspaceId: string | null = null;

export function setActiveNotesWorkspace(workspaceId: string): void {
  activeWorkspaceId = workspaceId;
}

export function registerNotesSyncListenersOnce(
  stores: ReadonlyMap<string, NotesSyncListenerStore>,
): void {
  if (!process.client || listenersRegistered) return;

  window.addEventListener("online", () => {
    void (async () => {
      await Promise.all(
        Array.from(stores.values()).map((store) => store.flushDrafts()),
      );
      const activeStore = activeWorkspaceId
        ? stores.get(activeWorkspaceId)
        : null;
      const orderedStores = [
        ...(activeStore ? [activeStore] : []),
        ...Array.from(stores.entries())
          .filter(([workspaceId]) => workspaceId !== activeWorkspaceId)
          .map(([, store]) => store),
      ];
      await Promise.all(
        orderedStores.map((store) => store.syncPendingChanges()),
      );
    })();
  });

  listenersRegistered = true;
}
