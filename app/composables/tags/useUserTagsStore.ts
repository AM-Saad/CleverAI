import type { UserTag, CreateUserTagDTO, UpdateUserTagDTO } from "~/shared/utils/user-tag.contract";

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

/**
 * Global user tags store (singleton per user session)
 */
export function useUserTagsStore(): UserTagsStore {
  // Return existing store if available
  if (globalStore) {
    return globalStore;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();

  // Local reactive state
  const tags = ref<Map<string, UserTagState>>(new Map());
  const isLoading = ref(false);

  /**
   * Load all tags from server
   */
  const loadTags = async () => {
    try {
      isLoading.value = true;
      const result = await $api.userTags.getAll();

      if (result.success && result.data) {
        tags.value.clear();
        result.data.forEach((tag: UserTag) => {
          tags.value.set(tag.id, tag);
        });
      } else {
        console.error("Failed to load tags:", result.error);
        toast.add({
          title: "Error",
          description: "Failed to load tags",
          color: "error",
        });
      }
    } catch (error) {
      console.error("Error loading tags:", error);
      toast.add({
        title: "Error",
        description: "Failed to load tags",
        color: "error",
      });
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Create a new tag
   */
  const createTag = async (name: string, color: string = "#3b82f6"): Promise<string | null> => {
    try {
      const payload: CreateUserTagDTO = { name, color };
      const result = await $api.userTags.create(payload);

      if (result.success && result.data) {
        tags.value.set(result.data.id, result.data);
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
   * Update an existing tag
   */
  const updateTag = async (id: string, updates: UpdateUserTagDTO): Promise<boolean> => {
    const tag = tags.value.get(id);
    if (!tag) return false;

    try {
      // Optimistic update
      const updatedTag = { ...tag, ...updates };
      tags.value.set(id, updatedTag);

      const result = await $api.userTags.update(id, updates);

      if (result.success && result.data) {
        tags.value.set(id, result.data);
        toast.add({
          title: "Success",
          description: "Tag updated successfully",
          color: "success",
        });
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
   * Delete a tag
   */
  const deleteTag = async (id: string): Promise<boolean> => {
    const tag = tags.value.get(id);
    if (!tag) return false;

    try {
      // Optimistic delete
      tags.value.delete(id);

      const result = await $api.userTags.delete(id);

      if (result.success) {
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
   * Reorder tags
   */
  const reorderTags = async (reorderedTags: UserTagState[]): Promise<boolean> => {
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
            tags.value.set(tag.id, { ...existingTag, order: index });
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
