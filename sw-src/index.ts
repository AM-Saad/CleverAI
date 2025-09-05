/// <reference lib="WebWorker" />
// TypeScript source of the service worker. Built to public/sw.js before Workbox injectManifest runs.
// KEEP exactly one occurrence of self.__WB_MANIFEST.

// Augment the global self type safely

// Bundle Workbox modules directly to avoid cross-origin importScripts and COEP/CORP issues.
// These are ESM imports that esbuild will bundle into the final IIFE output.
// In production, Workbox manifest will be injected by scripts/inject-sw.cjs.
// In dev, __WB_MANIFEST will be undefined; we guard for that below.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// No global augmentation required; we'll cast when reading __WB_MANIFEST.

// Wrap logic but avoid nested ambiguous closures for TS parser
(() => {
  const SW_VERSION = 'v1.7.0-enhanced'
  // Toggleable debug flag (can be overridden via postMessage later if desired)
  let DEBUG = false
  const log = (...args: unknown[]) => { if (DEBUG) console.log('[SW]', ...args) }
  const warn = (...args: unknown[]) => { if (DEBUG) console.warn('[SW]', ...args) }
  const error = (...args: unknown[]) => console.error('[SW]', ...args) // errors always logged
  log('Loading TS source', SW_VERSION, self.location.href)

  // Allow runtime enabling of DEBUG via query param when registering or via message
  try { if (new URL(self.location.href).searchParams.get('swDebug') === '1') DEBUG = true } catch { /* ignore */ }

// ---------------------------------------------------------------------------
// Enhanced SW Features (migrated from legacy implementation)
//  - Push Notifications
//  - Notification Click Handling
//  - Background Sync (one-off)
//  - Periodic Sync (if available)
//  - IndexedDB (projects/forms) storage helpers
//  - Concurrent Chunked Upload Support with Retries
//  - Extended Precache entries (/about, /offline)
//  - Offline navigation fallback to /offline when network unavailable
// ---------------------------------------------------------------------------

// -------------------------- TYPE DEFINITIONS --------------------------
interface UploadStartMessage { type: typeof SW_MESSAGE_TYPE.UPLOAD_START; data: { message: string } }
interface ProgressMessage { type: typeof SW_MESSAGE_TYPE.PROGRESS; data: { identifier: string; index: number; totalChunks: number } }
interface FileCompleteMessage { type: typeof SW_MESSAGE_TYPE.FILE_COMPLETE; data: { identifier: string; message: string } }
interface AllFilesCompleteMessage { type: typeof SW_MESSAGE_TYPE.ALL_FILES_COMPLETE; data: { message: string } }
interface FormSyncedMessage { type: typeof SW_MESSAGE_TYPE.FORM_SYNCED; data: { message: string } }
interface FormSyncErrorMessage { type: typeof SW_MESSAGE_TYPE.FORM_SYNC_ERROR; data: { message: string } }
interface SyncFormNoticeMessage { type: typeof SW_MESSAGE_TYPE.SYNC_FORM; data: { message: string } }
type UploadLifecycleMessage = UploadStartMessage | ProgressMessage | FileCompleteMessage | AllFilesCompleteMessage
type FormSyncLifecycleMessage = FormSyncedMessage | FormSyncErrorMessage | SyncFormNoticeMessage

type _OutgoingSWMessage =
  | UploadLifecycleMessage
  | FormSyncLifecycleMessage
  | { type: 'SW_ACTIVATED'; version: string }
  | { type: 'SW_CONTROL_CLAIMED' }
  | { type: 'NOTIFICATION_CLICK_NAVIGATE'; url: string }
  | { type: 'error'; data: { message: string; identifier?: string } }

interface UploadFilesMessage {
  type: 'uploadFiles'
  name: string
  files: File[]
  uploadUrl: string
}

interface TestNotificationClickMessage { type: 'TEST_NOTIFICATION_CLICK'; data?: { url?: string } }
interface SkipWaitingMessage { type: 'SKIP_WAITING' }
interface ClaimControlMessage { type: 'CLAIM_CONTROL' }
interface ToggleDebugMessage { type: 'SET_DEBUG'; value: boolean }
type IncomingSWMessage = UploadFilesMessage | TestNotificationClickMessage | SkipWaitingMessage | ClaimControlMessage | ToggleDebugMessage

// Data types stored in forms object store
interface StoredFormRecord {
  email: string
  payload: unknown
  createdAt: number
}

// Message types constant
const SW_MESSAGE_TYPE = {
  UPLOAD_START: 'UPLOAD_START',
  PROGRESS: 'PROGRESS',
  FILE_COMPLETE: 'FILE_COMPLETE',
  ALL_FILES_COMPLETE: 'ALL_FILES_COMPLETE',
  FORM_SYNC_ERROR: 'FORM_SYNC_ERROR',
  FORM_SYNCED: 'FORM_SYNCED',
  SYNC_FORM: 'SYNC_FORM'
} as const

// Simple adaptive chunk size calculator (inlined instead of external import)
function calculateChunkSize(fileSize: number) {
  // min 256KB, max 5MB, ~100 chunks target
  return Math.max(256 * 1024, Math.min(5 * 1024 * 1024, Math.ceil(fileSize / 100)))
}

// IndexedDB handles
let db: IDBDatabase | null = null
const DB_NAME = 'recwide_db'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest
      const upgradeDb = target.result
      if (!upgradeDb.objectStoreNames.contains('projects')) {
        const projects = upgradeDb.createObjectStore('projects', { keyPath: 'name' })
        projects.createIndex('name', 'name', { unique: false })
      }
      if (!upgradeDb.objectStoreNames.contains('forms')) {
        const forms = upgradeDb.createObjectStore('forms', { keyPath: 'email' })
        forms.createIndex('email', 'email', { unique: false })
      }
    }
    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

openDatabase().catch(err => error('IndexedDB open failed', err))

// const calculate_chunk_size = (fileSize: number) => Math.max(262144, Math.min(5242880, Math.ceil(fileSize / 100)))

// Lazy initialized IndexedDB (placeholder for future use)
// const dbPlaceholder: IDBDatabase | null = null

// Workbox setup using bundled modules -------------------------------------------------
clientsClaim()

// Precache injection placeholder - CRITICAL: Must use exact format for Workbox injection
// TypeScript safe access with fallback for development
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const manifest = (self as any).__WB_MANIFEST || []
precacheAndRoute(manifest, { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] })
cleanupOutdatedCaches()

