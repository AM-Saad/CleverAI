import type { APIError } from '~/services/FetchFactory'
import type { Material } from '~~/shared/material.contract'
import { useDataFetch } from '~/composables/shared/useDataFetch'
import { useNuxtApp } from '#app'

export function useMaterials(folderId: string) {
  const { $api } = useNuxtApp()

  const { data, pending, error, typedError, refresh } = useDataFetch<Material[]>(
    `materials-${folderId}`,
    () => $api.materials.getByFolder(folderId)
  )

  const removing = ref(false)
  const removeError = ref<unknown>(null)
  const removeTypedError = ref<APIError | null>(null)

  async function removeMaterial(id: string) {
    removing.value = true
    removeError.value = null
    removeTypedError.value = null
    try {
      const res = await $api.materials.delete(id)
      await refresh()
      return res
    } catch (err: unknown) {
      removeError.value = err
      removeTypedError.value = err instanceof Error && (err as Error).name === 'APIError' ? (err as APIError) : null
      throw err
    } finally {
      removing.value = false
    }
  }

  return {
    materials: data,
    loading: pending,
    error,
    typedError,
    refresh,
    removing,
    removeError,
    removeTypedError,
    removeMaterial
  }
}
