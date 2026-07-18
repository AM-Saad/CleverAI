import { APIError } from "@/services/FetchFactory";
import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import type {
  NoteGroupLayoutItem,
  PendingNoteGroupChange,
} from "@@/shared/utils/note-sync.contract";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import {
  deleteNoteGroupFromIndexedDB,
  loadNoteGroupsFromIndexedDB,
  reconcileNoteGroupIds,
  saveNoteGroupToIndexedDB,
  saveNoteGroupsToIndexedDB,
} from "~/utils/idb";
import { createIndexedDbNotesGroupQueue } from "./notesGroupQueue";
import { createIndexedDbNotesLayoutQueue } from "./notesLayoutQueue";
import { createNotesGroupCommandService } from "./notesGroupCommandService";
import { comparePosition } from "../../../../shared/utils/position-key";

export type NotesSyncReason = "manual" | "background" | "reconnect" | "refresh";

export interface NoteGroupsFacade {
  groups: Ref<Map<string, NoteGroup>>;
  loading: Ref<boolean>;
  error: Ref<APIError | null>;
  collapsedGroupIds: Ref<Set<string>>;
  orderedGroups: ComputedRef<NoteGroup[]>;
  syncWithServer: () => Promise<void>;
  createGroup: (title: string) => Promise<string | null>;
  renameGroup: (id: string, title: string) => Promise<boolean>;
  deleteGroup: (id: string) => Promise<boolean>;
  reorderGroups: (orderedGroups: NoteGroup[]) => Promise<boolean>;
  isCollapsed: (id: string | null) => boolean;
  toggleCollapsed: (id: string | null) => void;
}

export interface NotesWorkspaceRuntime {
  workspaceId: string;
  groups: Ref<Map<string, NoteGroup>>;
  orderedGroups: ComputedRef<NoteGroup[]>;
  groupFacade: NoteGroupsFacade;
  getGroupLayout(): NoteGroupLayoutItem[];
  hydrateLocalGroups(): Promise<void>;
  applyOfflineGroupIdMap(
    groupIdMap: Record<string, string>,
    version?: number,
  ): Promise<void>;
  settleGroupDeletes(input: {
    appliedIds: string[];
    conflictIds: string[];
    sentChanges: PendingNoteGroupChange[];
  }): Promise<void>;
  syncGroupsWithServer(): Promise<void>;
  registerSyncDrainer(
    drainer: (reason: NotesSyncReason) => Promise<boolean>,
  ): void;
}

const runtimes = new Map<string, NotesWorkspaceRuntime>();
const ungroupedKey = "__ungrouped__";