// Navigation handling: For SSR/dev, skip createHandlerBoundToURL which expects a precached URL.
// Our fetch handler below provides an offline fallback for navigations.

// Runtime caching strategies -------------------------------------------------
// 1. Versioned build assets in /_nuxt/ (hashed filenames) – CacheFirst
registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/_nuxt/'),
  new CacheFirst({
    cacheName: 'nuxt-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }) // 30 days
    ]
  })
)

// 2. Static images (already present) – keep CacheFirst (slightly larger limits)
registerRoute(
  ({ request }: { request: Request }) => /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/.test(request.url),
  new CacheFirst({
    cacheName: 'images',
    plugins: [ new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }) ]
  })
)

// 3. JS / CSS (outside hashed _nuxt path) – StaleWhileRevalidate for quick loads + background update
registerRoute(
  ({ request, url }: { request: Request; url: URL }) => (
    (request.destination === 'script' || request.destination === 'style') && !url.pathname.startsWith('/_nuxt/')
  ),
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [ new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 14 * 24 * 60 * 60 }) ]
  })
)

// 4. API GET requests – NetworkFirst with small timeout fallback to cache
registerRoute(
  ({ url, request }: { url: URL; request: Request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-get',
    networkTimeoutSeconds: 10,
    plugins: [ new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }) ] // 5 minutes
  })
)

// 5. Fallback for other same-origin navigation sub-resources (fonts) – StaleWhileRevalidate
registerRoute(
  ({ request }: { request: Request }) => request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'fonts',
    plugins: [ new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 24 * 60 * 60 }) ] // 60 days
  })
)

  // ------------------------ LIFECYCLE EVENTS ------------------------
const swSelf = self as unknown as ServiceWorkerGlobalScope

swSelf.addEventListener('install', (_event: ExtendableEvent) => {
  log('install event')
  // Do not auto-activate; let the new worker wait for user consent.
  // Avoid long-running install promises that can show "trying to install".
})

