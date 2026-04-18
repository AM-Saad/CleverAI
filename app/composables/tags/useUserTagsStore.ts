import type { UserTag, CreateUserTagDTO, UpdateUserTagDTO } from "~/shared/utils/user-tag.contract";
import { DB_CONFIG } from "~/utils/constants/pwa";
import { openUnifiedDB, putRecord, getAllRecords, deleteRecord } from "~/utils/idb";
import { useNetworkStatus } from "~/composables/shared/useNetworkStatus";

type STORES = typeof DB_CONFIG.STORES[keyof typeof DB_CONFIG.STORES];

export interface UserTagState extends UserTag {
  isLoading?: boolean;
  error?: string | null;
}

interface UserTagsStore {
  tags: Ref<Map<string, UserTagState>>;
  isLoading: Ref<boolean>;
  loadTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<string | null>;
  updateTag: (id: string, updates: UpdateUserTagDTO) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  reorderTags: (reorderedTags: UserTagState[]) => Promise<boolean>;
  getTag: (id: string) => UserTagState | null;
  getTagByName: (name: string) => UserTagState | null;
}

let globalStore: UserTagsStore | null = null;

// ─── IDB helpers ──────────────────────────────────────────────────────────────

async function saveTagToIDB(tag: UserTagState): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.USER_TAGS)) return;
    await putRecord(db, DB_CONFIG.STORES.USER_TAGS as STORES, tag);
  } catch (e) {
    console.warn("[UserTags] Failed to save tag to IDB:", e);
  }
}

async function deleteTagFromIDB(id: string): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.USER_TAGS)) return;
    await deleteRecord(db, DB_CONFIG.STORES.USER_TAGS as STORES, id);
  } catch (e) {
    console.warn("[UserTags] Failed to delete tag from IDB:", e);
  }
}

async function loadTagsFromIDB(): Promise<UserTagState[]> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.USER_TAGS)) return [];
    return await getAllRecords<UserTagState>(db, DB_CONFIG.STORES.USER_TAGS as STORES);
  } catch (e) {
    console.warn("[UserTags] Failed to load tags from IDB:", e);
    return [];
  }
}

