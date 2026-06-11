import { computed, ref } from "vue";

export type NotesCollaborationStatus = {
  noteId: string;
  workspaceId: string;
  enabled: boolean;
  connected: boolean;
  synced: boolean;
  indexedDbSynced: boolean;
  unsyncedChanges: number;
  error: string | null;
  updatedAt: number;
};

const statuses = ref<Map<string, NotesCollaborationStatus>>(new Map());

export function useNotesCollaborationStatus() {
  const setStatus = (
    noteId: string,
    patch: Partial<Omit<NotesCollaborationStatus, "noteId" | "updatedAt">>,
  ) => {
    const existing = statuses.value.get(noteId);
    const next: NotesCollaborationStatus = {
      noteId,
      workspaceId: patch.workspaceId ?? existing?.workspaceId ?? "",
      enabled: patch.enabled ?? existing?.enabled ?? false,
      connected: patch.connected ?? existing?.connected ?? false,
      synced: patch.synced ?? existing?.synced ?? false,
      indexedDbSynced: patch.indexedDbSynced ?? existing?.indexedDbSynced ?? false,
      unsyncedChanges: patch.unsyncedChanges ?? existing?.unsyncedChanges ?? 0,
      error: patch.error !== undefined ? patch.error : existing?.error ?? null,
      updatedAt: Date.now(),
    };
    statuses.value = new Map(statuses.value).set(noteId, next);
  };

  const clearStatus = (noteId: string) => {
    const next = new Map(statuses.value);
    next.delete(noteId);
    statuses.value = next;
  };

  const byWorkspace = (workspaceId: string) =>
    computed(() =>
      Array.from(statuses.value.values()).filter(
        (status) => status.workspaceId === workspaceId,
      ),
    );

  return {
    statuses,
    setStatus,
    clearStatus,
    byWorkspace,
  };
}
