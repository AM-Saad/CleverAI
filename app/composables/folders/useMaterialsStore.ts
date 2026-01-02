import { APIError } from "@/services/FetchFactory";
import type Result from "@/types/Result";
import type { UploadMaterialResponse } from "@/services/Material";

export interface MaterialState extends Material {
  // Local state tracking
  isLoading?: boolean;
  error?: string | null;
}

interface MaterialStore {
  materials: Ref<Map<string, MaterialState>>;
  materialsList: ComputedRef<MaterialState[]>;
  loadingStates: Ref<Map<string, boolean>>;
  errorStates: Ref<Map<string, string | null>>;
  fetching: Ref<boolean>;
  fetchError: Ref<APIError | null>;
  fetchTypedError: Ref<APIError | null>;

  createMaterial: (payload: {
    content: string;
    title: string;
    type: "text" | "video" | "audio" | "pdf" | "url" | "document" | undefined;
  }) => Promise<boolean>;
  uploadMaterial: (file: File, title?: string) => Promise<UploadMaterialResponse | null>;
  deleteMaterial: (id: string) => Promise<boolean>;
  isMaterialLoading: (id: string) => boolean;

  // Upload state
  uploading: Ref<boolean>;
  uploadError: Ref<APIError | null>;

  fetchMaterials: () => Promise<void>;
  getMaterial: (id: string) => Material | null;
  setMaterials?: (materials: MaterialState[]) => void;
}

// Global store instance
const stores = new Map<string, MaterialStore>();

/**
 * Creates or returns a notes store for a specific folder
 * This provides local state management with optimistic updates
 */
