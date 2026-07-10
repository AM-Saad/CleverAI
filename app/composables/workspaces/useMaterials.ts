import { useNuxtApp } from "#app";
import type { CreateMaterialDTO } from "~/shared/utils/material.contract";
import { listOfflineEntities, putOfflineEntities } from "~/utils/offline-v2/repository";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

export function useMaterials(workspaceId: string) {
  const { $api } = useNuxtApp();
  const offline = useOfflineRuntime();
  const readMaterials = async () => {
    if (!offline.isOnline.value && offline.accountId.value) {
      const records = await listOfflineEntities<Material>(offline.accountId.value, "material", workspaceId);
      return { success: true, data: records.map((record) => record.data) } as any;
    }
    const result = await $api.materials.getByWorkspace(workspaceId);
    if (result.success && offline.accountId.value) {
      await putOfflineEntities(result.data.map((material) => ({
        id: `${offline.accountId.value}:material:${material.id}`,
        accountId: offline.accountId.value,
        entity: "material" as const,
        entityId: material.id,
        workspaceId,
        version: 0,
        updatedAt: Date.now(),
        data: material as unknown as Record<string, unknown>,
      })));
    }
    return result;
  };

  // Main materials data with centralized error handling
  const { data, pending, error, refresh } = useDataFetch<Material[]>(
    `materials-${workspaceId}`,
    readMaterials,
  );

  // Remove operation with centralized error handling
  const removeOperation = useOperation<{ success: boolean; message: string }>();


  // Centralized removeMaterial that lets FetchFactory handle all error construction
  const removeMaterial = async (id: string) => {
    if (!offline.isOnline.value) {
      await offline.queue({ entity: "material", operation: "material.delete", entityId: id, workspaceId, changedFields: ["deleted"], payload: {} });
      await refresh();
      return { success: true, message: "Saved locally" } as any;
    }
    const result = await removeOperation.execute(async () => {
      const deleteResult = await $api.materials.delete(id);
      await refresh(); // Refresh the main materials list on successful deletion
      return deleteResult;
    });
    return result;
  };



  const createOperation = useOperation<Material>();
  const createMaterial = async (payload: CreateMaterialDTO) => {
    if (!offline.isOnline.value) {
      const { entityId } = await offline.queue({
        entity: "material",
        operation: "material.create",
        workspaceId,
        changedFields: ["title", "content", "type", "metadata"],
        payload: { workspaceId, ...payload },
        localData: { workspaceId, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
      await refresh();
      return { id: entityId, workspaceId, ...payload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Material;
    }
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
      return readMaterials();
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
