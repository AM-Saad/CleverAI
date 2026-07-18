import type { Ref } from "vue";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";
import type { NoteGroupLayoutItem } from "@@/shared/utils/note-sync.contract";
import type { NotesGroupQueue } from "./notesGroupQueue";
import type { NotesLayoutQueue } from "./notesLayoutQueue";
import { createNotesTempId } from "./tempIds";

export interface NotesGroupCommandService {
  createGroup(title: string): Promise<string | null>;
  renameGroup(id: string, title: string): Promise<boolean>;
  deleteGroup(id: string): Promise<boolean>;
  reorderGroups(orderedGroups: NoteGroup[]): Promise<boolean>;
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

  const setGroup = (group: NoteGroup) => {
    groups.value = new Map(groups.value).set(group.id, group);
  };

  const createGroup: NotesGroupCommandService["createGroup"] = async (
    title,
  ) => {
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
    try {
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
      return id;
    } catch (error) {
      const nextGroups = new Map(groups.value);
      nextGroups.delete(id);
      groups.value = nextGroups;
      setError(error);
      return null;
    }
  };

  const renameGroup: NotesGroupCommandService["renameGroup"] = async (
    id,
    title,
  ) => {
    const existing = groups.value.get(id);
    if (!existing) return false;

    const nextGroup = { ...existing, title, updatedAt: new Date() };
    setGroup(nextGroup);
    try {
      await saveGroup(nextGroup);
      const currentGroup = groups.value.get(id);
      if (!currentGroup) return false;
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
      return true;
    } catch (error) {
      setGroup(existing);
      setError(error);
      return false;
    }
  };

  const deleteGroup: NotesGroupCommandService["deleteGroup"] = async (id) => {
    const existing = groups.value.get(id);
    const nextGroups = new Map(groups.value);
    nextGroups.delete(id);
    groups.value = nextGroups;

    try {
      await groupQueue.add({
        id,
        operation: "delete",
        workspaceId,
        updatedAt: Date.now(),
        localVersion: 1,
        serverVersion: existing?.version,
        rollbackData: existing as unknown as
          | Record<string, unknown>
          | undefined,
      });
      // Keep a server-backed canonical snapshot until the server acknowledges
      // the tombstone. A never-synced temp group can be removed immediately.
      if (/^(temp-|local:)/.test(id)) await deleteGroupLocal(id);
      await registerBackgroundSync();
      scheduleSync();
      return true;
    } catch (error) {
      if (existing) {
        setGroup(existing);
        try {
          await saveGroup(existing);
        } catch {
          /* retain memory rollback */
        }
      }
      setError(error);
      return false;
    }
  };

  const reorderGroups: NotesGroupCommandService["reorderGroups"] = async (
    orderedGroups,
  ) => {
    const generation = ++groupLayoutGeneration;
    const previousGroups = groups.value;
    const nextGroups = new Map(groups.value);
    const groupOrders: NoteGroupLayoutItem[] = [];

    orderedGroups.forEach((group, index) => {
      const nextGroup = { ...group, order: index };
      nextGroups.set(group.id, nextGroup);
      groupOrders.push({ id: group.id, order: index });
    });

    groups.value = nextGroups;
    try {
      if (generation !== groupLayoutGeneration) return true;
      const existingLayout = await layoutQueue.load(workspaceId);
      if (generation !== groupLayoutGeneration) return true;
      await layoutQueue.save({
        id: workspaceId,
        workspaceId,
        updatedAt: Date.now(),
        localVersion: (existingLayout?.localVersion ?? 0) + 1,
        notes: existingLayout?.notes ?? [],
        groups: groupOrders,
      });
      if (generation !== groupLayoutGeneration) return true;
      await layoutQueue.registerBackgroundSync();
      await saveGroups(Array.from(nextGroups.values()));
      scheduleSync();
      return true;
    } catch (error) {
      if (generation === groupLayoutGeneration) groups.value = previousGroups;
      setError(error);
      return false;
    }
  };

  return {
    createGroup,
    renameGroup,
    deleteGroup,
    reorderGroups,
  };
}
