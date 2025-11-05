/// <reference lib="WebWorker" />
// TypeScript source of the service worker. Built to public/sw.js before Workbox injectManifest runs.
// KEEP exactly one occurrence of self.__WB_MANIFEST.

// // Import centralized constants
import {
  SW_MESSAGE_TYPES,
  PREWARM_PATHS,
  SW_CONFIG,
  DB_CONFIG,
  CACHE_NAMES,
  CACHE_CONFIG as _CACHE_CONFIG,
  AUTH_STUBS,
  SYNC_TAGS,
} from '../app/utils/constants/pwa'

// // Import shared IndexedDB helpers
import { openFormsDB, getAllRecords, deleteRecord } from '../app/utils/idb'
import { FormSyncType } from '../shared/types/offline'

// Augment the global self type safely

// Bundle Workbox modules directly to avoid cross-origin importScripts and COEP/CORP issues.
// These are ESM imports that esbuild will bundle into the final IIFE output.
// In production, Workbox manifest will be injected by scripts/inject-sw.cjs.
// In dev, __WB_MANIFEST will be undefined; we guard for that below.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import type { RouteHandlerCallbackOptions } from 'workbox-core/types'

// No global augmentation required; we'll cast when reading __WB_MANIFEST.

// Wrap logic but avoid nested ambiguous closures for TS parser
(() => {
    // Use centralized SW version
    const SW_VERSION = SW_CONFIG.VERSION
    // Use centralized prewarm paths
    // Toggleable debug flag (can be overridden via postMessage later if desired)
    let DEBUG = false // Default off; can be toggled via postMessage.
    const log = (...args: unknown[]) => { if (DEBUG) console.log('[SW]', ...args) }
    const warn = (...args: unknown[]) => { if (DEBUG) console.warn('[SW]', ...args) }
    const error = (...args: unknown[]) => console.error('[SW]', ...args) // errors always logged
    log('Loading TS source', SW_VERSION, self.location.href)

    // Allow runtime enabling of DEBUG via query param when registering or via message
    try { if (new URL(self.location.href).searchParams.get('swDebug') === '1') DEBUG = true } catch { /* ignore */ }

    // ---------------------------------------------------------------------------
    // Enhanced SW Features:
    //  - Push Notifications
    //  - Notification Click Handling
    //  - Background Sync (form sync)
    //  - Periodic Sync (if available)
    //  - IndexedDB form storage via shared helper
    //  - Offline navigation fallback
    // ---------------------------------------------------------------------------

    // -------------------------- TYPE DEFINITIONS --------------------------
    interface FormSyncedMessage { type: typeof SW_MESSAGE_TYPE.FORM_SYNCED; data: { message: string } }
    interface FormSyncErrorMessage { type: typeof SW_MESSAGE_TYPE.FORM_SYNC_ERROR; data: { message: string } }
    interface SyncFormNoticeMessage { type: typeof SW_MESSAGE_TYPE.SYNC_FORM; data: { message: string } }
    type FormSyncLifecycleMessage = FormSyncedMessage | FormSyncErrorMessage | SyncFormNoticeMessage

    type _OutgoingSWMessage =
        | FormSyncLifecycleMessage
        | { type: 'SW_ACTIVATED'; version: string }
        | { type: 'SW_UPDATE_AVAILABLE'; version: string }
        | { type: 'SW_CONTROL_CLAIMED' }
        | { type: 'NOTIFICATION_CLICK_NAVIGATE'; url: string }
        | { type: 'error'; data: { message: string; identifier?: string } }

    interface TestNotificationClickMessage { type: 'TEST_NOTIFICATION_CLICK'; data?: { url?: string } }
    interface SkipWaitingMessage { type: 'SKIP_WAITING' }
    interface ClaimControlMessage { type: 'CLAIM_CONTROL' }
    interface ToggleDebugMessage { type: 'SET_DEBUG'; value: boolean }
    type IncomingSWMessage = TestNotificationClickMessage | SkipWaitingMessage | ClaimControlMessage | ToggleDebugMessage

    // Data types stored in forms object store
    interface StoredFormRecord {
        id: string
        type: FormSyncType
        payload: unknown
        createdAt: number
    }

    // Message types constant - use centralized constants
    const SW_MESSAGE_TYPE = SW_MESSAGE_TYPES

    // IndexedDB handles - using shared helper for consistency
    // All IndexedDB operations now use shared/idb.ts for non-destructive schema management
    let db: IDBDatabase | null = null
    let dbInitAttempts = 0
    const MAX_DB_INIT_ATTEMPTS = 3

    async function ensureDB(): Promise<IDBDatabase | null> {
        if (db) return db
        
        if (dbInitAttempts >= MAX_DB_INIT_ATTEMPTS) {
            error('IndexedDB initialization failed after max attempts')
            return null
        }
        
        try {
            dbInitAttempts++
            db = await openFormsDB()
            log('IndexedDB initialized successfully')
            dbInitAttempts = 0 // Reset on success
            return db
        } catch (e) {
            error(`Failed to initialize IndexedDB (attempt ${dbInitAttempts}/${MAX_DB_INIT_ATTEMPTS}):`, e)
            
            // Notify user on final failure
            if (dbInitAttempts >= MAX_DB_INIT_ATTEMPTS) {
                await notifyClientsOfDBFailure()
            }
            
            return null
        }
    }

    async function notifyClientsOfDBFailure() {
        const clients = await swSelf.clients.matchAll({ type: 'window' })
        clients.forEach(client => {
            client.postMessage({
                type: 'error',
                data: {
                    message: 'Offline storage unavailable. Data may not be saved.',
                    identifier: 'idb-init-failed'
                }
            })
        })
    }

    // Workbox setup using bundled modules -------------------------------------------------

    // Precache injection placeholder - CRITICAL: Must use exact format for Workbox injection
    // TypeScript safe access with fallback for development
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest = (self as any).__WB_MANIFEST || []
    precacheAndRoute(manifest, { ignoreURLParametersMatching: [/^utm_/, /^fbclid$/] })
    cleanupOutdatedCaches()

    // Navigation handling: For SSR/dev, skip createHandlerBoundToURL which expects a precached URL.
    // Our fetch handler below provides an offline fallback for navigations.

    // Simple runtime caching strategies - using centralized constants
    // 1. Images - CacheFirst (includes AppImages directory)
    registerRoute(
        ({ request: _request, url }: { request: Request; url: URL }) =>
            url.origin === self.location.origin &&
            (/\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/.test(url.pathname) ||
             url.pathname.startsWith('/AppImages/')),
        new CacheFirst({
            cacheName: CACHE_NAMES.IMAGES,
            plugins: [new ExpirationPlugin({ 
                maxEntries: _CACHE_CONFIG.IMAGES.MAX_ENTRIES, 
                maxAgeSeconds: _CACHE_CONFIG.IMAGES.MAX_AGE_SECONDS 
            })]
        })
    )

    // 2. Hashed build assets (JS/CSS) - CacheFirst with safe offline fallback for unknown chunks
    const assetsStrategy = new CacheFirst({
        cacheName: CACHE_NAMES.ASSETS,
        plugins: [new ExpirationPlugin({ 
            maxEntries: _CACHE_CONFIG.ASSETS.MAX_ENTRIES, 
            maxAgeSeconds: _CACHE_CONFIG.ASSETS.MAX_AGE_SECONDS 
        })]
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
        new StaleWhileRevalidate({ cacheName: CACHE_NAMES.STATIC })
    )

    // 4. Auth API group — network-first GET, stub per path, cache 200 JSON
    // Use centralized auth stubs from constants

    registerRoute(
        ({ url, request }: { url: URL; request: Request }) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith('/api/auth/') &&
            request.method === 'GET',
        async ({ request }: RouteHandlerCallbackOptions) => {
            const url = new URL(request.url)
            const cacheName = CACHE_NAMES.API_AUTH
            const cache = await caches.open(cacheName)
            try {
                const resp = await fetch(request)
                // Only cache successful JSON responses
                const isJson = resp.headers.get('content-type')?.includes('application/json')
                if (resp.ok && isJson) {
                    try { await cache.put(request, resp.clone()) } catch { /* ignore quota/errors */ }
                }
                return resp
            } catch {
                // offline/network fail: return cached if present
                const cached = await cache.match(request)
                if (cached) return cached
                // otherwise a path-specific stub (only for known GET endpoints)
                if (url.pathname in AUTH_STUBS) {
                    return new Response(JSON.stringify(AUTH_STUBS[url.pathname as keyof typeof AUTH_STUBS]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                    })
                }
                // for unknown auth GET endpoints, signal temporary unavailability
                return new Response('', { status: 503, headers: { 'Cache-Control': 'no-store' } })
            }
        }
    )



     // 2. Folders API GET — network-first with cache fallback
    registerRoute(
        ({ url, request }: { url: URL; request: Request }) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith('/api/folders') &&
            request.method === 'GET',
       async ({ request }: RouteHandlerCallbackOptions) => {

            const cacheName = CACHE_NAMES.API_FOLDERS
            const cache = await caches.open(cacheName)
            try {
                const resp = await fetch(request)
                // Only cache successful JSON responses
                const isJson = resp.headers.get('content-type')?.includes('application/json')
                if (resp.ok && isJson) {
                    try {
                        await cache.put(request, resp.clone())
                        log('Cached folders response:', request.url)
                    } catch { /* ignore quota/errors */ }
                }
                return resp
            } catch {
                // offline/network fail: return cached if present
                log('Folders API network failed, checking cache:', request.url)
                const cached = await cache.match(request)
                if (cached) {
                    log('Serving cached folders:', request.url)
                    return cached
                }
                
                // No cache available - provide graceful fallback based on endpoint
                const url = new URL(request.url)
                if (url.pathname === '/api/folders/count') {
                    // Return count fallback
                    return new Response(JSON.stringify({ success: true, data: { count: 0 } }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                    })
                } else {
                    // Return empty array for list endpoints
                    return new Response(JSON.stringify({ success: true, data: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                    })
                }
            }
        }
    )

    // 3. Notes API GET — network-first with cache fallback
    registerRoute(
        ({ url, request }: { url: URL; request: Request }) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith('/api/notes') &&
            request.method === 'GET',
        async ({ request }: RouteHandlerCallbackOptions) => {

            const cacheName = CACHE_NAMES.API_NOTES
            const cache = await caches.open(cacheName)
            try {
                const resp = await fetch(request)
                // Only cache successful JSON responses
                const isJson = resp.headers.get('content-type')?.includes('application/json')
                if (resp.ok && isJson) {
                    try {
                        await cache.put(request, resp.clone())
                        log('Cached notes response:', request.url)
                    } catch { /* ignore quota/errors */ }
                }
                return resp
            } catch {
                // offline/network fail: return cached if present
                const cached = await cache.match(request)
                if (cached) {
                    log('Serving cached notes:', request.url)
                    return cached
                }
                // No cache available - return empty array for graceful degradation
                return new Response(JSON.stringify({ success: true, data: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
                })
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
            const re = /\/(?:_nuxt|_assets)\/[A-Za-z0-9._/-]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico)/g
            let m: RegExpExecArray | null
            while ((m = re.exec(html))) urls.add(m[0])
            return Array.from(urls)
        } catch { return [] }
    }

    // Prewarm helper: proactively fetch and cache important pages after activation, and their dependent assets
    async function prewarmPages(paths: string[]) {
        try {
            const pageCache = await caches.open(CACHE_NAMES.PAGES)
            const assetCache = await caches.open(CACHE_NAMES.ASSETS)
            const staticCache = await caches.open(CACHE_NAMES.STATIC)

            // Always consider these tiny static files to avoid noisy logs
            const staticWarm = [
                '/manifest.webmanifest',
                '/favicon.ico',
                '/AppImages/ios/180.png',  // Primary iOS icon
                '/AppImages/android/android-launchericon-192-192.png', // Primary Android icon
                '/AppImages/android/android-launchericon-512-512.png'  // Maskable icon
            ]
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
            try { await prewarmPages([...PREWARM_PATHS]) } catch { /* ignore */ }
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
        // if (type === 'uploadFiles') {
        //     const payload = data as UploadFilesMessage
        //     // broadcast start back to originating client (ExtendableMessageEvent.source is Client | ServiceWorker | MessagePort)
        //     const source = event.source
        //     if (source && 'id' in source) {
        //         swSelf.clients.get((source as Client).id)
        //             .then(client => {
        //                 client?.postMessage({ type: SW_MESSAGE_TYPE.UPLOAD_START, data: { message: 'Upload started' } })
        //             })
        //     }
        //     handleDatabaseOperation({ action: 'add', payload: { name: payload.name, files: payload.files } })
        //     const ext = event as ExtendableEvent
        //     ext.waitUntil(handleConcurrentUploads(payload.name, payload.files || [], payload.uploadUrl))
        //     return
        // }
        if (type === 'SET_DEBUG') {
            DEBUG = !!(data as ToggleDebugMessage).value
            log('Debug mode set to', DEBUG)
            return
        }
    })

    // --------------------- PUSH NOTIFICATIONS ---------------------
    swSelf.addEventListener('push', (event: PushEvent) => {
        console.log('[SW] 🔔 Push event received:', event);
        console.log('[SW] Push event data exists:', !!event.data);
        console.log('[SW] Notification permission:', Notification.permission);

        event.waitUntil((async () => {
            try {
                if (!event.data) {
                    console.log('[SW] ⚠️ No data in push event - showing fallback notification');
                    await swSelf.registration.showNotification('Card Review', {
                        body: 'You have cards to review!',
                        icon: '/icons/192x192.png',
                        badge: '/icons/96x96.png',
                        tag: 'card-review-fallback',
                        requireInteraction: true,
                        data: { url: '/review', timestamp: Date.now() }
                    });
                    console.log('[SW] ✅ Fallback notification shown');
                    return;
                }

                let data: Partial<{ title: string; message: string; icon: string; tag: string; requireInteraction: boolean; silent: boolean; url: string; data: Record<string, unknown> }>;

                try {
                    const rawData = event.data.text();
                    console.log('[SW] Raw push data (text):', rawData);
                    data = JSON.parse(rawData);
                    console.log('[SW] Parsed push data:', data);
                } catch (parseError) {
                    console.error('[SW] ❌ Failed to parse push data:', parseError);
                    // Try as JSON directly
                    try {
                        data = event.data.json();
                        console.log('[SW] Parsed as JSON directly:', data);
                    } catch {
                        console.log('[SW] Using fallback data structure');
                        data = { title: 'Card Review', message: 'You have cards to review!' };
                    }
                }

                const title = data.title || 'Card Review';
                const options = {
                    body: data.message || 'You have cards to review!',
                    icon: data.icon || '/icons/192x192.png',
                    badge: '/icons/96x96.png',
                    tag: data.tag || 'card-review',
                    requireInteraction: false, // Changed: macOS might not show persistent notifications in notification center
                    silent: false, // Never silent for debugging
                    data: {
                        url: data.url || '/review',
                        timestamp: Date.now(),
                        originalData: data,
                        ...(data.data || {})
                    },
                    // Add interactive actions (not in base NotificationOptions type but supported by browsers)
                    actions: [
                        {
                            action: 'review',
                            title: '📚 Review Now'
                        },
                        {
                            action: 'snooze',
                            title: '⏰ Snooze 1hr'
                        },
                        {
                            action: 'dismiss',
                            title: '❌ Dismiss'
                        }
                    ]
                } as NotificationOptions & { actions?: Array<{ action: string; title: string }> };

                console.log('[SW] 📢 Showing notification:', title);
                console.log('[SW] Notification options:', options);

                await swSelf.registration.showNotification(title, options);
                console.log('[SW] ✅ Notification shown successfully!');

                // Verify notification was created
                const notifications = await swSelf.registration.getNotifications();
                console.log('[SW] Current notifications count:', notifications.length);
                console.log('[SW] Current notifications:', notifications.map(n => ({ title: n.title, tag: n.tag })));

            } catch (err) {
                console.error('[SW] ❌ Push handler error:', err);
                console.log('[SW] Registration state:', swSelf.registration?.active?.state);
                console.log('[SW] Registration scope:', swSelf.registration?.scope);

                // Emergency fallback
                try {
                    await swSelf.registration.showNotification('CleverAI - Error Fallback', {
                        body: 'Notification received but failed to process properly',
                        icon: '/icons/192x192.png',
                        tag: 'error-fallback',
                        requireInteraction: true,
                        data: { url: '/review', timestamp: Date.now() }
                    });
                    console.log('[SW] ✅ Emergency fallback notification shown');
                } catch (fallbackError) {
                    console.error('[SW] ❌ Emergency fallback also failed:', fallbackError);
                }
            }
        })())
    })

    swSelf.addEventListener('notificationclick', (event: NotificationEvent) => {
        const action = event.action
        const ndata = event.notification.data as { url?: string } | undefined
        
        console.log('[SW] 🖱️ Notification clicked:', { action, data: ndata })
        
        event.notification.close()
        
        event.waitUntil((async () => {
            // Handle snooze action
            if (action === 'snooze') {
                console.log('[SW] ⏰ Snooze action triggered')
                try {
                    // Send snooze request to server
                    await fetch('/api/notifications/snooze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            duration: 3600, // 1 hour in seconds
                            timestamp: Date.now()
                        })
                    })
                    console.log('[SW] ✅ Snoozed for 1 hour')
                } catch (error) {
                    console.error('[SW] ❌ Snooze failed:', error)
                }
                return
            }
            
            // Handle dismiss action
            if (action === 'dismiss') {
                console.log('[SW] ❌ Dismiss action triggered - notification closed')
                // Just close, no further action
                return
            }
            
            // Handle review action or default click (no action specified)
            const targetUrl = (ndata?.url) || '/'
            console.log('[SW] 🔗 Navigating to:', targetUrl)
            
            const clients = await swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true })
            if (clients.length) {
                // Focus existing window and navigate
                for (const c of clients) {
                    c.postMessage({ type: 'NOTIFICATION_CLICK_NAVIGATE', url: targetUrl })
                }
                try {
                    await (clients[0] as WindowClient).focus()
                    console.log('[SW] ✅ Focused existing window')
                } catch (focusError) {
                    console.warn('[SW] ⚠️ Could not focus window:', focusError)
                }
                return
            }
            
            // No existing window, open new one
            try {
                await swSelf.clients.openWindow(targetUrl)
                console.log('[SW] ✅ Opened new window')
            } catch (openError) {
                console.error('[SW] ❌ Could not open window:', openError)
            }
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
        
        if (syncEvt.tag === SYNC_TAGS.FORM) {
            syncEvt.waitUntil((async () => {
                try {
                    // Ensure DB is available before syncing
                    const database = await ensureDB()
                    if (!database) {
                        warn('IndexedDB unavailable, cannot sync forms')
                        await notifyClientsOfDBFailure()
                        return
                    }

                    const clients = await swSelf.clients.matchAll({ type: 'window' })
                    clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.SYNC_FORM, data: { message: 'Syncing data..' } }))
                    
                    const records = await getAllRecords<StoredFormRecord>(database, 'forms')
                    if (records.length === 0) {
                        log('No forms to sync')
                        return
                    }
                    
                    // Process sync with records
                    await syncForms(clients, records)  // TODO: implement actual sync logic

                } catch (err) {
                    error('Background sync failed:', err)
                    const clients = await swSelf.clients.matchAll({ type: 'window' })
                    clients.forEach(client => {
                        client.postMessage({
                            type: SW_MESSAGE_TYPE.FORM_SYNC_ERROR,
                            data: { message: 'Failed to sync offline data' }
                        })
                    })
                }
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
                            const cache = await caches.open(CACHE_NAMES.PAGES)
                            await cache.put(req, response.clone())
                            log('Cached page successfully:', req.url)
                            // Opportunistically cache assets referenced by this HTML (to reduce offline chunk misses)
                            try {
                                const html = await response.clone().text()
                                const assetUrls = extractAssetUrls(html)
                                if (assetUrls.length) {
                                    const assetCache = await caches.open(CACHE_NAMES.ASSETS)
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
                                const MAX_ENTRIES = _CACHE_CONFIG.PAGES.MAX_ENTRIES
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
                        const cache = await caches.open(CACHE_NAMES.PAGES)
                        const cacheKeys = await cache.keys()
                        log('Pages cache contains:', cacheKeys.map(r => r.url))
                    }

                    // Look specifically in the 'pages' cache first
                    const cache = await caches.open(CACHE_NAMES.PAGES)
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


    // ------------------------ INDEXEDDB HELPERS ------------------------
    // Using shared IDB helpers for consistency

    async function getFormDataAll(store: string): Promise<StoredFormRecord[]> {
        try {
            const db = await openFormsDB()
            const records = await getAllRecords<StoredFormRecord>(db, store)
            db.close()
            return records
        } catch (err) {
            error('Failed to get form data:', err)
            return []
        }
    }

    async function deleteFormEntries(ids: string[], store: string) {
        if (!ids.length) return
        try {
            const db = await openFormsDB()
            await Promise.all(ids.map(id => deleteRecord(db, store, id)))
            db.close()
        } catch (err) {
            error('Failed to delete form entries:', err)
        }
    }

    async function syncForms(clients: readonly Client[]) {
        try {
            const formData = await getFormDataAll('forms')
            if (!formData.length) return
            const response = await sendDataToServer(formData)
            if (!response.ok) throw new Error('Sync failed')
            // Cleanup after confirmed success
            await deleteFormEntries(formData.map(f => f.id), DB_CONFIG.STORES.FORMS)
            clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FORM_SYNCED, data: { message: `Form data synced (${formData.length} records).` } }))
        } catch (err) {
            error('syncForms error', err)
            clients.forEach(c => c.postMessage({ type: SW_MESSAGE_TYPE.FORM_SYNC_ERROR, data: { message: 'Form sync failed.' } }))
        }
    }

    async function syncContent() {
        log('periodic content sync placeholder')
    }

    // removeLocalData intentionally omitted (unused)

    async function sendDataToServer(data: StoredFormRecord[]): Promise<Response> {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 20000)
        try {

            const resp = await fetch('/api/form-sync', { method: 'POST', body: JSON.stringify(data), signal: controller.signal })
            return resp
        } finally {
            clearTimeout(timeout)
        }
    }


    //----------------------------------------------------------------
})()