swSelf.addEventListener('activate', (event: ExtendableEvent) => {
  log('activate event')
  event.waitUntil((async () => {
  try { await swSelf.clients.claim() } catch (e) { warn('clients.claim failed', e) }
  log('claimed clients')
    const clients = await swSelf.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    for (const c of clients) c.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION })
  })())
})

// Proactively notify pages when a new SW is waiting (in case of race vs immediate activation)
// This triggers if this active SW detects a future update cycle placing the next one into waiting.
// Only runs if registration available (in SW global scope via self.registration).
try {
  // Listen for future updates (e.g., periodic checks) and broadcast when a waiting worker appears.
  self.addEventListener('statechange', () => { /* noop: statechange events occur on worker, not registration */ })
  // Poll registration periodically (lightweight) – alternative to relying on external client check.
  const notifyIfWaiting = async () => {
  const reg = (self as unknown as ServiceWorkerGlobalScope).registration as ServiceWorkerRegistration | undefined
    const waiting = reg?.waiting
    if (waiting) {
      const clients = await swSelf.clients.matchAll({ includeUncontrolled: true, type: 'window' })
      clients.forEach(c => c.postMessage({ type: 'SW_UPDATE_AVAILABLE', version: SW_VERSION }))
    }
  }
  // Initial slight delay to allow potential update flow to settle.
  setTimeout(() => { notifyIfWaiting().catch(() => {}) }, 1500)
  // Periodic lightweight check (every 30s) – can be disabled if noisy.
  setInterval(() => { notifyIfWaiting().catch(() => {}) }, 30000)
} catch { /* ignore */ }

  // ------------------------ MESSAGE HANDLING ------------------------
swSelf.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = (event.data || {}) as IncomingSWMessage | { type?: string }
  const type = (data as { type?: IncomingSWMessage['type'] }).type
    if (type === 'SKIP_WAITING') {
      log('Received SKIP_WAITING')
      swSelf.skipWaiting()
      return
    }
    if (type === 'CLAIM_CONTROL') {
      swSelf.clients.claim().then(async () => {
        const clients = await swSelf.clients.matchAll({ type: 'window' })
        clients.forEach(c => c.postMessage({ type: 'SW_CONTROL_CLAIMED' }))
      })
      return
    }
    if (type === 'TEST_NOTIFICATION_CLICK') {
      const targetUrl = (data as TestNotificationClickMessage).data?.url || '/'
      const extendable = event as ExtendableEvent
  extendable.waitUntil((async () => {
        const clients = await swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (clients.length) {
          clients[0].postMessage({ type: 'NOTIFICATION_CLICK_NAVIGATE', url: targetUrl })
          try { await (clients[0] as WindowClient).focus() } catch (e) { warn('focus failed', e) }
        } else {
          await swSelf.clients.openWindow(targetUrl)
        }
  })())
      return
    }
    if (type === 'uploadFiles') {
      const payload = data as UploadFilesMessage
      // broadcast start back to originating client (ExtendableMessageEvent.source is Client | ServiceWorker | MessagePort)
      const source = event.source
      if (source && 'id' in source) {
        swSelf.clients.get((source as Client).id).then(client => {
          client?.postMessage({ type: SW_MESSAGE_TYPE.UPLOAD_START, data: { message: 'Upload started' } })
        })
      }
      handleDatabaseOperation({ action: 'add', payload: { name: payload.name, files: payload.files } })
      const ext = event as ExtendableEvent
      ext.waitUntil(handleConcurrentUploads(payload.name, payload.files || [], payload.uploadUrl))
      return
    }
    if (type === 'SET_DEBUG') {
  DEBUG = !!(data as ToggleDebugMessage).value
      log('Debug mode set to', DEBUG)
      return
    }
})

  // ------------------------ PUSH NOTIFICATIONS ------------------------
