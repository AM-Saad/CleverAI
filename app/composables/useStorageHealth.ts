import { ref } from 'vue'

// Reactive storage health flags
const storageOk = ref(true)
const storageReason = ref<string | null>(null)

function setRestricted(reason: string) {
  if (!storageOk.value) return
  storageOk.value = false
  storageReason.value = reason
  try {
    window.dispatchEvent(new CustomEvent('storage-restricted', { detail: { reason } }))
  } catch {
    // ignore dispatch failure
  }
}

export function useStorageHealth() {
  return { storageOk, storageReason, setRestricted }
}
