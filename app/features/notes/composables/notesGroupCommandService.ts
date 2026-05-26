import type { Ref } from "vue";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import type { NoteGroupLayoutItem } from "@@/shared/utils/note-sync.contract";
import type { NotesGroupQueue } from "./notesGroupQueue";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import { createNotesTempId } from "./tempIds";

export interface NotesGroupCommandService {
  createGroup(title: string): string | null;
  renameGroup(id: string, title: string): boolean;
  deleteGroup(id: string): boolean;
  reorderGroups(orderedGroups: NoteGroup[]): boolean;
}

export function createNotesGroupCommandService(input: {
  workspaceId: string;
  groups: Ref<Map<string, NoteGroup>>;
  groupQueue: NotesGroupQueue;
  layoutQueue: NotesLayoutQueue;
  getOrderedGroups: () => NoteGroup[];
  saveGroup: (group: NoteGroup) => Promise<void>;
  saveGroups: (groups: NoteGroup[]) => Promise<void>;
  deleteGroupLocal: (id: string) => Promise<void>;
  registerBackgroundSync: () => Promise<void>;
  scheduleSync: () => void;
  setError: (error: unknown | null) => void;
}): NotesGroupCommandService {
  const {
    workspaceId,
    groups,
    groupQueue,
    layoutQueue,
    getOrderedGroups,
    saveGroup,
    saveGroups,
    deleteGroupLocal,
    registerBackgroundSync,
    scheduleSync,
    setError,
  } = input;
  let groupLayoutGeneration = 0;

  const runBackground = (work: () => Promise<void>) => {
    void work().catch((error) => {
      console.error("[NotesGroupCommandService] Background command failed", error);
      setError(error);
    });
  };

  const setGroup = (group: NoteGroup) => {
    groups.value = new Map(groups.value).set(group.id, group);
  };

  const createGroup: NotesGroupCommandService["createGroup"] = (title) => {
    const now = new Date();
    const id = createNotesTempId("temp-group");
    const group: NoteGroup = {
      id,
      workspaceId,
      title,
      order: getOrderedGroups().length,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    setGroup(group);
    runBackground(async () => {
      await saveGroup(group);
      const currentGroup = groups.value.get(id) ?? group;
      await groupQueue.add({
        id,
        operation: "create",
        workspaceId,
        title: currentGroup.title,
        order: currentGroup.order,
        updatedAt: Date.now(),
        localVersion: 1,
      });
      await registerBackgroundSync();
      scheduleSync();
    });

    return id;
  };

  const renameGroup: NotesGroupCommandService["renameGroup"] = (id, title) => {
    const existing = groups.value.get(id);
    if (!existing) return false;

    const nextGroup = { ...existing, title, updatedAt: new Date() };
    setGroup(nextGroup);
    runBackground(async () => {
      await saveGroup(nextGroup);
      const currentGroup = groups.value.get(id);
      if (!currentGroup) return;
      await groupQueue.add({
        id,
        operation: id.startsWith("temp-") ? "create" : "rename",
        workspaceId,
        title: currentGroup.title,
        order: currentGroup.order,
        updatedAt: Date.now(),
        localVersion: 1,
        serverVersion: existing.version,
      });
      await registerBackgroundSync();
      scheduleSync();
    });

    return true;
  };

  const deleteGroup: NotesGroupCommandService["deleteGroup"] = (id) => {
    const existing = groups.value.get(id);
    const nextGroups = new Map(groups.value);
    nextGroups.delete(id);
    groups.value = nextGroups;

    runBackground(async () => {
      await deleteGroupLocal(id);
      await groupQueue.add({
        id,
        operation: "delete",
        workspaceId,
        updatedAt: Date.now(),
        localVersion: 1,
        serverVersion: existing?.version,
      });
      await registerBackgroundSync();
      scheduleSync();
    });

    return true;
  };

  const reorderGroups: NotesGroupCommandService["reorderGroups"] = (orderedGroups) => {
    const generation = ++groupLayoutGeneration;
    const nextGroups = new Map(groups.value);
    const groupOrders: NoteGroupLayoutItem[] = [];

    orderedGroups.forEach((group, index) => {
      const nextGroup = { ...group, order: index };
      nextGroups.set(group.id, nextGroup);
      groupOrders.push({ id: group.id, order: index });
    });

    groups.value = nextGroups;
    runBackground(async () => {
      if (generation !== groupLayoutGeneration) return;
      const existingLayout = await layoutQueue.load(workspaceId);
      if (generation !== groupLayoutGeneration) return;
      await layoutQueue.save({
        id: workspaceId,
        workspaceId,
        updatedAt: Date.now(),
        localVersion: (existingLayout?.localVersion ?? 0) + 1,
        notes: existingLayout?.notes ?? [],
        groups: groupOrders,
      });
      if (generation !== groupLayoutGeneration) return;
      await layoutQueue.registerBackgroundSync();
      await saveGroups(Array.from(nextGroups.values()));
      scheduleSync();
    });

    return true;
  };

  return {
    createGroup,
    renameGroup,
    deleteGroup,
    reorderGroups,
  };
}
