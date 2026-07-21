export interface NotesSyncListenerStore {
  flushDrafts(): Promise<void>;
  syncPendingChanges(): Promise<boolean>;
  hydrateLocalNotes(): Promise<void>;
}

type RegisterVerifiedOnline = (
  callback: () => void | Promise<void>,
) => () => void;

let listenersRegistered = false;
let activeWorkspaceId: string | null = null;

export function setActiveNotesWorkspace(workspaceId: string): void {
  activeWorkspaceId = workspaceId;
}

export function registerNotesSyncListenersOnce(
  stores: ReadonlyMap<string, NotesSyncListenerStore>,
  onVerifiedOnline: RegisterVerifiedOnline,
): void {
  if (!process.client || listenersRegistered) return;

  onVerifiedOnline(() => {
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