export function useMaterialsStore(folderId: string): MaterialStore {
  // Return existing store if available
  if (stores.has(folderId)) {
    return stores.get(folderId)!;
  }

  const { $api } = useNuxtApp();
  const toast = useToast();
  const { handleOfflineSubmit } = useOffline();


  // Local reactive state
  const materials = ref<Map<string, MaterialState>>(new Map());
  const loadingStates = ref<Map<string, boolean>>(new Map());
  const errorStates = ref<Map<string, string | null>>(new Map());
  const lastSync = ref<Date | null>(null);

  // Upload state
  const uploading = ref(false);
  const uploadError = ref<APIError | null>(null);

  const {
    fetchMaterials: fetchMaterialsFromAPI,
    fetching,
    fetchError,
    fetchTypedError,
  } = useMaterials(folderId);

  // Fetch materials for the folder from server and populate local state
  const fetchMaterials = async () => {
    try {
      const data = await fetchMaterialsFromAPI();
      // Populate local state
      materials.value.clear();
      data?.forEach((material) => {
        materials.value.set(material.id, {
          ...material,
          isLoading: false,
          error: null,
        });
      });
      lastSync.value = new Date();
    } catch (error) {
      console.error("Error fetching materials:", error);
      toast.add({
        title: "Error",
        description: "An error occurred while fetching materials.",
        color: "error",
      });
    }
  };

  // Initial fetch

  // Create a new material - simple optimistic approach
  const createMaterial = async (payload: {
    content: string;
    title: string;
    type: "text" | "video" | "audio" | "pdf" | "url" | "document" | undefined;
  }): Promise<boolean> => {
    // const tempId = `temp-${Date.now()}`;

    // // Add optimistic material
    // const optimisticMaterial: MaterialState = {
    //   id: tempId,
    //   folderId: folderId,
    //   content: payload.content,
    //   title: payload.title,
    //   type: payload.type,
    //   isLoading: true,
    //   error: null,
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // };
    // materials.value.set(tempId, optimisticMaterial);

    try {
      // Attempt to submit to server
      const result: Result<Material, APIError> = await $api.materials.create({
        folderId,
        content: payload.content,
        title: payload.title,
        type: payload.type,
      });

      if (result.success) {
        // Replace optimistic material with server material
        materials.value.set(result.data.id, result.data);
        // fetchMaterials(); // Refresh list to ensure consistency
        return true;
      } else {
        // Server rejected - mark error on optimistic material
        console.error("Server rejected material creation:", result.error);
        toast.add({
          title: "Server Error",
          description: result.error.message,
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to create material:", error);
      toast.add({
        title: "Error",
        description: "Failed to create material - check your connection",
        color: "error",
      });
      return false;
    }
  };

  // Upload a file and create material from extracted text
  const uploadMaterial = async (
    file: File,
    title?: string
  ): Promise<UploadMaterialResponse | null> => {
    uploading.value = true;
    uploadError.value = null;

    try {
      const result = await $api.materials.uploadFile(file, folderId, title);

      if (result.success) {
        // Refresh materials list to include new material
        await fetchMaterials();
        toast.add({
          title: "File Uploaded",
          description: `"${result.data.title}" processed successfully`,
          color: "success",
        });
        return result.data;
      } else {
        console.error("Server rejected file upload:", result.error);
        uploadError.value = result.error;
        toast.add({
          title: "Upload Failed",
          description: result.error.message,
          color: "error",
        });
        return null;
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      uploadError.value = new APIError(
        error instanceof Error ? error.message : "Failed to upload file",
        { status: 500, code: "UPLOAD_ERROR" }
      );
      toast.add({
        title: "Error",
        description: "Failed to upload file - check your connection",
        color: "error",
      });
      return null;
    } finally {
      uploading.value = false;
    }
  };

  // Delete a material - simple optimistic approach
  const deleteMaterial = async (id: string): Promise<boolean> => {
    try {
      const material = materials.value.get(id);
      if (!material) return false;

      // Optimistic removal from reactive state
      materials.value.delete(id);

      // Attempt to submit to server
      const result: Result<unknown, APIError> = await $api.materials.delete(id);

      if (result.success) {
        return true;
      } else {
        // Server rejected - restore material to both reactive state and IndexedDB
        console.error("Server rejected material deletion:", result.error);
        const restoredMaterial = {
          ...material,
          isLoading: false,
          error: "Server rejected deletion",
        };
        materials.value.set(id, restoredMaterial);

        toast.add({
          title: "Server Error",
          description: "Server rejected deletion. Material restored.",
          color: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Failed to delete material:", error);

      // Other errors - restore the material
      const material = materials.value.get(id);
      if (!material) {
        // Try to restore from the materials map
        const allMaterials = Array.from(materials.value.values());
        const originalMaterial = allMaterials.find((m) => m.id === id);
        if (originalMaterial) {
          materials.value.set(id, originalMaterial);
        }
      }

      toast.add({
        title: "Error",
        description: "Failed to delete material - check your connection",
        color: "error",
      });
      return false;
    }
  };

  // Utility functions
  const isMaterialLoading = (id: string): boolean => {
    return materials.value.get(id)?.isLoading ?? false;
  };

  const getMaterial = (id: string): MaterialState | null => {
    return materials.value.get(id) ?? null;
  };

  const setMaterials = (newMaterials: MaterialState[]) => {
    materials.value.clear();
    newMaterials.forEach((material) => {
      materials.value.set(material.id, material);
    });
  };

  // Computed array for easier template iteration
  const materialsList = computed(() => Array.from(materials.value.values()));

  // Create store instance
  const store: MaterialStore = {
    materials,
    materialsList,
    loadingStates,
    errorStates,
    createMaterial,
    uploadMaterial,
    deleteMaterial,
    getMaterial,
    isMaterialLoading,
    setMaterials,
    fetchMaterials,
    fetching,
    fetchError,
    fetchTypedError,
    uploading,
    uploadError,
  };

  // Cache the store
  stores.set(folderId, store);

  // Auto-sync on creation
  fetchMaterials();
  return store;
}

/**
 * Clean up store when folder is no longer needed
 */
export function cleanupMaterialStore(folderId: string): void {
  stores.delete(folderId);
}
