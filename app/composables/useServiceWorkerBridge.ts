import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'

// Types mirrored from service worker message contract (subset for UI consumption)
interface BaseMsg { type: string }
interface ActivatedMsg extends BaseMsg { type: 'SW_ACTIVATED'; version: string }
interface UpdateAvailableMsg extends BaseMsg { type: 'SW_UPDATE_AVAILABLE'; version: string }
interface ControlClaimedMsg extends BaseMsg { type: 'SW_CONTROL_CLAIMED' }
interface UploadStartMsg extends BaseMsg { type: 'UPLOAD_START'; data: { message: string } }
interface ProgressMsg extends BaseMsg { type: 'PROGRESS'; data: { identifier: string; index: number; totalChunks: number } }
interface FileCompleteMsg extends BaseMsg { type: 'FILE_COMPLETE'; data: { identifier: string; message: string } }
interface AllFilesCompleteMsg extends BaseMsg { type: 'ALL_FILES_COMPLETE'; data: { message: string } }
interface FormSyncMsg extends BaseMsg { type: 'SYNC_FORM' | 'FORM_SYNCED' | 'FORM_SYNC_ERROR'; data: { message: string } }
interface ErrorMsg extends BaseMsg { type: 'error'; data: { message: string; identifier?: string } }
interface NotificationClickNavigateMsg extends BaseMsg { type: 'NOTIFICATION_CLICK_NAVIGATE'; url: string }

type Incoming = ActivatedMsg | UpdateAvailableMsg | ControlClaimedMsg | UploadStartMsg | ProgressMsg | FileCompleteMsg | AllFilesCompleteMsg | FormSyncMsg | ErrorMsg | NotificationClickNavigateMsg

export function useServiceWorkerBridge() {
  const registration = shallowRef<ServiceWorkerRegistration | null>(null)
  const version = ref<string | null>(null)
  const updateAvailable = ref(false)
  const isControlling = ref(false)
  const uploads = ref<Record<string, { index: number; totalChunks: number; done: boolean }>>({})
  const lastError = ref<string | null>(null)
  const formSyncStatus = ref<string | null>(null)

  let messageHandler: ((e: MessageEvent) => void) | null = null

  function wireRegistrationListeners(reg: ServiceWorkerRegistration) {
    // Detect when a new SW is installed and waiting
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && reg.waiting) {
          updateAvailable.value = true
        }
      })
    })

    // Optional: observe controller changes (used for auto-reload elsewhere if desired)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // no-op here; UI component handles actual refresh
    })
  }

  function postMessage(msg: unknown) {
    if (!registration.value?.active) return
    registration.value.active.postMessage(msg)
  }

  async function ensureRegistration() {
    if (registration.value) return registration.value
    if ('serviceWorker' in navigator) {
      registration.value = await navigator.serviceWorker.ready
      if (registration.value.active) isControlling.value = true
      if (registration.value) wireRegistrationListeners(registration.value)
    }
    return registration.value
  }

  function requestSkipWaiting() { postMessage({ type: 'SKIP_WAITING' }) }
  function claimControl() { postMessage({ type: 'CLAIM_CONTROL' }) }
  function setDebug(value: boolean) { postMessage({ type: 'SET_DEBUG', value }) }

  function uploadFiles(name: string, files: File[], uploadUrl: string) {
    postMessage({ type: 'uploadFiles', name, files, uploadUrl })
  }

  function handleMessage(evt: MessageEvent) {
    const data: Incoming | undefined = evt.data
    if (!data || typeof data !== 'object') return
    switch (data.type) {
      case 'SW_ACTIVATED':
        version.value = (data as ActivatedMsg).version
        isControlling.value = true
        break
      case 'SW_UPDATE_AVAILABLE':
        updateAvailable.value = true
        break
      case 'SW_CONTROL_CLAIMED':
        isControlling.value = true
        break
      case 'UPLOAD_START':
        // no identifier yet, will arrive with PROGRESS
        break
      case 'PROGRESS': {
        const { identifier, index, totalChunks } = (data as ProgressMsg).data
        uploads.value[identifier] = { index, totalChunks, done: false }
        break
      }
      case 'FILE_COMPLETE': {
        const { identifier } = (data as FileCompleteMsg).data
        if (uploads.value[identifier]) uploads.value[identifier].done = true
        break
      }
      case 'ALL_FILES_COMPLETE':
        // could aggregate done status or emit event
        break
      case 'SYNC_FORM':
      case 'FORM_SYNCED':
      case 'FORM_SYNC_ERROR':
        formSyncStatus.value = (data as FormSyncMsg).data.message
        break
      case 'error':
        lastError.value = (data as ErrorMsg).data.message
        break
      case 'NOTIFICATION_CLICK_NAVIGATE':
        // App-level router navigation can be triggered by a watcher outside.
        break
    }
  }

  async function checkForWaitingAndSignal() {
    const reg = await ensureRegistration()
    if (reg?.waiting) updateAvailable.value = true
  }

  onMounted(async () => {
    await ensureRegistration()
    messageHandler = handleMessage
    navigator.serviceWorker.addEventListener('message', messageHandler)
    checkForWaitingAndSignal().catch(() => {})
  })

  onBeforeUnmount(() => {
    if (messageHandler) navigator.serviceWorker.removeEventListener('message', messageHandler)
  })

  async function activateUpdateAndReload() {
    requestSkipWaiting()
    // Give the new SW a brief window to activate then reload
    setTimeout(() => window.location.reload(), 400)
  }

  return {
    registration,
    version,
    updateAvailable,
    isControlling,
    uploads,
    lastError,
    formSyncStatus,
    ensureRegistration,
    requestSkipWaiting,
    claimControl,
    setDebug,
    uploadFiles,
    activateUpdateAndReload
  }
}

export type ServiceWorkerBridge = ReturnType<typeof useServiceWorkerBridge>
