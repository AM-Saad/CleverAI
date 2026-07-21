export type NotesSyncReason = "manual" | "background" | "reconnect" | "refresh";

export interface NotesSyncEngine {
  syncWorkspace(workspaceId: string, reason: NotesSyncReason): Promise<boolean>;
}

export function createNotesSyncEngine(input: {
  drainWorkspace: (workspaceId: string, reason: NotesSyncReason) => Promise<boolean>;
}): NotesSyncEngine {
  type WorkspaceRun = {
    promise: Promise<boolean>;
    rerunRequested: boolean;
  };
  const inFlight = new Map<string, WorkspaceRun>();

  return {
    syncWorkspace(workspaceId, reason) {
      const running = inFlight.get(workspaceId);
      if (running) {
        running.rerunRequested = true;
        return running.promise;
      }

      const state = {
        promise: Promise.resolve(false),
        rerunRequested: false,
      } satisfies WorkspaceRun;
      const runUntilSettled = async () => {
        let result = false;
        try {
          do {
            state.rerunRequested = false;
            result = await input.drainWorkspace(workspaceId, reason);
          } while (state.rerunRequested);
          return result;
        } finally {
          // Clear ownership in the same synchronous continuation as the final
          // rerun check. A caller can now either be observed by the loop or
          // start a fresh run; there is no promise-finally gap that drops it.
          if (inFlight.get(workspaceId) === state) {
            inFlight.delete(workspaceId);
          }
        }
      };

      inFlight.set(workspaceId, state);
      state.promise = runUntilSettled();
      return state.promise;
    },
  };
}