async function replaceAllTagsInIDB(allTags: UserTagState[]): Promise<void> {
  try {
    const db = await openUnifiedDB();
    if (!db.objectStoreNames.contains(DB_CONFIG.STORES.USER_TAGS)) return;

    // Clear existing tags and save all new ones
    const existing = await getAllRecords<UserTagState>(db, DB_CONFIG.STORES.USER_TAGS as STORES);
    for (const old of existing) {
      await deleteRecord(db, DB_CONFIG.STORES.USER_TAGS as STORES, old.id);
    }
    for (const tag of allTags) {
      await putRecord(db, DB_CONFIG.STORES.USER_TAGS as STORES, tag);
    }
  } catch (e) {
    console.warn("[UserTags] Failed to replace tags in IDB:", e);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Global user tags store (singleton per user session).
 *
 * Offline strategy:
 *  - On `loadTags()`, always hydrate from IDB first, then attempt server fetch.
 *  - On success, replace IDB cache with server data.
 *  - If offline, silently fall back to IDB (no error toast).
 *  - Mutations (create/update/delete/reorder) require online and show a toast
 *    if the user is offline, similar to board columns.
 */
export function useUserTagsStore(workspaceId?: string): UserTagsStore {
  // Return existing store if available
  if (globalStore) {
    return globalStore;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const networkMonitor = useNetworkStatus();

  // Local reactive state
  const tags = ref<Map<string, UserTagState>>(new Map());
  const isLoading = ref(false);

  /**
   * Load all tags — IDB first, then server if online.
   */
  const loadTags = async () => {
    try {
      isLoading.value = true;

      // Step 1: Hydrate from IDB immediately
      const localTags = await loadTagsFromIDB();
      if (localTags.length > 0 && tags.value.size === 0) {
        for (const tag of localTags) {
          tags.value.set(tag.id, tag);
        }
      }

      // Step 2: If offline, stop here — IDB is good enough
      if (!networkMonitor.isVerifiedOnline.value) {
        return;
      }

      // Step 3: Fetch from server and replace local cache
      const result = await $api.userTags.getAll();

      if (result.success && result.data) {
        tags.value.clear();
        const serverTags: UserTagState[] = [];
        result.data.forEach((tag: UserTag) => {
          tags.value.set(tag.id, tag);
          serverTags.push(tag);
        });
        // Persist to IDB for next offline session
        await replaceAllTagsInIDB(serverTags);
      } else {
        // Server returned an error but we have IDB data — don't show error
        if (tags.value.size === 0) {
          console.error("Failed to load tags:", result.error);
        }
      }
    } catch (error) {
      // Network error — IDB data is already loaded, suppress error toast
      if (tags.value.size === 0) {
        console.error("Error loading tags:", error);
      }
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Create a new tag (requires online)
   */
  const createTag = async (name: string, color: string = "#3b82f6"): Promise<string | null> => {
    if (!networkMonitor.isVerifiedOnline.value) {
      toast.add({
        title: "Offline",
        description: "Tag creation is not available while offline.",
        color: "warning",
      });
      return null;
    }

    try {
      const payload: CreateUserTagDTO = { name, color };
      const result = await $api.userTags.create(payload);

      if (result.success && result.data) {
        tags.value.set(result.data.id, result.data);
        await saveTagToIDB(result.data);
        toast.add({
          title: "Success",
          description: "Tag created successfully",
          color: "success",
        });
        return result.data.id;
      } else {
        const errorMsg = result.error?.message || "Failed to create tag";
        toast.add({
          title: "Error",
          description: errorMsg,
          color: "error",
        });
        return null;
      }
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.add({
        title: "Error",
        description: "Failed to create tag",
        color: "error",
      });
      return null;
    }
  };

  /**
   * Update an existing tag (requires online)
   */
  const updateTag = async (id: string, updates: UpdateUserTagDTO): Promise<boolean> => {
    const tag = tags.value.get(id);
    if (!tag) return false;

    if (!networkMonitor.isVerifiedOnline.value) {
      toast.add({
        title: "Offline",
        description: "Tag updates are not available while offline.",
        color: "warning",
      });
      return false;
    }

    try {
      // Optimistic update
      const updatedTag = { ...tag, ...updates };
      tags.value.set(id, updatedTag);

      const result = await $api.userTags.update(id, updates);

      if (result.success && result.data) {
        tags.value.set(id, result.data);
        await saveTagToIDB(result.data);
        return true;
      } else {
        // Revert on error
        tags.value.set(id, tag);
        const errorMsg = result.error?.message || "Failed to update tag";
        toast.add({
          title: "Error",
          description: errorMsg,
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Revert on error
      tags.value.set(id, tag);
      console.error("Error updating tag:", error);
      toast.add({
        title: "Error",
        description: "Failed to update tag",
        color: "error",
      });
      return false;
    }
  };

  /**
   * Delete a tag (requires online)
   */
  const deleteTag = async (id: string): Promise<boolean> => {
    const tag = tags.value.get(id);
    if (!tag) return false;

    if (!networkMonitor.isVerifiedOnline.value) {
      toast.add({
        title: "Offline",
        description: "Tag deletion is not available while offline.",
        color: "warning",
      });
      return false;
    }

    try {
      // Optimistic delete
      tags.value.delete(id);

      const result = await $api.userTags.delete(id);

      if (result.success) {
        await deleteTagFromIDB(id);
        toast.add({
          title: "Success",
          description: "Tag deleted successfully",
          color: "success",
        });
        return true;
      } else {
        // Revert on error
        tags.value.set(id, tag);
        const errorMsg = result.error?.message || "Failed to delete tag";
        toast.add({
          title: "Error",
          description: errorMsg,
          color: "error",
        });
        return false;
      }
    } catch (error) {
      // Revert on error
      tags.value.set(id, tag);
      console.error("Error deleting tag:", error);
      toast.add({
        title: "Error",
        description: "Failed to delete tag",
        color: "error",
      });
      return false;
    }
  };

  /**
   * Reorder tags (requires online)
   */
  const reorderTags = async (reorderedTags: UserTagState[]): Promise<boolean> => {
    if (!networkMonitor.isVerifiedOnline.value) {
      toast.add({
        title: "Offline",
        description: "Tag reordering is not available while offline.",
        color: "warning",
      });
      return false;
    }

    try {
      // Build the reorder payload
      const tagOrders = reorderedTags.map((tag, index) => ({
        id: tag.id,
        order: index,
      }));

      const result = await $api.userTags.reorder({ tagOrders });

      if (result.success) {
        // Update local state with new orders
        reorderedTags.forEach((tag, index) => {
          const existingTag = tags.value.get(tag.id);
          if (existingTag) {
            const updated = { ...existingTag, order: index };
            tags.value.set(tag.id, updated);
            saveTagToIDB(updated); // fire-and-forget
          }
        });
        return true;
      } else {
        const errorMsg = result.error?.message || "Failed to reorder tags";
        toast.add({
          title: "Error",
          description: errorMsg,
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Error reordering tags:", error);
      toast.add({
        title: "Error",
        description: "Failed to reorder tags",
        color: "error",
      });
      return false;
    }
  };

  /**
   * Get a tag by ID
   */
  const getTag = (id: string): UserTagState | null => {
    return tags.value.get(id) || null;
  };

  /**
   * Get a tag by name (case-insensitive)
   */
  const getTagByName = (name: string): UserTagState | null => {
    const normalizedName = name.toLowerCase();
    for (const tag of tags.value.values()) {
      if (tag.name.toLowerCase() === normalizedName) {
        return tag;
      }
    }
    return null;
  };

  // Create store instance
  const store: UserTagsStore = {
    tags,
    isLoading,
    loadTags,
    createTag,
    updateTag,
    deleteTag,
    reorderTags,
    getTag,
    getTagByName,
  };

  // Cache the global store
  globalStore = store;

  return store;
}