export function useNotesWorkspaceRuntime(
  workspaceId: string,
): NotesWorkspaceRuntime {
  const existing = runtimes.get(workspaceId);
  if (existing) return existing;

  const { $api } = useNuxtApp();
  const groupQueue = createIndexedDbNotesGroupQueue();
  const layoutQueue = createIndexedDbNotesLayoutQueue();
  const networkMonitor = useNetworkStatus();
  const groups = ref<Map<string, NoteGroup>>(new Map());
  const loading = ref(false);
  const error = ref<APIError | null>(null);
  const collapsedGroupIds = ref<Set<string>>(new Set());
  const storageKey = `collapsedNoteGroups_${workspaceId}`;
  let groupSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let syncDrainer: ((reason: NotesSyncReason) => Promise<boolean>) | null =
    null;

  const loadCollapsedState = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      collapsedGroupIds.value = new Set(JSON.parse(raw));
    } catch {
      collapsedGroupIds.value = new Set();
    }
  };

  const persistCollapsedState = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(Array.from(collapsedGroupIds.value)),
      );
    } catch {
      // localStorage unavailable
    }
  };

  const orderedGroups = computed(() =>
    Array.from(groups.value.values()).sort(comparePosition),
  );

  const getGroupLayout = (): NoteGroupLayoutItem[] =>
    orderedGroups.value.map((group, index) => ({
      id: group.id,
      order: index,
    }));

  const hydrateLocalGroups = async () => {
    const localGroups = await loadNoteGroupsFromIndexedDB(workspaceId);
    if (localGroups.length && groups.value.size === 0) {
      groups.value = new Map(localGroups.map((group) => [group.id, group]));
    }
  };

  const applyOfflineGroupIdMap = async (
    groupIdMap: Record<string, string>,
    version?: number,
  ) => {
    if (!Object.keys(groupIdMap).length) return;
    await reconcileNoteGroupIds(groupIdMap, version);
    const nextGroups = new Map(groups.value);
    const nextCollapsed = new Set(collapsedGroupIds.value);
    for (const [tempId, serverId] of Object.entries(groupIdMap)) {
      const group = nextGroups.get(tempId);
      if (group) {
        nextGroups.delete(tempId);
        nextGroups.set(serverId, {
          ...group,
          id: serverId,
          ...(version !== undefined && { version }),
        });
      }
      if (nextCollapsed.delete(tempId)) nextCollapsed.add(serverId);
    }
    groups.value = nextGroups;
    collapsedGroupIds.value = nextCollapsed;
    persistCollapsedState();
  };

  const settleGroupDeletes: NotesWorkspaceRuntime["settleGroupDeletes"] =
    async ({ appliedIds, conflictIds, sentChanges }) => {
      const sentById = new Map(
        sentChanges.map((change) => [change.id, change]),
      );
      for (const id of appliedIds) {
        if (sentById.get(id)?.operation === "delete") {
          await deleteNoteGroupFromIndexedDB(id);
        }
      }
      for (const id of conflictIds) {
        const sent = sentById.get(id);
        if (sent?.operation !== "delete" || !sent.rollbackData) continue;
        const restored = sent.rollbackData as unknown as NoteGroup;
        groups.value = new Map(groups.value).set(id, { ...restored, id });
        await saveNoteGroupToIndexedDB({ ...restored, id });
        error.value = new APIError(
          "The group was changed on the server, so it was restored locally.",
        );
      }
    };

  const scheduleGroupSync = () => {
    if (!networkMonitor.isVerifiedOnline.value) return;
    if (groupSyncTimer) clearTimeout(groupSyncTimer);
    groupSyncTimer = setTimeout(() => {
      groupSyncTimer = null;
      if (networkMonitor.isVerifiedOnline.value) {
        void syncGroupsWithServer();
      }
    }, 50);
  };

  const groupCommandService = createNotesGroupCommandService({
    workspaceId,
    groups,
    groupQueue,
    layoutQueue,
    getOrderedGroups: () => orderedGroups.value,
    saveGroup: saveNoteGroupToIndexedDB,
    saveGroups: saveNoteGroupsToIndexedDB,
    deleteGroupLocal: deleteNoteGroupFromIndexedDB,
    registerBackgroundSync: () => groupQueue.registerBackgroundSync(),
    scheduleSync: scheduleGroupSync,
    setError: (nextError) => {
      error.value =
        nextError instanceof APIError
          ? nextError
          : new APIError("Failed to save note group locally");
    },
  });

  async function syncGroupsWithServer(): Promise<void> {
    loading.value = true;
    error.value = null;

    if (!networkMonitor.isVerifiedOnline.value) {
      await hydrateLocalGroups();
      loading.value = false;
      return;
    }

    const pendingGroups = await groupQueue.load(workspaceId);
    const pendingLayout = await layoutQueue.load(workspaceId);
    if (pendingGroups.length || pendingLayout?.groups.length) {
      const synced = syncDrainer ? await syncDrainer("background") : false;
      if (!synced) {
        loading.value = false;
        return;
      }
    }

    const result = await $api.noteGroups.getByWorkspace(workspaceId);
    if (result.success) {
      const serverGroups = new Map(
        result.data.map((group) => [group.id, group]),
      );
      const remainingPending = await groupQueue.load(workspaceId);
      const pendingIds = new Set(remainingPending.map((pending) => pending.id));
      const merged = new Map(serverGroups);

      for (const [id, localGroup] of groups.value) {
        if (id.startsWith("temp-") && pendingIds.has(id)) {
          merged.set(id, localGroup);
        }
      }

      groups.value = merged;
      await saveNoteGroupsToIndexedDB(result.data);
    } else {
      error.value = result.error;
    }

    loading.value = false;
  }

  const createGroup = async (title: string): Promise<string | null> =>
    await groupCommandService.createGroup(title);

  const renameGroup = async (id: string, title: string): Promise<boolean> =>
    await groupCommandService.renameGroup(id, title);

  const deleteGroup = async (id: string): Promise<boolean> => {
    const deleted = await groupCommandService.deleteGroup(id);
    if (deleted) {
      collapsedGroupIds.value.delete(id);
      persistCollapsedState();
    }
    return deleted;
  };

  const reorderGroups = async (ordered: NoteGroup[]): Promise<boolean> =>
    await groupCommandService.reorderGroups(ordered);

  const isCollapsed = (id: string | null) =>
    collapsedGroupIds.value.has(id ?? ungroupedKey);

  const toggleCollapsed = (id: string | null) => {
    const key = id ?? ungroupedKey;
    const next = new Set(collapsedGroupIds.value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    collapsedGroupIds.value = next;
    persistCollapsedState();
  };

  loadCollapsedState();
  void hydrateLocalGroups();

  const runtime: NotesWorkspaceRuntime = {
    workspaceId,
    groups,
    orderedGroups,
    groupFacade: {
      groups,
      loading,
      error,
      collapsedGroupIds,
      orderedGroups,
      syncWithServer: syncGroupsWithServer,
      createGroup,
      renameGroup,
      deleteGroup,
      reorderGroups,
      isCollapsed,
      toggleCollapsed,
    },
    getGroupLayout,
    hydrateLocalGroups,
    applyOfflineGroupIdMap,
    settleGroupDeletes,
    syncGroupsWithServer,
    registerSyncDrainer(drainer) {
      syncDrainer = drainer;
    },
  };

  runtimes.set(workspaceId, runtime);
  return runtime;
}

export function cleanupNotesWorkspaceRuntime(workspaceId: string): void {
  runtimes.delete(workspaceId);
}