swSelf.addEventListener('push', (event: PushEvent) => {
  log('push received')
    event.waitUntil((async () => {
      try {
        if (!event.data) return
    const data: Partial<{ title: string; message: string; icon: string; tag: string; requireInteraction: boolean; silent: boolean; url: string; data: Record<string, unknown> }> = (() => { try { return event.data!.json() } catch { return {} } })()
        const title = data.title || 'Notification'
        const options: NotificationOptions = {
          body: data.message || '',
          icon: data.icon || '/icons/192x192.png',
          badge: '/icons/96x96.png',
          tag: data.tag || 'default',
          requireInteraction: !!data.requireInteraction,
          silent: !!data.silent,
          data: { url: data.url || '/', timestamp: Date.now(), ...(data.data || {}) }
        }
    await swSelf.registration.showNotification(title, options)
      } catch (err) {
    error('push handler error', err)
  try { await swSelf.registration.showNotification('CleverAI Notification', { body: 'You have a new notification', icon: '/icons/192x192.png', tag: 'fallback' }) } catch { /* ignore */ }
      }
    })())
  })

swSelf.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close()
    event.waitUntil((async () => {
      const ndata = event.notification.data as { url?: string } | undefined
      const targetUrl = (ndata?.url) || '/'
      const clients = await swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (clients.length) {
        for (const c of clients) c.postMessage({ type: 'NOTIFICATION_CLICK_NAVIGATE', url: targetUrl })
        try { await (clients[0] as WindowClient).focus() } catch { /* ignore */ }
        return
      }
      try { await swSelf.clients.openWindow(targetUrl) } catch { /* ignore */ }
    })())
  })

  // ------------------------ PERIODIC & BACKGROUND SYNC ------------------------
swSelf.addEventListener('periodicsync', (event: Event) => {
    const psEvent = event as unknown as { tag?: string; waitUntil: ExtendableEvent['waitUntil'] }
    if (psEvent.tag === 'content-sync') {
      psEvent.waitUntil(syncContent())
    }
  })

swSelf.addEventListener('sync', (event: Event) => {
    const syncEvt = event as unknown as { tag?: string; waitUntil: ExtendableEvent['waitUntil'] }
    if (syncEvt.tag === 'syncForm') {
      syncEvt.waitUntil((async () => {
        const clients = await swSelf.clients.matchAll({ type: 'window' })
        clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.SYNC_FORM, data: { message: 'Syncing data..' } }))
        await syncAuthentication(clients)
      })())
    }
  })

  // ------------------------ FETCH FALLBACK (Offline for navigations) ------------------------
