/// <reference lib="WebWorker" />
// TypeScript source of the service worker. Built to public/sw.js before Workbox injectManifest runs.
// KEEP exactly one occurrence of self.__WB_MANIFEST.

// Augment the global self type safely

// Bundle Workbox modules directly to avoid cross-origin importScripts and COEP/CORP issues.
// These are ESM imports that esbuild will bundle into the final IIFE output.
// In production, Workbox manifest will be injected by scripts/inject-sw.cjs.
// In dev, __WB_MANIFEST will be undefined; we guard for that below.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// No global augmentation required; we'll cast when reading __WB_MANIFEST.

// Wrap logic but avoid nested ambiguous closures for TS parser
(() => {
    const SW_VERSION = 'v1.8.0-enhanced'
    const PREWARM_PATHS = ['/', '/about']
    // Toggleable debug flag (can be overridden via postMessage later if desired)
    let DEBUG = false // Default off; can be toggled via postMessage.
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
        id: string
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

    // --- Exponential backoff helpers for chunked uploads ---
    function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
    function backoffDelay(baseMs: number, attempt: number) {
        const exp = baseMs * Math.pow(2, attempt)
        const jitter = Math.random() * exp * 0.4 // up to +40% jitter
        return Math.floor(exp + jitter)
    }

    // IndexedDB handles
    let db: IDBDatabase | null = null
    const DB_NAME = 'recwide_db'
    const DB_VERSION = 2

    function openDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)
            request.onupgradeneeded = (event) => {
                const target = event.target as IDBOpenDBRequest
                const upgradeDb = target.result
                const tx = (target.transaction as IDBTransaction)

                // Ensure 'projects' store exists
                if (!upgradeDb.objectStoreNames.contains('projects')) {
                    const projects = upgradeDb.createObjectStore('projects', { keyPath: 'name' })
                    projects.createIndex('name', 'name', { unique: false })
                }

                // Handle 'forms' store migration to keyPath: 'id'
                const hasForms = upgradeDb.objectStoreNames.contains('forms')
                if (!hasForms) {
                    const forms = upgradeDb.createObjectStore('forms', { keyPath: 'id' })
                    forms.createIndex('email', 'email', { unique: false })
                    return
                }

                // If 'forms' exists, check its keyPath and migrate if needed
                const oldStore = tx.objectStore('forms')
                // Detect keyPath (some browsers expose via oldStore.keyPath)
                const oldKeyPath = (oldStore as unknown as { keyPath?: string | string[] }).keyPath

                if (oldKeyPath === 'id') {
                    // Already on new schema; ensure index exists
                    try {
                        oldStore.createIndex('email', 'email', { unique: false })
                    } catch { /* index may already exist */ }
                    return
                }

                // Collect existing records, then drop & recreate store with new schema
                const allReq = oldStore.getAll()
                allReq.onsuccess = () => {
                    const oldRecords = (allReq.result || []) as Array<Partial<StoredFormRecord> & { email?: string; createdAt?: number; payload?: unknown; id?: string }>
                    try { upgradeDb.deleteObjectStore('forms') } catch { /* ignore */ }
                    const newForms = upgradeDb.createObjectStore('forms', { keyPath: 'id' })
                    newForms.createIndex('email', 'email', { unique: false })

                    // Reinsert with generated ids if missing
                    const reinserts = oldRecords.map((rec) => {
                        const id = rec.id || `${rec.email || 'unknown'}-${rec.createdAt || Date.now()}`
                        const toPut: StoredFormRecord = {
                            id,
                            email: (rec.email as string) || 'unknown',
                            payload: rec.payload as unknown,
                            createdAt: (rec.createdAt as number) || Date.now(),
                        }
                        const putReq = (tx.objectStore('forms') as IDBObjectStore).add(toPut)
                        putReq.onerror = () => { /* best effort */ }
                        return putReq
                    })

                    // No need to wait for completion here; upgrade transaction will commit if no exceptions are thrown
                }
                allReq.onerror = () => {
                    // If we can't read old data, proceed by recreating the store empty
                    try { upgradeDb.deleteObjectStore('forms') } catch { /* ignore */ }
                    const newForms = upgradeDb.createObjectStore('forms', { keyPath: 'id' })
                    newForms.createIndex('email', 'email', { unique: false })
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

    // Precache injection placeholder - CRITICAL: Must use exact format for Workbox injection
    // TypeScript safe access with fallback for development
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest = (self as any).__WB_MANIFEST || []
    precacheAndRoute(manifest, { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] })
    cleanupOutdatedCaches()

    // Navigation handling: For SSR/dev, skip createHandlerBoundToURL which expects a precached URL.
    // Our fetch handler below provides an offline fallback for navigations.

    // Simple runtime caching strategies - essential assets only
    // 1. Images - CacheFirst
    registerRoute(
        ({ request, url }: { request: Request; url: URL }) =>
            url.origin === self.location.origin &&
            /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/.test(url.pathname),
        new CacheFirst({
            cacheName: 'images',
            plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })]
        })
    )

    // 2. Hashed build assets (JS/CSS) - CacheFirst with safe offline fallback for unknown chunks
    const assetsStrategy = new CacheFirst({
        cacheName: 'assets',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })]
    })
    registerRoute(
        ({ url, request }: { url: URL; request: Request }) =>
            url.origin === self.location.origin &&
            (
                url.pathname.startsWith('/_nuxt/') ||
                request.destination === 'script' ||
                request.destination === 'style'
            ),
        async ({ event, request }) => {
            try {
                // Normal cache-first handling
                // @ts-ignore - Workbox Strategy types
                return await assetsStrategy.handle({ event, request })
            } catch (err) {
                // When offline and a lazy JS chunk was never seen before, dynamic import fails hard.
                // Return a minimal, valid JS module to avoid a white-screen crash.
                // The app may still lack the feature, but it keeps running.
                const req = request as Request
                const isJsChunk = req.destination === 'script' && new URL(req.url).pathname.startsWith('/_nuxt/')
                if (isJsChunk) {
                    return new Response(
                        '/* offline stub chunk */\n' +
                        'export default {};\n' +
                        'export const __offline__ = true;\n',
                        { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }, status: 200 }
                    )
                }
                throw err
            }
        }
    )

    // 3. App manifest & favicon - SWR so they stay fresh when online
    registerRoute(
        ({ url }: { url: URL }) =>
            url.origin === self.location.origin && (
                url.pathname === '/manifest.webmanifest' ||
                url.pathname === '/favicon.ico'
            ),
        new StaleWhileRevalidate({ cacheName: 'static' })
    )

    // 4. Auth API group — network-first GET, stub per path, cache 200 JSON
    const AUTH_STUBS: Record<string, any> = {
        '/api/auth/session': { user: null, expires: null },
        '/api/auth/csrf': { csrfToken: null },
        '/api/auth/providers': {},
    }

    registerRoute(
        ({ url, request }: { url: URL; request: Request }) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith('/api/auth/') &&
            request.method === 'GET',
        async ({ event }: any) => {
            const req = event.request as Request
            const url = new URL(req.url)
            const cacheName = 'api-auth'
            const cache = await caches.open(cacheName)
            try {
                const resp = await fetch(req)
                // Only cache successful JSON responses
                const isJson = resp.headers.get('content-type')?.includes('application/json')
                if (resp.ok && isJson) {
                    try { await cache.put(req, resp.clone()) } catch { /* ignore quota/errors */ }
                }
                return resp
            } catch {
                // offline/network fail: return cached if present
                const cached = await cache.match(req)
                if (cached) return cached
                // otherwise a path-specific stub (only for known GET endpoints)
                if (url.pathname in AUTH_STUBS) {
                    return new Response(JSON.stringify(AUTH_STUBS[url.pathname]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                    })
                }
                // for unknown auth GET endpoints, signal temporary unavailability
                return new Response('', { status: 503, headers: { 'Cache-Control': 'no-store' } })
            }
        }
    )

    // NOTE: Navigation requests are handled by our custom fetch listener below
    // This avoids Workbox "no-response" errors and gives us full control over offline behavior

    // Helper to extract asset URLs from HTML string (nuxt hashed chunks, CSS, images referenced)
    function extractAssetUrls(html: string): string[] {
        try {
            const urls = new Set<string>()
            // Basic matches for Nuxt hashed chunks and CSS referenced in HTML
            const re = /\/(?:_nuxt|_assets)\/[A-Za-z0-9._\-\/]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico)/g
            let m: RegExpExecArray | null
            while ((m = re.exec(html))) urls.add(m[0])
            return Array.from(urls)
        } catch { return [] }
    }

    // Prewarm helper: proactively fetch and cache important pages after activation, and their dependent assets
    async function prewarmPages(paths: string[]) {
        try {
            const pageCache = await caches.open('pages')
            const assetCache = await caches.open('assets')
            const staticCache = await caches.open('static')

            // Always consider these tiny static files to avoid noisy logs
            const staticWarm = ['/manifest.webmanifest', '/favicon.ico']
            for (const s of staticWarm) {
                try {
                    const r = await fetch(s, { cache: 'no-store' })
                    if (r && r.ok) await staticCache.put(new Request(s), r.clone())
                } catch { /* ignore */ }
            }

            for (const path of paths) {
                try {
                    // Fetch fresh HTML and cache it
                    const resp = await fetch(path, { cache: 'no-store' })
                    if (resp && resp.ok) {
                        await pageCache.put(new Request(path), resp.clone())
                        log('Prewarmed page:', path)

                        // Try to parse HTML to discover dependent assets and cache them too
                        let text = ''
                        try { text = await resp.clone().text() } catch { /* ignore */ }
                        if (text) {
                            const assetUrls = extractAssetUrls(text)
                            for (const u of assetUrls) {
                                try {
                                    const r = await fetch(u, { cache: 'no-store' })
                                    if (r && r.ok) await assetCache.put(new Request(u), r.clone())
                                } catch { /* best effort */ }
                            }
                            if (assetUrls.length) log('Prewarmed assets for', path, assetUrls.length)
                        }
                    } else {
                        warn('Prewarm skipped (non-200):', path, resp?.status)
                    }
                } catch (e) {
                    // Don’t fail activation if a route can’t be fetched (offline build previews, etc.)
                    warn('Prewarm failed:', path, e)
                }
            }
        } catch (e) {
            warn('Prewarm pages error', e)
        }
    }

    // ---------------------- LIFECYCLE EVENTS ----------------------
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
            // Pre-warm critical shell pages so they work offline immediately
            try { await prewarmPages(PREWARM_PATHS) } catch { /* ignore */ }
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
        setTimeout(() => { notifyIfWaiting().catch(() => { }) }, 1500)
        // Periodic lightweight check (every 30s) – can be disabled if noisy.
        setInterval(() => { notifyIfWaiting().catch(() => { }) }, 30000)
    } catch { /* ignore */ }

    // -------------------- MESSAGE HANDLING --------------------
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
                    try {
                        await (clients[0] as WindowClient).focus()
                    } catch (e) {
                        warn('focus failed', e)
                    }
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
                swSelf.clients.get((source as Client).id)
                    .then(client => {
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

    // --------------------- PUSH NOTIFICATIONS ---------------------
    swSelf.addEventListener('push', (event: PushEvent) => {
        log('push received')
        event.waitUntil((async () => {
            try {
                if (!event.data) return
                const data: Partial<{ title: string; message: string; icon: string; tag: string; requireInteraction: boolean; silent: boolean; url: string; data: Record<string, unknown> }> = (() => {
                    try {
                        return event.data!.json()
                    } catch {
                        return {}
                    }
                })()
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
                try {
                    await swSelf.registration.showNotification('CleverAI Notification', { body: 'You have a new notification', icon: '/icons/192x192.png', tag: 'fallback' })
                } catch { /* ignore */ }
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
                try {
                    await (clients[0] as WindowClient).focus()
                } catch { /* ignore */ }
                return
            }
            try {
                await swSelf.clients.openWindow(targetUrl)
            }
            catch { /* ignore */ }
        })())
    })

    // -------- PERIODIC & BACKGROUND SYNC --------
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

    // ------------------------ FETCH FALLBACK (Only for non-navigation requests) ------------------------
    swSelf.addEventListener('fetch', (event: FetchEvent) => {
        const req = event.request
        const url = new URL(req.url)
        const isDevHost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1' || self.location.hostname.endsWith('.local')

        // Skip development files completely - let them fail naturally
        if (url.pathname.includes('/@fs/') ||
            url.pathname.includes('/node_modules/') ||
            url.pathname.includes('error-dev.vue') ||
            url.pathname.includes('builds/meta/dev.json') ||
            url.pathname.includes('/@vite/') ||
            url.pathname.includes('/@id/') ||
            url.pathname.includes('/__vite_ping') ||
            url.pathname.includes('/nuxt/dist/app/') ||
            url.pathname.includes('sw.js') ||
            (isDevHost && url.searchParams.has('v') && req.mode !== 'navigate') ||
            req.url.includes('?import')) {
            // Let these requests go through normally without SW intervention
            return
        }

        // For navigation requests, handle caching ourselves
        if (req.mode === 'navigate') {
            event.respondWith((async () => {
                try {
                    // Try network first
                    log('Fetching navigation request:', req.url)
                    const response = await fetch(req)

                    // Cache successful responses
                    if (response.ok && response.status === 200) {
                        try {
                            const cache = await caches.open('pages')
                            await cache.put(req, response.clone())
                            log('Cached page successfully:', req.url)
                            // Opportunistically cache assets referenced by this HTML (to reduce offline chunk misses)
                            try {
                                const html = await response.clone().text()
                                const assetUrls = extractAssetUrls(html)
                                if (assetUrls.length) {
                                    const assetCache = await caches.open('assets')
                                    await Promise.all(assetUrls.map(async (u) => {
                                        try {
                                            const r = await fetch(u, { cache: 'no-store' })
                                            if (r && r.ok) await assetCache.put(new Request(u), r.clone())
                                        } catch { /* best effort */ }
                                    }))
                                    log('Opportunistically cached assets from navigation:', assetUrls.length)
                                }
                            } catch { /* ignore parse issues */ }
                            // Simple size-based eviction for the 'pages' cache
                            try {
                                const keys = await cache.keys()
                                const MAX_ENTRIES = 100
                                if (keys.length > MAX_ENTRIES) {
                                    const toDelete = keys.length - MAX_ENTRIES
                                    for (let i = 0; i < toDelete; i++) {
                                        await cache.delete(keys[i])
                                    }
                                }
                            } catch (e) {
                                warn('Pages cache cleanup failed', e)
                            }
                        } catch (cacheError) {
                            warn('Failed to cache page:', cacheError)
                        }
                    }

                    return response
                } catch {
                    // Network failed - check if page is cached
                    log('Network failed for:', req.url)

                    // Debug: List what's in the pages cache
                    if (DEBUG) {
                        const cache = await caches.open('pages')
                        const cacheKeys = await cache.keys()
                        log('Pages cache contains:', cacheKeys.map(r => r.url))
                    }

                    // Look specifically in the 'pages' cache first
                    const cache = await caches.open('pages')
                    let cachedResponse = await cache.match(req, { ignoreSearch: true })

                    if (!cachedResponse) {
                        // Also try with clean URL (no query params)
                        const cleanUrl = new URL(req.url)
                        cleanUrl.search = ''
                        // Do not construct a Request with mode 'navigate' (invalid in RequestInit)
                        cachedResponse = await cache.match(cleanUrl.toString(), { ignoreSearch: true })
                        log('Tried clean URL:', cleanUrl.toString())
                    }

                    if (cachedResponse) {
                        log('Serving cached page:', req.url)
                        return cachedResponse
                    }

                    // Try app-shell fallback so SPA can render the route offline
                    try {
                        const shell = await cache.match('/', { ignoreSearch: true })
                        if (shell) {
                            log('Serving app shell (/) as offline fallback for:', req.url)
                            return shell
                        }
                        const shellHtml = await cache.match('/index.html', { ignoreSearch: true })
                        if (shellHtml) {
                            log('Serving /index.html as offline fallback for:', req.url)
                            return shellHtml
                        }
                    } catch (e) {
                        warn('Shell fallback lookup failed', e)
                    }

                    // No cached page or shell - serve simple offline HTML
                    log('No cached page or shell found, serving offline HTML for:', req.url)
                    return new Response(`
                                <!DOCTYPE html>
                                <html>
                                    <head>
                                        <title>Offline</title>
                                        <style>
                                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                                            .container { max-width: 400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                                            button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 10px; }
                                            button:hover { background: #0056b3; }
                                        </style>
                                    </head>
                                    <body>
                                            <div class="container">
                                            <h1>Offline</h1>
                                            <p>This page isn't available offline yet.</p>
                                            <p>Please check your connection and try again.</p>
                                            <button onclick="window.location.reload()">Try Again</button>
                                            <button onclick="window.location.href='/'">Go Home</button>
                                            </div>
                                    </body>
                                </html>
                        `, {
                        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
                        status: 503
                    })
                }
            })())
        }
    });
    // ------------------------ UPLOAD HANDLING ------------------------


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

    async function deleteFormEntries(ids: string[]) {
        if (!db || !ids.length) return
        await Promise.all(ids.map(id => new Promise<void>((resolve) => {
            const tx = db!.transaction(['forms'], 'readwrite')
            const store = tx.objectStore('forms')
            const delReq = store.delete(id)
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
            await deleteFormEntries(formData.map(f => f.id))
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
            const resp = await fetch('/api/form-sync', { method: 'POST', body: formData, signal: controller.signal })
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
            if (!response.ok) {
                const err: any = new Error('Upload failed')
                err.status = response.status
                const ra = response.headers.get('Retry-After')
                err.retryAfter = ra ? Math.max(0, Math.floor(Number(ra) * 1000)) : undefined
                throw err
            }
        } finally {
            clearTimeout(timeout)
        }
    }

    // Enhanced per-file concurrency and exponential backoff retry logic
    async function uploadFile(file: File, uploadUrl: string, _retryDelays: number[]) {
        const chunkSize = calculateChunkSize(file.size)
        const totalChunks = Math.ceil(file.size / chunkSize)
        // Stable per-file identifier: name + size + firstModified
        const fileIdentifier = `${file.name}-${file.size}-${(file as any).lastModified || 0}`

        const CHUNK_CONCURRENCY = 3
        const BASE_BACKOFF = 1000 // 1s base
        const MAX_ATTEMPTS = 5

        const inFlight: Promise<void>[] = []

        const runChunk = (i: number) => (async () => {
            const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize)
            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                try {
                    await uploadChunk({ chunk, index: i, totalChunks, fileIdentifier, uploadUrl })
                    const clients = await swSelf.clients.matchAll({ type: 'window' })
                        ; (clients || []).forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.PROGRESS, data: { identifier: fileIdentifier, index: i, totalChunks } }))
                    return
                } catch (err) {
                    const e = err as any
                    if (attempt === MAX_ATTEMPTS - 1) throw err
                    const status = e?.status as number | undefined
                    const retryAfter = e?.retryAfter as number | undefined
                    // Honor server Retry-After when provided; otherwise exponential backoff with jitter.
                    const delay = typeof retryAfter === 'number' ? retryAfter : backoffDelay(BASE_BACKOFF, attempt)
                    // For 413/429/503, add extra cushion
                    const cushion = (status === 413 || status === 429 || status === 503) ? Math.floor(delay * 0.5) : 0
                    await sleep(delay + cushion)
                }
            }
        })()

        // Schedule chunks with limited concurrency
        for (let i = 0; i < totalChunks; i++) {
            const p = runChunk(i).finally(() => {
                const idx = inFlight.indexOf(p)
                if (idx >= 0) inFlight.splice(idx, 1)
            })
            inFlight.push(p)
            if (inFlight.length >= CHUNK_CONCURRENCY) await Promise.race(inFlight)
        }

        // Wait for remainder
        await Promise.all(inFlight)

        try {
            const clients = await swSelf.clients.matchAll({ type: 'window' })
            clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FILE_COMPLETE, data: { identifier: fileIdentifier, message: `${file.name} upload complete` } }))
        } catch { /* noop */ }
    }

    async function handleConcurrentUploads(name: string, files: File[], uploadUrl: string) {
        const retryDelays = [5000, 10000, 15000]
        const MAX_FILE_CONCURRENCY = 4
        const active: Promise<void>[] = []
        for (const f of files) {
            if (active.length >= MAX_FILE_CONCURRENCY) await Promise.race(active)
            const p = uploadFile(f, uploadUrl, retryDelays).finally(() => {
                const idx = active.indexOf(p); if (idx >= 0) active.splice(idx, 1)
            })
            active.push(p)
        }
        await Promise.all(active)
        const clients = await swSelf.clients.matchAll({ type: 'window' })
        clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.ALL_FILES_COMPLETE, data: { message: 'All uploads complete.' } }))
    }

    //----------------------------------------------------------------
})()
