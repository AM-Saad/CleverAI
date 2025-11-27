import { useNuxtApp } from "#app";
import type { CreateMaterialDTO } from "~/shared/utils/material.contract";

export function useMaterials(folderId: string) {
  const { $api } = useNuxtApp();

  // Main materials data with centralized error handling
  const { data, pending, error, refresh } = useDataFetch<Material[]>(
    `materials-${folderId}`,
    () => $api.materials.getByFolder(folderId),
  );

  // Remove operation with centralized error handling
  const removeOperation = useOperation<{ success: boolean; message: string }>();


  // Centralized removeMaterial that lets FetchFactory handle all error construction
  const removeMaterial = async (id: string) => {
    const result = await removeOperation.execute(async () => {
      const deleteResult = await $api.materials.delete(id);
      await refresh(); // Refresh the main materials list on successful deletion
      return deleteResult;
    });
    return result;
  };


  
  const createOperation = useOperation<Material>();
  const createMaterial = async (payload: CreateMaterialDTO) => {
    const result = await createOperation.execute(async () => {
      const createResult = await $api.materials.create(payload);
      await refresh(); // Refresh the main materials list on successful creation
      return createResult;
    });
    return result;
  }


  const fetchOperation = useOperation<Material[]>();
  const fetchMaterials = async () => {
    const result = await fetchOperation.execute(async () => {
      const materials = await $api.materials.getByFolder(folderId);
      return materials;
    });
    return result;
  }

  return {
    // Main materials state
    materials: data,
    loading: pending,
    error,
    refresh,

    // Remove operation state - all errors centralized via FetchFactory
    removing: removeOperation.pending,
    removeError: removeOperation.error,
    removeTypedError: removeOperation.typedError,
    removeMaterial,

    // Create operation state - all errors centralized via FetchFactory
    creating: createOperation.pending,
    createError: createOperation.error,
    createTypedError: createOperation.typedError,
    createMaterial,

    // Fetch operation state - all errors centralized via FetchFactory
    fetching: fetchOperation.pending,
    fetchError: fetchOperation.error,
    fetchTypedError: fetchOperation.typedError,
    fetchMaterials,
  };
}