swSelf.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request
    if (req.mode === 'navigate') {
      event.respondWith((async () => {
        try { return await fetch(req) } catch {
          // Try to find offline fallback across all caches without depending on Workbox
          const match = await caches.match('/offline', { ignoreSearch: true })
          if (match) return match as Response
          return new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' }, status: 200 })
        }})())
    }
  })

  // ------------------------ INDEXEDDB HELPERS ------------------------
  type ProjectRecord = { name: string; files?: File[] }
  interface DBOpAdd { action: 'add'; payload: ProjectRecord }
  interface DBOpUpdate { action: 'update'; payload: ProjectRecord }
  interface DBOpDelete { action: 'delete'; payload: { name: string } }
  interface DBOpGet { action: 'get'; payload: { name: string } }
  type DBOperation = DBOpAdd | DBOpUpdate | DBOpDelete | DBOpGet

  function handleDatabaseOperation(op: DBOperation) {
    if (!db) return
    const tx = db.transaction(['projects'], 'readwrite')
    const store = tx.objectStore('projects')
    let request: IDBRequest | undefined
    switch (op.action) {
      case 'add': request = store.add(op.payload); break
      case 'update': request = store.put(op.payload); break
      case 'delete': request = store.delete(op.payload.name); break
      case 'get': request = store.get(op.payload.name); break
    }
    if (request) {
      request.onsuccess = () => log('DB op success', op.action)
      request.onerror = () => error('DB op error', op.action, request!.error)
    }
  }

  async function getFormDataAll(): Promise<StoredFormRecord[]> {
    if (!db) return []
    return new Promise((resolve, reject) => {
      const tx = db!.transaction(['forms'], 'readonly')
      const store = tx.objectStore('forms')
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as StoredFormRecord[]) || [])
      req.onerror = () => reject(req.error)
    })
  }

  async function deleteFormEntries(emails: string[]) {
    if (!db || !emails.length) return
    await Promise.all(emails.map(email => new Promise<void>((resolve) => {
      const tx = db!.transaction(['forms'], 'readwrite')
      const store = tx.objectStore('forms')
      const delReq = store.delete(email)
      delReq.onsuccess = () => resolve()
      delReq.onerror = () => resolve() // ignore individual failures
    })))
  }

  async function syncAuthentication(clients: readonly Client[]) {
    try {
  const formData = await getFormDataAll()
  if (!formData.length) return
  const response = await sendDataToServer(formData)
      if (!response.ok) throw new Error('Sync failed')
  // Cleanup after confirmed success
  await deleteFormEntries(formData.map(f => f.email))
  clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FORM_SYNCED, data: { message: `Form data synced (${formData.length} records).` } }))
    } catch (err) {
  error('syncAuthentication error', err)
      clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FORM_SYNC_ERROR, data: { message: 'Form sync failed.' } }))
    }
  }

  async function syncContent() {
    log('periodic content sync placeholder')
  }

  // removeLocalData intentionally omitted (unused)

  async function sendDataToServer(data: unknown) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const formData = new FormData()
      formData.append('data', JSON.stringify(data))
      const resp = await fetch('/api/auth', { method: 'POST', body: formData, signal: controller.signal })
      return resp
    } finally {
      clearTimeout(timeout)
    }
  }

  async function uploadChunk({ chunk, index, totalChunks, fileIdentifier, uploadUrl }: { chunk: Blob; index: number; totalChunks: number; fileIdentifier: string; uploadUrl: string }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    const formData = new FormData()
    formData.append('file', chunk)
    formData.append('index', String(index))
    formData.append('totalChunks', String(totalChunks))
    formData.append('identifier', fileIdentifier)
    try {
      const response = await fetch(uploadUrl, { method: 'POST', body: formData, signal: controller.signal })
      if (!response.ok) throw new Error('Upload failed')
    } finally {
      clearTimeout(timeout)
    }
  }

  async function uploadFile(file: File, uploadUrl: string, retryDelays: number[]) {
    const chunkSize = calculateChunkSize(file.size)
    const totalChunks = Math.ceil(file.size / chunkSize)
    const fileIdentifier = `${file.name}-${Date.now()}`
    const promises: Promise<void>[] = []
    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize)
      promises.push((async () => {
        for (let attempt = 0; attempt < retryDelays.length; attempt++) {
          try {
            await uploadChunk({ chunk, index: i, totalChunks, fileIdentifier, uploadUrl })
            const clients = await swSelf.clients.matchAll({ type: 'window' })
              ;(clients || []).forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.PROGRESS, data: { identifier: fileIdentifier, index: i, totalChunks } }))
            break
          } catch (err) {
            if (attempt === retryDelays.length - 1) throw err
            await new Promise(r => setTimeout(r, retryDelays[attempt]))
          }
        }
      })())
    }
    try {
      await Promise.all(promises)
  const clients = await swSelf.clients.matchAll({ type: 'window' })
  clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FILE_COMPLETE, data: { identifier: fileIdentifier, message: `${file.name} upload complete` } }))
    } catch (err) {
  const clients = await swSelf.clients.matchAll({ type: 'window' })
  clients.forEach(c => c.postMessage({ type: 'error', data: { message: `Failed to upload ${file.name}`, identifier: fileIdentifier } }))
      throw err
    }
  }

  async function handleConcurrentUploads(name: string, files: File[], uploadUrl: string) {
    const retryDelays = [5000, 10000, 15000]
    const maxConcurrent = 4
    const active: Promise<void>[] = []
    for (const f of files) {
      if (active.length >= maxConcurrent) await Promise.race(active)
      const p = uploadFile(f, uploadUrl, retryDelays).finally(() => {
        const idx = active.indexOf(p); if (idx >= 0) active.splice(idx, 1)
      })
      active.push(p)
    }
    await Promise.all(active)
  const clients = await swSelf.clients.matchAll({ type: 'window' })
  clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.ALL_FILES_COMPLETE, data: { message: 'All uploads complete.' } }))
  }

  // ---------------------------------------------------------------------------
})()
