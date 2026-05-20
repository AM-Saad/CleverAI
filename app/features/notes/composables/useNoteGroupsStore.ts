import type { APIError } from "@/services/FetchFactory";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";
import {
  deleteNoteGroupFromIndexedDB,
  loadNoteGroupsFromIndexedDB,
  remapPendingNoteGroupIds,
  saveNoteGroupToIndexedDB,
  saveNoteGroupsToIndexedDB,
} from "~/utils/idb";
import { createIndexedDbNotesGroupQueue } from "./notesGroupQueue";
import { createIndexedDbNotesLayoutQueue } from "./notesLayoutQueue";

interface NoteGroupsStore {
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

const stores = new Map<string, NoteGroupsStore>();

const ungroupedKey = "__ungrouped__";

export function useNoteGroupsStore(workspaceId: string): NoteGroupsStore {
  if (stores.has(workspaceId)) {
    return stores.get(workspaceId)!;
  }

  const { $api } = useNuxtApp();
  const groupQueue = createIndexedDbNotesGroupQueue();
  const layoutQueue = createIndexedDbNotesLayoutQueue();
  const networkMonitor = useNetworkStatus();
  const groups = ref<Map<string, NoteGroup>>(new Map());
  const loading = ref(false);
  const error = ref<APIError | null>(null);
  const collapsedGroupIds = ref<Set<string>>(new Set());
  let activeGroupAbortController: AbortController | null = null;
  let groupReorderTimer: ReturnType<typeof setTimeout> | null = null;

  const storageKey = `collapsedNoteGroups_${workspaceId}`;

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
      localStorage.setItem(storageKey, JSON.stringify(Array.from(collapsedGroupIds.value)));
    } catch {
      // localStorage unavailable
    }
  };

  const orderedGroups = computed(() =>
    Array.from(groups.value.values()).sort((a, b) => a.order - b.order),
  );

  // ── Hydration: load local IDB state without touching the network ──
  const hydrateLocalGroups = async () => {
    const localGroups = await loadNoteGroupsFromIndexedDB(workspaceId);
    if (localGroups.length && groups.value.size === 0) {
      groups.value = new Map(localGroups.map((group) => [group.id, group]));
    }
  };

  const syncWithServer = async () => {
    loading.value = true;
    error.value = null;

    // Offline: hydrate from IDB only
    if (!networkMonitor.isVerifiedOnline.value) {
      await hydrateLocalGroups();
      loading.value = false;
      return;
    }

    // Drain pending group/layout changes before refreshing from server
    const pendingGroups = await groupQueue.load(workspaceId);
    const pendingLayout = await layoutQueue.load(workspaceId);
    if (pendingGroups.length || pendingLayout?.groups.length) {
      const syncResult = await $api.notes.sync({
        changes: [],
        contentChanges: [],
        groupChanges: pendingGroups,
        ...(pendingLayout && { layoutChange: pendingLayout }),
      });
      if (syncResult.success) {
        await groupQueue.remove(syncResult.data.groupApplied ?? []);
        await remapPendingNoteGroupIds(syncResult.data.groupIdMap ?? {});
        await Promise.all(
          Object.keys(syncResult.data.groupIdMap ?? {}).map((tempId) =>
            deleteNoteGroupFromIndexedDB(tempId),
          ),
        );
        if (syncResult.data.layoutApplied && pendingLayout) {
          await layoutQueue.remove(workspaceId);
        }

        // Remap local group IDs from temp to server-assigned IDs
        for (const [tempId, serverId] of Object.entries(syncResult.data.groupIdMap ?? {})) {
          const tempGroup = groups.value.get(tempId);
          if (tempGroup) {
            const nextGroups = new Map(groups.value);
            nextGroups.delete(tempId);
            nextGroups.set(serverId, { ...tempGroup, id: serverId });
            groups.value = nextGroups;
          }
        }
      } else {
        error.value = syncResult.error;
        loading.value = false;
        return;
      }
    }

    // Fetch server groups and MERGE (don't replace) with local state
    const result = await $api.noteGroups.getByWorkspace(workspaceId);
    if (result.success) {
      const serverGroups = new Map(result.data.map((group) => [group.id, group]));

      // Identify local-only temp groups that haven't been synced yet
      const remainingPending = await groupQueue.load(workspaceId);
      const pendingIds = new Set(remainingPending.map((p) => p.id));

      const merged = new Map(serverGroups);
      for (const [id, localGroup] of groups.value) {
        if (id.startsWith("temp-") && pendingIds.has(id)) {
          // Preserve unsynced temp groups
          merged.set(id, localGroup);
        }
      }
      groups.value = merged;
      await saveNoteGroupsToIndexedDB(result.data);
    } else {
      error.value = result.error;
    }
    loading.value = false;
  };

  const createGroup = async (title: string): Promise<string | null> => {
    const now = new Date();
    const id = `temp-group-${Date.now()}`;
    const order = orderedGroups.value.length;
    const group: NoteGroup = {
      id,
      workspaceId,
      title,
      order,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    groups.value = new Map(groups.value).set(id, group);
    await saveNoteGroupToIndexedDB(group);
    await groupQueue.add({
      id,
      operation: "create",
      workspaceId,
      title,
      order,
      updatedAt: Date.now(),
      localVersion: 1,
    });
    await groupQueue.registerBackgroundSync();
    if (networkMonitor.isVerifiedOnline.value) void syncWithServer();
    return id;
  };

  const renameGroup = async (id: string, title: string): Promise<boolean> => {
    const existing = groups.value.get(id);
    if (!existing) return false;
    const nextGroup = { ...existing, title, updatedAt: new Date() };
    groups.value = new Map(groups.value).set(id, nextGroup);
    await saveNoteGroupToIndexedDB(nextGroup);
    await groupQueue.add({
      id,
      operation: id.startsWith("temp-") ? "create" : "rename",
      workspaceId,
      title,
      order: nextGroup.order,
      updatedAt: Date.now(),
      localVersion: 1,
      serverVersion: existing.version,
    });
    await groupQueue.registerBackgroundSync();
    if (networkMonitor.isVerifiedOnline.value) void syncWithServer();
    return true;
  };

  const deleteGroup = async (id: string): Promise<boolean> => {
    const existing = groups.value.get(id);
    const nextGroups = new Map(groups.value);
    nextGroups.delete(id);
    groups.value = nextGroups;
    await deleteNoteGroupFromIndexedDB(id);
    await groupQueue.add({
      id,
      operation: "delete",
      workspaceId,
      updatedAt: Date.now(),
      localVersion: 1,
      serverVersion: existing?.version,
    });
    await groupQueue.registerBackgroundSync();
    collapsedGroupIds.value.delete(id);
    persistCollapsedState();
    if (networkMonitor.isVerifiedOnline.value) void syncWithServer();
    return true;
  };

  const reorderGroups = async (ordered: NoteGroup[]): Promise<boolean> => {
    const nextGroups = new Map(groups.value);
    ordered.forEach((group, index) => {
      nextGroups.set(group.id, { ...group, order: index });
    });
    groups.value = nextGroups;

    const groupOrders = ordered.map((group, index) => ({ id: group.id, order: index }));

    const existingLayout = await layoutQueue.load(workspaceId);
    const change = {
      id: workspaceId,
      workspaceId,
      updatedAt: Date.now(),
      localVersion: (existingLayout?.localVersion ?? 0) + 1,
      notes: existingLayout?.notes ?? [],
      groups: groupOrders,
    };
    await layoutQueue.save(change);
    if (!networkMonitor.isVerifiedOnline.value) {
      await layoutQueue.registerBackgroundSync();
    }
    await saveNoteGroupsToIndexedDB(Array.from(nextGroups.values()));

    // Clear any pending group reorder debounce timer
    if (groupReorderTimer) {
      clearTimeout(groupReorderTimer);
      groupReorderTimer = null;
    }

    // Abort the active group reorder request
    if (activeGroupAbortController) {
      console.log(`🔍 [TRACE:REORDER_GROUP] aborting active group reorder PATCH request`);
      activeGroupAbortController.abort();
      activeGroupAbortController = null;
    }

    // Debounce server PATCH for 1000ms
    groupReorderTimer = setTimeout(async () => {
      groupReorderTimer = null;

      if (!networkMonitor.isVerifiedOnline.value) {
        console.log(`🔍 [TRACE:REORDER_GROUP] background group reorder deferred — offline`);
        return;
      }

      const controller = new AbortController();
      activeGroupAbortController = controller;

      try {
        console.log(`🔍 [TRACE:REORDER_GROUP] sending group reorder PATCH to server...`);
        const res = await $api.noteGroups.reorder(
          {
            workspaceId,
            groupOrders,
          },
          { signal: controller.signal }
        );

        if (controller.signal.aborted) {
          console.log(`🔍 [TRACE:REORDER_GROUP] request aborted, ignoring response`);
          return;
        }

        if (activeGroupAbortController === controller) {
          activeGroupAbortController = null;
        }

        if (res.success) {
          if (res.data.layoutApplied) {
            console.log(`🔍 [TRACE:REORDER_GROUP] background group reorder succeeded`);
            const fresh = await layoutQueue.load(workspaceId);
            if (fresh && fresh.localVersion === change.localVersion) {
              await layoutQueue.remove(workspaceId);
            }
          } else {
            console.warn(`🔍 [TRACE:REORDER_GROUP] background group reorder returned layoutApplied=false`);
          }
        } else {
          console.warn(`🔍 [TRACE:REORDER_GROUP] background group reorder failed`, res.error);
        }
      } catch (err: any) {
        if (err.name === "AbortError" || (err instanceof Error && err.message.includes("aborted"))) {
          console.log(`🔍 [TRACE:REORDER_GROUP] group reorder PATCH aborted successfully`);
          return;
        }
        console.error(`🔍 [TRACE:REORDER_GROUP] background group reorder failed with error`, err);
      }
    }, 1000);

    return true;
  };

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
  void loadNoteGroupsFromIndexedDB(workspaceId).then((localGroups) => {
    if (localGroups.length && groups.value.size === 0) {
      groups.value = new Map(localGroups.map((group) => [group.id, group]));
    }
  });

  const store: NoteGroupsStore = {
    groups,
    loading,
    error,
    collapsedGroupIds,
    orderedGroups,
    syncWithServer,
    createGroup,
    renameGroup,
    deleteGroup,
    reorderGroups,
    isCollapsed,
    toggleCollapsed,
  };

  stores.set(workspaceId, store);
  return store;
}
