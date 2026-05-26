export type NotesSyncReason = "manual" | "background" | "reconnect" | "refresh";

export interface NotesSyncEngine {
  syncWorkspace(workspaceId: string, reason: NotesSyncReason): Promise<boolean>;
}

export function createNotesSyncEngine(input: {
  drainWorkspace: (workspaceId: string, reason: NotesSyncReason) => Promise<boolean>;
}): NotesSyncEngine {
  const inFlight = new Map<string, Promise<boolean>>();
  const rerunRequested = new Set<string>();

  return {
    syncWorkspace(workspaceId, reason) {
      const running = inFlight.get(workspaceId);
      if (running) {
        rerunRequested.add(workspaceId);
        return running;
      }

      const runUntilSettled = async () => {
        let result = await input.drainWorkspace(workspaceId, reason);
        while (rerunRequested.has(workspaceId)) {
          rerunRequested.delete(workspaceId);
          result = await input.drainWorkspace(workspaceId, reason);
        }
        return result;
      };

      const nextRun = runUntilSettled().finally(() => {
        inFlight.delete(workspaceId);
        rerunRequested.delete(workspaceId);
      });
      inFlight.set(workspaceId, nextRun);
      return nextRun;
    },
  };
}
