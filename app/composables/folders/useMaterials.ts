import type { Material } from '~~/shared/material.contract'
import { useDataFetch } from '~/composables/shared/useDataFetch'
import { useOperation } from '~/composables/shared/useOperation'
import { useNuxtApp } from '#app'

export function useMaterials(folderId: string) {
  const { $api } = useNuxtApp()

  // Main materials data with centralized error handling
  const { data, pending, error, refresh } = useDataFetch<Material[]>(
    `materials-${folderId}`,
    () => $api.materials.getByFolder(folderId)
  )

  // Remove operation with centralized error handling
  const removeOperation = useOperation<{ success: boolean; message: string }>()

  // Centralized removeMaterial that lets FetchFactory handle all error construction
  const removeMaterial = async (id: string) => {
    const result = await removeOperation.execute(async () => {
      const deleteResult = await $api.materials.delete(id)
      await refresh() // Refresh the main materials list on successful deletion
      return deleteResult
    })
    return result
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
    removeMaterial
  }
}
