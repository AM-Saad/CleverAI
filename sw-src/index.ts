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
  SYNC_TAGS,
} from "../app/utils/constants/pwa";

// // Import shared IndexedDB helpers
import {
  openUnifiedDB,
  acknowledgePendingNoteChange,
  deletePendingNoteGroupChanges,
  deletePendingNoteLayoutChange,
  deleteRecord,
  getRecord,
  loadPendingNoteChanges,
  loadPendingNoteGroupChanges,
  loadPendingNoteLayoutChanges,
  putRecord,
  queueNoteChange,
  queueNoteGroupChange,
  reconcileNoteGroupIds,
  remapPendingNoteGroupIds,
  remapPendingNoteIds,
  saveNoteSyncConflict,
} from "../app/utils/idb";
import {
  applySyncResult as applyOfflineSyncResult,
  claimOfflineMutations,
  getOfflineSession,
  listOfflineMutations,
  remapOfflineIds,
  recoverInterruptedMutations,
  setMutationStatus,
  updateOfflineSyncMetadata,
} from "../app/utils/offline-v2/repository";
import type { OfflineSyncResponse } from "../shared/utils/offline-sync.contract";
import type {
  NotesSyncResponse,
  PendingNoteChange,
  PendingNoteGroupChange,
} from "../shared/utils/note-sync.contract";
import { orderOfflineMutations } from "../shared/utils/offline-mutation-order";
import type {
  IncomingSWMessage,
  OutgoingSWMessage,
} from "../shared/types/sw-messages";

// Augment the global self type safely

// Bundle Workbox modules directly to avoid cross-origin importScripts and COEP/CORP issues.
// These are ESM imports that esbuild will bundle into the final IIFE output.
// In production, Workbox manifest will be injected by scripts/inject-sw.cjs.
// In dev, __WB_MANIFEST will be undefined; we guard for that below.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import type { RouteHandlerCallbackOptions } from "workbox-core/types";

// No global augmentation required; we'll cast when reading __WB_MANIFEST.

// Wrap logic but avoid nested ambiguous closures for TS parser.
(() => {
  // Use centralized SW version
  const SW_VERSION = SW_CONFIG.VERSION;
  // Use centralized prewarm paths
  // Toggleable debug flag (can be overridden via postMessage later if desired)
  let DEBUG = false; // Default off; can be toggled via postMessage.
  let notesSyncInProgress = false;
  const isViteDevelopmentAsset = (url: URL) => {
    const isDevelopmentHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".local");
    if (!isDevelopmentHost || !url.pathname.startsWith("/_nuxt/")) {
      return false;
    }
    return (
      /\.(?:vue|ts|tsx|jsx|scss|sass|less)$/.test(url.pathname) ||
      url.pathname.includes("/@") ||
      url.pathname.startsWith("/_nuxt/assets/") ||
      url.pathname.startsWith("/_nuxt/components/") ||
      url.pathname.startsWith("/_nuxt/composables/") ||
      url.pathname.startsWith("/_nuxt/features/") ||
      url.pathname.startsWith("/_nuxt/layouts/") ||
      url.pathname.startsWith("/_nuxt/pages/") ||
      url.pathname.startsWith("/_nuxt/plugins/") ||
      url.searchParams.has("t") ||
      url.searchParams.has("v")
    );
  };
  const log = (...args: unknown[]) => {
    if (DEBUG) console.log("[SW]", ...args);
  };
  const warn = (...args: unknown[]) => {
    if (DEBUG) console.warn("[SW]", ...args);
  };
  const error = (...args: unknown[]) => console.error("[SW]", ...args); // errors always logged
  log("Loading TS source", SW_VERSION, self.location.href);

  // Allow runtime enabling of DEBUG via query param when registering or via message
  try {
    if (new URL(self.location.href).searchParams.get("swDebug") === "1")
      DEBUG = true;
  } catch {
    /* ignore */
  }

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
  // Redundant inlined message interfaces removed in favor of shared/types/sw-messages

  // Message types constant - use centralized constants directly (alias removed)

  // IndexedDB handles - using shared helper for consistency
  // All IndexedDB operations now use shared/idb.ts for non-destructive schema management
  let db: IDBDatabase | null = null;
  let dbInitAttempts = 0;
  const MAX_DB_INIT_ATTEMPTS = 3;
  async function ensureDB(): Promise<IDBDatabase | null> {
    if (db) return db;

    if (dbInitAttempts >= MAX_DB_INIT_ATTEMPTS) {
      error("IndexedDB initialization failed after max attempts");
      return null;
    }

    try {
      dbInitAttempts++;
      db = await openUnifiedDB();
      log("IndexedDB initialized successfully");
      dbInitAttempts = 0; // Reset on success
      return db;
    } catch (e) {
      error(
        `Failed to initialize IndexedDB (attempt ${dbInitAttempts}/${MAX_DB_INIT_ATTEMPTS}):`,
        e,
      );

      // Notify user on final failure
      if (dbInitAttempts >= MAX_DB_INIT_ATTEMPTS) {
        await notifyClientsOfDBFailure();
      }

      return null;
    }
  }

  async function notifyClientsOfDBFailure() {
    const clients = await swSelf.clients.matchAll({ type: "window" });
    clients.forEach((client) => {
      client.postMessage({
        type: "error",
        data: {
          message: "Offline storage unavailable. Data may not be saved.",
          identifier: "idb-init-failed",
        },
      });
    });
  }

  // Workbox setup using bundled modules -------------------------------------------------

  // Global error handler for unhandled promise rejections (e.g., Workbox IDB failures)
  self.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      // Suppress IndexedDB backing store errors from Workbox - they're logged but not fatal
      if (
        event.reason?.message?.includes("backing store") ||
        event.reason?.message?.includes("indexedDB.open")
      ) {
        error("Workbox IDB error (non-fatal):", event.reason.message);
        event.preventDefault(); // Prevent console spam

        // Notify user once about storage issues
        notifyClientsOfStorageIssue();
        return;
      }

      // Log other unhandled rejections
      error("Unhandled rejection in SW:", event.reason);
    },
  );

  let storageIssueNotified = false;
  async function notifyClientsOfStorageIssue() {
    if (storageIssueNotified) return;
    storageIssueNotified = true;

    const swSelf = self as unknown as ServiceWorkerGlobalScope;
    const clients = await swSelf.clients.matchAll({ type: "window" });
    clients.forEach((client) => {
      client.postMessage({
        type: "warning",
        data: {
          message:
            "Browser storage is having issues. Try clearing cache or using a different browser.",
          identifier: "storage-backing-store-error",
          action: "/debug-clear",
        },
      });
    });
  }

  // Precache injection placeholder - CRITICAL: Must use exact format for Workbox injection
  // TypeScript safe access with fallback for development
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manifest = (self as any).__WB_MANIFEST || [];

  // Wrap Workbox precache in try-catch to handle IDB failures gracefully
  try {
    precacheAndRoute(manifest, {
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
    });
    cleanupOutdatedCaches();
  } catch (e) {
    error("Workbox precache failed (continuing without precache):", e);
    // Service worker continues to function without precaching
  }

  // Navigation handling: For SSR/dev, skip createHandlerBoundToURL which expects a precached URL.
  // Our fetch handler below provides an offline fallback for navigations.

  // Simple runtime caching strategies - using centralized constants
  // 1. Images - CacheFirst (includes AppImages directory)
  registerRoute(
    ({ request: _request, url }: { request: Request; url: URL }) =>
      url.origin === self.location.origin &&
      !isViteDevelopmentAsset(url) &&
      (/\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/.test(url.pathname) ||
        url.pathname.startsWith("/AppImages/")),
    new CacheFirst({
      cacheName: CACHE_NAMES.IMAGES,
      plugins: [
        new ExpirationPlugin({
          maxEntries: _CACHE_CONFIG.IMAGES.MAX_ENTRIES,
          maxAgeSeconds: _CACHE_CONFIG.IMAGES.MAX_AGE_SECONDS,
        }),
      ],
    }),
  );

  // 2. Hashed build assets (JS/CSS) - CacheFirst with safe offline fallback for unknown chunks
  const assetsStrategy = new CacheFirst({
    cacheName: CACHE_NAMES.ASSETS,
    plugins: [
      new ExpirationPlugin({
        maxEntries: _CACHE_CONFIG.ASSETS.MAX_ENTRIES,
        maxAgeSeconds: _CACHE_CONFIG.ASSETS.MAX_AGE_SECONDS,
      }),
    ],
  });
  registerRoute(
    ({ url, request }: { url: URL; request: Request }) =>
      url.origin === self.location.origin &&
      !isViteDevelopmentAsset(url) &&
      // Exclude the AI worker script — it's loaded via Blob URL in the plugin,
      // but direct loads must not get the CacheFirst/offline-stub treatment either.
      !url.pathname.endsWith("/ai-worker.js") &&
      (url.pathname.startsWith("/_nuxt/") ||
        request.destination === "script" ||
        request.destination === "style"),
    async ({ event, request }) => {
      try {
        // Normal cache-first handling
        return await assetsStrategy.handle({ event, request });
      } catch (err) {
        throw err;
      }
    },
  );

  // 3. App manifest & favicon - SWR so they stay fresh when online
  registerRoute(
    ({ url }: { url: URL }) =>
      url.origin === self.location.origin &&
      (url.pathname === "/manifest.webmanifest" ||
        url.pathname === "/favicon.ico"),
    new StaleWhileRevalidate({ cacheName: CACHE_NAMES.STATIC }),
  );

  // Auth and API entity data are never served from Cache Storage. Account data
  // lives in account-scoped IndexedDB; returning a fake 200 here previously
  // made an uncached workspace look empty and could leak an old account.

  registerRoute(
    ({ url, request }: { url: URL; request: Request }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith("/api/auth/") &&
      request.method === "GET",
    async ({ request }: RouteHandlerCallbackOptions) => {
      try {
        return await fetch(request);
      } catch {
        // Match Auth.js' normal "no session" response while offline. This is
        // deliberately neutral (not a cached/fake authenticated session):
        // route access and account-scoped data are resolved separately from
        // the last identity that was verified online and stored in IndexedDB.
        if (new URL(request.url).pathname === "/api/auth/session") {
          return new Response("{}", {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "OFFLINE_NETWORK_UNAVAILABLE",
              message: "Authentication is unavailable while offline.",
            },
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
    },
  );

  // Explicit workspace-pack files are the only user content served from Cache
  // Storage. Everything else continues to use account-scoped IndexedDB or the
  // network, so an old API response can never masquerade as current data.
  registerRoute(
    ({ url, request }: { url: URL; request: Request }) =>
      url.origin === self.location.origin &&
      !url.pathname.startsWith("/api/") &&
      request.method === "GET" &&
      request.mode !== "navigate",
    async ({ request }: RouteHandlerCallbackOptions) => {
      const cache = await caches.open(CACHE_NAMES.OFFLINE_FILES);
      const packed = await cache.match(request, { ignoreSearch: false });
      if (packed) return packed;
      return fetch(request);
    },
  );

  // Workspace reads fall back in their feature repository, never this cache.
  registerRoute(
    ({ url, request }: { url: URL; request: Request }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith("/api/workspaces") &&
      request.method === "GET",
    async ({ request }: RouteHandlerCallbackOptions) => {
      try {
        return await fetch(request);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "OFFLINE_CACHE_MISS",
              message: "This content is not downloaded for offline use.",
            },
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
    },
  );

  // Notes hydrate from their local-first repository.
  registerRoute(
    ({ url, request }: { url: URL; request: Request }) =>
      url.origin === self.location.origin &&
      url.pathname.startsWith("/api/notes") &&
      request.method === "GET",
    async ({ request }: RouteHandlerCallbackOptions) => {
      try {
        return await fetch(request);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "OFFLINE_CACHE_MISS",
              message: "Notes are not available in this offline pack.",
            },
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      }
    },
  );

  // NOTE: Navigation requests are handled by our custom fetch listener below
  // This avoids Workbox "no-response" errors and gives us full control over offline behavior

  // Helper to extract asset URLs from HTML string (nuxt hashed chunks, CSS, images referenced)
  function extractAssetUrls(html: string): string[] {
    try {
      const urls = new Set<string>();
      // Basic matches for Nuxt hashed chunks and CSS referenced in HTML
      const re =
        /\/(?:_nuxt|_assets)\/[A-Za-z0-9._/-]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) urls.add(m[0]);
      return Array.from(urls);
    } catch {
      return [];
    }
  }

  // Prewarm helper: proactively fetch and cache important pages after activation, and their dependent assets
  async function prewarmPages(paths: string[]) {
    try {
      const pageCache = await caches.open(CACHE_NAMES.PAGES);
      const assetCache = await caches.open(CACHE_NAMES.ASSETS);
      const staticCache = await caches.open(CACHE_NAMES.STATIC);

      // Always consider these tiny static files to avoid noisy logs
      const staticWarm = [
        "/manifest.webmanifest",
        "/favicon.ico",
        "/AppImages/ios/180.png", // Primary iOS icon
        "/AppImages/android/android-launchericon-192-192.png", // Primary Android icon
        "/AppImages/android/android-launchericon-512-512.png", // Maskable icon
      ];
      for (const s of staticWarm) {
        try {
          const r = await fetch(s, { cache: "no-store" });
          if (r && r.ok) await staticCache.put(new Request(s), r.clone());
        } catch {
          /* ignore */
        }
      }

      for (const path of paths) {
        try {
          // Fetch fresh HTML and cache it
          const resp = await fetch(path, { cache: "no-store" });
          if (resp && resp.ok) {
            await pageCache.put(new Request(path), resp.clone());
            log("Prewarmed page:", path);

            // Try to parse HTML to discover dependent assets and cache them too
            let text = "";
            try {
              text = await resp.clone().text();
            } catch {
              /* ignore */
            }
            if (text) {
              const assetUrls = extractAssetUrls(text);
              for (const u of assetUrls) {
                try {
                  const r = await fetch(u, { cache: "no-store" });
                  if (r && r.ok)
                    await assetCache.put(new Request(u), r.clone());
                } catch {
                  /* best effort */
                }
              }
              if (assetUrls.length)
                log("Prewarmed assets for", path, assetUrls.length);
            }
          } else {
            warn("Prewarm skipped (non-200):", path, resp?.status);
          }
        } catch (e) {
          // Don’t fail activation if a route can’t be fetched (offline build previews, etc.)
          warn("Prewarm failed:", path, e);
        }
      }
    } catch (e) {
      warn("Prewarm pages error", e);
    }
  }

  // ---------------------- LIFECYCLE EVENTS ----------------------
  const swSelf = self as unknown as ServiceWorkerGlobalScope;

  swSelf.addEventListener("install", (_event: ExtendableEvent) => {
    log("install event");
    // Do not auto-activate; let the new worker wait for user consent.
    // Avoid long-running install promises that can show "trying to install".
  });

  swSelf.addEventListener("activate", (event: ExtendableEvent) => {
    log("activate event");
    event.waitUntil(
      (async () => {
        try {
          await swSelf.clients.claim();
        } catch (e) {
          warn("clients.claim failed", e);
        }
        log("claimed clients");
        const clients = await swSelf.clients.matchAll({
          includeUncontrolled: true,
          type: "window",
        });
        for (const c of clients)
          c.postMessage({
            type: SW_MESSAGE_TYPES.SW_ACTIVATED,
            version: SW_VERSION,
          });
        // Pre-warm critical shell pages so they work offline immediately
        try {
          await prewarmPages([...PREWARM_PATHS]);
        } catch {
          /* ignore */
        }
      })(),
    );
  });

  // Proactively notify pages when a new SW is waiting (in case of race vs immediate activation)
  // This triggers if this active SW detects a future update cycle placing the next one into waiting.
  // Only runs if registration available (in SW global scope via self.registration).
  try {
    // Listen for future updates (e.g., periodic checks) and broadcast when a waiting worker appears.
    self.addEventListener("statechange", () => {
      /* noop: statechange events occur on worker, not registration */
    });

    // Poll registration periodically (lightweight) – alternative to relying on external client check.
    const notifyIfWaiting = async () => {
      const reg = (self as unknown as ServiceWorkerGlobalScope).registration as
        | ServiceWorkerRegistration
        | undefined;
      const waiting = reg?.waiting;
      if (waiting) {
        const clients = await swSelf.clients.matchAll({
          includeUncontrolled: true,
          type: "window",
        });
        clients.forEach((c) =>
          c.postMessage({
            type: SW_MESSAGE_TYPES.SW_UPDATE_AVAILABLE,
            version: SW_VERSION,
          }),
        );
      }
    };
    // Initial slight delay to allow potential update flow to settle.
    setTimeout(() => {
      notifyIfWaiting().catch(() => {});
    }, 1500);
    // Periodic lightweight check (every 30s) – can be disabled if noisy.
    setInterval(() => {
      notifyIfWaiting().catch(() => {});
    }, 30000);
  } catch {
    /* ignore */
  }

  // -------------------- MESSAGE HANDLING --------------------
  swSelf.addEventListener("message", (event: ExtendableMessageEvent) => {
    const data = (event.data || {}) as IncomingSWMessage | { type?: string };
    const type = (data as { type?: IncomingSWMessage["type"] }).type;
    if (type === SW_MESSAGE_TYPES.SKIP_WAITING) {
      log("Received SKIP_WAITING");
      swSelf.skipWaiting();
      return;
    }
    if (type === SW_MESSAGE_TYPES.CLAIM_CONTROL) {
      swSelf.clients.claim().then(async () => {
        const clients = await swSelf.clients.matchAll({ type: "window" });
        clients.forEach((c) =>
          c.postMessage({ type: SW_MESSAGE_TYPES.SW_CONTROL_CLAIMED }),
        );
      });
      return;
    }
    if (type === SW_MESSAGE_TYPES.TEST_NOTIFICATION_CLICK) {
      const targetUrl =
        (
          data as Extract<
            IncomingSWMessage,
            { type: typeof SW_MESSAGE_TYPES.TEST_NOTIFICATION_CLICK }
          >
        ).data?.url || "/";
      const extendable = event as ExtendableEvent;
      extendable.waitUntil(
        (async () => {
          const clients = await swSelf.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });
          if (clients.length) {
            clients[0].postMessage({
              type: SW_MESSAGE_TYPES.NOTIFICATION_CLICK_NAVIGATE,
              url: targetUrl,
            });
            try {
              await (clients[0] as WindowClient).focus();
            } catch (e) {
              warn("focus failed", e);
            }
          } else {
            await swSelf.clients.openWindow(targetUrl);
          }
        })(),
      );
      return;
    }
    if (type === SW_MESSAGE_TYPES.SYNC_NOTES) {
      (event as ExtendableEvent).waitUntil(syncPendingNotes());
      return;
    }
    if (type === SW_MESSAGE_TYPES.SET_DEBUG) {
      DEBUG = !!(
        data as Extract<
          IncomingSWMessage,
          { type: typeof SW_MESSAGE_TYPES.SET_DEBUG }
        >
      ).value;
      log("Debug mode set to", DEBUG);
      return;
    }
  });

  // --------------------- PUSH NOTIFICATIONS ---------------------
  swSelf.addEventListener("push", (event: PushEvent) => {
    log("Push event received");
    event.waitUntil(
      (async () => {
        try {
          if (!event.data) {
            await swSelf.registration.showNotification("Card Review", {
              body: "You have cards to review!",
              icon: "/icons/192x192.png",
              badge: "/icons/96x96.png",
              tag: "card-review-fallback",
              requireInteraction: true,
              data: { url: "/user/review", timestamp: Date.now() },
            });
            return;
          }

          let data: Partial<{
            title: string;
            message: string;
            icon: string;
            tag: string;
            requireInteraction: boolean;
            silent: boolean;
            url: string;
            data: Record<string, unknown>;
          }>;

          try {
            data = JSON.parse(event.data.text());
          } catch {
            try {
              data = event.data.json();
            } catch {
              data = {
                title: "Card Review",
                message: "You have cards to review!",
              };
            }
          }

          const title = data.title || "Card Review";
          // Avoid spreading a logical expression directly. esbuild can remove
          // its parentheses, making the generated worker invalid in Chromium.
          const notificationData =
            data.data && typeof data.data === "object" ? data.data : {};
          const options = {
            body: data.message || "You have cards to review!",
            icon: data.icon || "/icons/192x192.png",
            badge: "/icons/72x72.png",
            tag: data.tag || "card-review",
            requireInteraction: false,
            silent: false,
            renotify: true,
            data: {
              url: data.url || "/review",
              timestamp: Date.now(),
              ...notificationData,
            },
            actions: [
              { action: "review", title: "📚 Review Now" },
              { action: "snooze", title: "⏰ Snooze 1hr" },
              { action: "dismiss", title: "❌ Dismiss" },
            ],
          } as NotificationOptions & {
            actions?: Array<{ action: string; title: string }>;
          };

          const badgeNumber = typeof data.dueCount === 'number' ? data.dueCount : (typeof data.badgeCount === 'number' ? data.badgeCount : undefined);
          if (typeof badgeNumber === 'number' && typeof (navigator as Navigator & { setAppBadge?: (n: number) => Promise<void> }).setAppBadge === 'function') {
            (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(badgeNumber).catch(() => {});
          }

          await swSelf.registration.showNotification(title, options);
          log("Notification shown:", title);
        } catch (err) {
          error("Push handler error:", err);
          try {
            await swSelf.registration.showNotification("Cognilo", {
              body: "Notification received but failed to process.",
              icon: "/icons/192x192.png",
              tag: "error-fallback",
              data: { url: "/user/review", timestamp: Date.now() },
            });
          } catch (fallbackError) {
            error("Emergency fallback notification failed:", fallbackError);
          }
        }
      })(),
    );
  });

  swSelf.addEventListener("notificationclick", (event: NotificationEvent) => {
    const action = event.action;
    const ndata = event.notification.data as { url?: string } | undefined;
    log("Notification clicked:", action);
    event.notification.close();

    event.waitUntil(
      (async () => {
        if (action === "snooze") {
          try {
            await fetch("/api/notifications/snooze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ duration: 3600, timestamp: Date.now() }),
            });
          } catch (e) {
            warn("Snooze request failed:", e);
          }
          return;
        }

        if (action === "dismiss") return;

        const targetUrl = ndata?.url || "/";
        const clients = await swSelf.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (clients.length) {
          for (const c of clients) {
            c.postMessage({
              type: SW_MESSAGE_TYPES.NOTIFICATION_CLICK_NAVIGATE,
              url: targetUrl,
            });
          }
          try {
            await (clients[0] as WindowClient).focus();
          } catch (e) {
            warn("focus failed:", e);
          }
          return;
        }

        try {
          await swSelf.clients.openWindow(targetUrl);
        } catch (e) {
          error("openWindow failed:", e);
        }
      })(),
    );
  });

  // -------- PERIODIC & BACKGROUND SYNC --------
  swSelf.addEventListener("periodicsync", (event: Event) => {
    const psEvent = event as unknown as {
      tag?: string;
      waitUntil: ExtendableEvent["waitUntil"];
    };

    if (psEvent.tag === "content-sync") {
      psEvent.waitUntil(syncContent());
    }
  });

  swSelf.addEventListener("sync", (event: Event) => {
    const syncEvt = event as unknown as {
      tag?: string;
      waitUntil: ExtendableEvent["waitUntil"];
    };
    if (syncEvt.tag === SYNC_TAGS.NOTES) syncEvt.waitUntil(syncPendingNotes());
    if (syncEvt.tag === SYNC_TAGS.OFFLINE_V2)
      syncEvt.waitUntil(syncOfflineV2());
  });

  // ------------------------ FETCH FALLBACK (Only for non-navigation requests) ------------------------
  swSelf.addEventListener("fetch", (event: FetchEvent) => {
    const req = event.request;
    const url = new URL(req.url);
    const isDevHost =
      self.location.hostname === "localhost" ||
      self.location.hostname === "127.0.0.1" ||
      self.location.hostname.endsWith(".local");

    // Skip development files completely - let them fail naturally
    if (
      isViteDevelopmentAsset(url) ||
      url.pathname.includes("/@fs/") ||
      url.pathname.includes("/node_modules/") ||
      url.pathname.includes("error-dev.vue") ||
      url.pathname.includes("builds/meta/dev.json") ||
      url.pathname.includes("/@vite/") ||
      url.pathname.includes("/@id/") ||
      url.pathname.includes("/__vite_ping") ||
      url.pathname.includes("/nuxt/dist/app/") ||
      url.pathname.includes("sw.js") ||
      (isDevHost && url.searchParams.has("v") && req.mode !== "navigate") ||
      req.url.includes("?import")
    ) {
      // Let these requests go through normally without SW intervention
      return;
    }

    // For navigation requests, handle caching ourselves
    if (req.mode === "navigate") {
      event.respondWith(
        (async () => {
          try {
            // Try network first
            log("Fetching navigation request:", req.url);
            const response = await fetch(req);
            if ([502, 503, 504].includes(response.status)) {
              throw new Error(`App process unavailable (${response.status})`);
            }

            // Cache only the neutral shell. Workspace/board/account HTML can
            // contain an authenticated SSR payload and must never be used as
            // an offline source of user data.
            if (
              response.ok &&
              response.status === 200 &&
              url.pathname === "/"
            ) {
              try {
                const cache = await caches.open(CACHE_NAMES.PAGES);
                await cache.put(req, response.clone());
                log("Cached page successfully:", req.url);
                // Opportunistically cache assets referenced by this HTML (to reduce offline chunk misses)
                try {
                  const html = await response.clone().text();
                  const assetUrls = extractAssetUrls(html);
                  if (assetUrls.length) {
                    const assetCache = await caches.open(CACHE_NAMES.ASSETS);
                    await Promise.all(
                      assetUrls.map(async (u) => {
                        try {
                          const r = await fetch(u, { cache: "no-store" });
                          if (r && r.ok)
                            await assetCache.put(new Request(u), r.clone());
                        } catch {
                          /* best effort */
                        }
                      }),
                    );
                    log(
                      "Opportunistically cached assets from navigation:",
                      assetUrls.length,
                    );
                  }
                } catch {
                  /* ignore parse issues */
                }
                // Simple size-based eviction for the 'pages' cache
                try {
                  const keys = await cache.keys();
                  const MAX_ENTRIES = _CACHE_CONFIG.PAGES.MAX_ENTRIES;
                  if (keys.length > MAX_ENTRIES) {
                    const toDelete = keys.length - MAX_ENTRIES;
                    for (let i = 0; i < toDelete; i++) {
                      await cache.delete(keys[i]);
                    }
                  }
                } catch (e) {
                  warn("Pages cache cleanup failed", e);
                }
              } catch (cacheError) {
                warn("Failed to cache page:", cacheError);
              }
            }

            return response;
          } catch {
            // Network failed - check if page is cached
            log("Network failed for:", req.url);

            // Debug: List what's in the pages cache
            if (DEBUG) {
              const cache = await caches.open(CACHE_NAMES.PAGES);
              const cacheKeys = await cache.keys();
              log(
                "Pages cache contains:",
                cacheKeys.map((r) => r.url),
              );
            }

            // Look specifically in the 'pages' cache first
            const cache = await caches.open(CACHE_NAMES.PAGES);
            let cachedResponse = await cache.match(req, { ignoreSearch: true });

            if (!cachedResponse) {
              // Also try with clean URL (no query params)
              const cleanUrl = new URL(req.url);
              cleanUrl.search = "";
              // Do not construct a Request with mode 'navigate' (invalid in RequestInit)
              cachedResponse = await cache.match(cleanUrl.toString(), {
                ignoreSearch: true,
              });
              log("Tried clean URL:", cleanUrl.toString());
            }

            if (cachedResponse) {
              log("Serving cached page:", req.url);
              return cachedResponse;
            }

            // Try app-shell fallback so SPA can render the route offline
            try {
              const shell = await cache.match("/", { ignoreSearch: true });
              if (shell) {
                log("Serving app shell (/) as offline fallback for:", req.url);
                return shell;
              }
              const shellHtml = await cache.match("/index.html", {
                ignoreSearch: true,
              });
              if (shellHtml) {
                log("Serving /index.html as offline fallback for:", req.url);
                return shellHtml;
              }
            } catch (e) {
              warn("Shell fallback lookup failed", e);
            }

            // No cached page or shell - serve simple offline HTML
            log(
              "No cached page or shell found, serving offline HTML for:",
              req.url,
            );
            return new Response(
              `
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
                        `,
              {
                headers: {
                  "Content-Type": "text/html",
                  "Cache-Control": "no-store",
                },
                status: 503,
              },
            );
          }
        })(),
      );
    }
  });

  async function syncContent() {
    log("periodic content sync placeholder");
  }

  async function syncPendingNotes(): Promise<void> {
    if (notesSyncInProgress) return;
    notesSyncInProgress = true;
    try {
      const clients = await swSelf.clients.matchAll({ type: "window" });
      // The feature runtime is the sole owner whenever a window exists.
      if (clients.length) return;

      const pending = (await loadPendingNoteChanges()).filter(
        (change) => !change.conflicted,
      );
      const pendingGroups = (await loadPendingNoteGroupChanges()).filter(
        (change) => !change.conflicted,
      );
      const layouts = await loadPendingNoteLayoutChanges();
      if (!pending.length && !pendingGroups.length && !layouts.length) return;

      const requests = [
        {
          changes: pending,
          groupChanges: pendingGroups,
          layout: layouts[0],
        },
        ...layouts.slice(1).map((layout) => ({
          changes: [] as PendingNoteChange[],
          groupChanges: [] as PendingNoteGroupChange[],
          layout,
        })),
      ];

      for (const request of requests) {
        const response = await fetch("/api/notes/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            changes: request.changes,
            contentChanges: [],
            groupChanges: request.groupChanges,
            ...(request.layout && { layoutChange: request.layout }),
          }),
        });
        if (!response.ok)
          throw new Error(`Notes sync failed (${response.status})`);
        const envelope = (await response.json()) as {
          data?: NotesSyncResponse;
        };
        if (!envelope.data) throw new Error("Notes sync returned no data");
        const result = envelope.data;
        // If a window appeared while the request was in flight, leave the
        // durable acknowledgement to the feature runtime. The create receipt
        // makes its retry idempotent and avoids cross-context cache races.
        if ((await swSelf.clients.matchAll({ type: "window" })).length) return;
        const replayedCreates = new Set(result.replayedCreates ?? []);
        const replayedGroupCreates = new Set(result.replayedGroupCreates ?? []);
        const sentById = new Map(
          request.changes.map((change) => [change.id, change]),
        );
        const sentGroupsById = new Map(
          request.groupChanges.map((change) => [change.id, change]),
        );
        const currentPending = new Map(
          (await loadPendingNoteChanges()).map((change) => [change.id, change]),
        );
        const currentGroups = new Map(
          (await loadPendingNoteGroupChanges()).map((change) => [
            change.id,
            change,
          ]),
        );
        const isNewer = <
          T extends {
            localVersion: number;
            updatedAt: number;
            operation: string;
          },
        >(
          current: T | undefined,
          sent: T | undefined,
        ) =>
          Boolean(
            current &&
            sent &&
            (current.localVersion > sent.localVersion ||
              current.updatedAt > sent.updatedAt ||
              current.operation !== sent.operation),
          );
        const appliedMetadata = new Map(
          (result.appliedNotes ?? []).map((note) => [note.id, note]),
        );
        const db = await openUnifiedDB();

        for (const conflict of result.conflicts ?? []) {
          const sent = sentById.get(conflict.id);
          const current = currentPending.get(conflict.id) ?? sent;
          if (!current) continue;
          await queueNoteChange({
            ...current,
            conflicted: true,
            serverVersion: conflict.serverVersion ?? current.serverVersion,
          });
          if (sent?.operation === "delete" && sent.rollbackData) {
            await putRecord(db, DB_CONFIG.STORES.NOTES as any, {
              ...sent.rollbackData,
              id: conflict.id,
              isDirty: true,
              isLoading: false,
              error:
                "Sync conflict detected. Resolve local and server versions before syncing this note.",
            });
          }
          await saveNoteSyncConflict({
            id: `${current.workspaceId}:content:${conflict.id}`,
            workspaceId: current.workspaceId!,
            scope: "content",
            entityId: conflict.id,
            reason: conflict.reason ?? "SYNC_CONFLICT",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            localSnapshot: current,
            serverSnapshot: conflict.serverSnapshot ?? null,
            serverVersion: conflict.serverVersion,
            clientServerVersion: conflict.clientServerVersion,
          });
        }

        for (const [tempId, serverId] of Object.entries(result.idMap ?? {})) {
          const sent = sentById.get(tempId);
          const current = currentPending.get(tempId);
          if (!sent) continue;
          const metadata = appliedMetadata.get(tempId);
          const local = await getRecord<Record<string, unknown>>(
            db,
            DB_CONFIG.STORES.NOTES as any,
            tempId,
          );
          const source = local ?? sent.rollbackData ?? sent;
          const canonicalLocalRecord = {
            ...source,
            id: serverId,
            workspaceId: sent.workspaceId,
            groupId: current?.groupId ?? sent.groupId ?? null,
            title: current?.title ?? sent.title,
            content: current?.content ?? sent.content ?? "",
            tags: current?.tags ?? sent.tags ?? [],
            noteType: current?.noteType ?? sent.noteType ?? "TEXT",
            metadata: current?.metadata ?? sent.metadata,
            order: current?.order ?? sent.order ?? 0,
            version: metadata?.version ?? 1,
            createdAt:
              (local?.createdAt as Date | undefined) ??
              new Date(sent.updatedAt),
            updatedAt: metadata?.updatedAt
              ? new Date(metadata.updatedAt)
              : new Date(sent.updatedAt),
            isDirty: false,
            isLoading: false,
            error: null,
            lastSaved: new Date(),
          };
          const retained = await acknowledgePendingNoteChange(sent, {
            remapToId: serverId,
            serverVersion: metadata?.version ?? 1,
            keepCurrent: replayedCreates.has(tempId),
            localMutation: {
              type: "remap",
              fromId: tempId,
              note: canonicalLocalRecord as any,
            },
          });
          void retained;
        }
        await remapPendingNoteIds(result.idMap ?? {});

        for (const id of result.applied ?? []) {
          if (result.idMap?.[id]) continue;
          const sent = sentById.get(id);
          if (!sent) continue;
          const metadata = appliedMetadata.get(id);
          const retained = await acknowledgePendingNoteChange(sent, {
            serverVersion: metadata?.version ?? sent.serverVersion,
            ...(sent.operation === "delete" && {
              localMutation: { type: "delete" as const, id },
            }),
            ...(sent.operation !== "delete" && {
              localMutation: {
                type: "advance" as const,
                id,
                serverVersion: metadata?.version ?? sent.serverVersion,
                updatedAt: metadata?.updatedAt,
              },
            }),
          });
          if (retained) continue;
          if (sent.operation === "delete") {
            continue;
          }
          const local = await getRecord<Record<string, unknown>>(
            db,
            DB_CONFIG.STORES.NOTES as any,
            id,
          );
          if (local) {
            await putRecord(db, DB_CONFIG.STORES.NOTES as any, {
              ...local,
              version: metadata?.version ?? local.version,
              updatedAt: metadata?.updatedAt
                ? new Date(metadata.updatedAt)
                : local.updatedAt,
              isDirty: false,
              isLoading: false,
              error: null,
              lastSaved: new Date(),
            });
          }
        }

        if (Object.keys(result.groupIdMap ?? {}).length) {
          await remapPendingNoteGroupIds(result.groupIdMap);
          await reconcileNoteGroupIds(result.groupIdMap);
        }
        for (const id of result.groupApplied ?? []) {
          const sent = sentGroupsById.get(id);
          const current = currentGroups.get(id);
          const newer = replayedGroupCreates.has(id) || isNewer(current, sent);
          const serverId = result.groupIdMap?.[id];
          if (serverId) {
            await deletePendingNoteGroupChanges([id]);
            if (newer && current) {
              await queueNoteGroupChange({
                ...current,
                id: serverId,
                operation: current.operation === "delete" ? "delete" : "rename",
                serverVersion: current.serverVersion ?? 1,
              });
            }
          } else if (!newer) {
            await deletePendingNoteGroupChanges([id]);
          }
          if (!newer && sent?.operation === "delete") {
            await deleteRecord(db, DB_CONFIG.STORES.NOTE_GROUPS as any, id);
          }
        }
        for (const conflict of result.groupConflicts ?? []) {
          const sent = sentGroupsById.get(conflict.id);
          const current = currentGroups.get(conflict.id) ?? sent;
          if (current) {
            await queueNoteGroupChange({ ...current, conflicted: true });
          }
          if (sent?.operation === "delete" && sent.rollbackData) {
            await putRecord(db, DB_CONFIG.STORES.NOTE_GROUPS as any, {
              ...sent.rollbackData,
              id: conflict.id,
            });
          }
        }

        if (result.layoutApplied && request.layout) {
          const current = (await loadPendingNoteLayoutChanges()).find(
            (layout) => layout.workspaceId === request.layout!.workspaceId,
          );
          if (
            current?.localVersion === request.layout.localVersion &&
            current.updatedAt === request.layout.updatedAt
          ) {
            await deletePendingNoteLayoutChange(request.layout.workspaceId);
          }
        }
      }
      const hasRemaining =
        (await loadPendingNoteChanges()).some((change) => !change.conflicted) ||
        (await loadPendingNoteGroupChanges()).some(
          (change) => !change.conflicted,
        ) ||
        (await loadPendingNoteLayoutChanges()).length > 0;
      if (hasRemaining && "sync" in swSelf.registration) {
        try {
          // @ts-expect-error SyncManager is missing in some worker libdefs.
          await swSelf.registration.sync.register(SYNC_TAGS.NOTES);
        } catch {
          // Reconnect/app-open remains the fallback.
        }
      }
    } catch (err) {
      error("notes background sync error", err);
      if ("sync" in swSelf.registration) {
        try {
          // @ts-expect-error SyncManager is missing in some worker libdefs.
          await swSelf.registration.sync.register(SYNC_TAGS.NOTES);
        } catch {
          // Reconnect/app-open remains the fallback.
        }
      }
    } finally {
      notesSyncInProgress = false;
    }
  }

  async function syncOfflineV2() {
    const clients = await swSelf.clients.matchAll({ type: "window" });
    // A visible client owns reconciliation to avoid two actors reading the same
    // outbox. Background Sync is only the no-client recovery path.
    if (clients.length) return;
    const session = await getOfflineSession();
    if (!session) return;
    await recoverInterruptedMutations(session.accountId);
    const pending = (await listOfflineMutations(session.accountId))
      .filter(
        (mutation) =>
          mutation.entity !== "note" && mutation.entity !== "noteGroup",
      )
      .filter(
        (mutation) =>
          mutation.status === "pending" || mutation.status === "retry",
      );
    const { ordered, cyclic } = orderOfflineMutations(pending);
    if (cyclic.length)
      await setMutationStatus(
        session.accountId,
        cyclic.map((mutation) => mutation.id),
        "rejected",
        "Cyclic offline dependency",
      );
    const candidates = ordered.slice(0, 50);
    if (!candidates.length) return;
    const claimToken = `service-worker:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    const batch = await claimOfflineMutations({
      accountId: session.accountId,
      ids: candidates.map((mutation) => mutation.id),
      claimToken,
    });
    if (!batch.length) return;
    try {
      const response = await fetch("/api/offline/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clientId: "service-worker", mutations: batch }),
      });
      if (!response.ok)
        throw Object.assign(
          new Error(`Offline sync failed (${response.status})`),
          { statusCode: response.status },
        );
      const payload = (await response.json()) as { data?: OfflineSyncResponse };
      if (!payload.data) throw new Error("Offline sync returned no data");
      const byId = new Map(batch.map((mutation) => [mutation.id, mutation]));
      const returned = new Set<string>();
      for (const result of payload.data.results) {
        const mutation = byId.get(result.id);
        if (!mutation) continue;
        returned.add(result.id);
        if (result.idMap) {
          await remapOfflineIds(session.accountId, result.idMap, {
            serverVersion: result.version,
            mutationId: mutation.id,
          });
        }
        await applyOfflineSyncResult({
          accountId: session.accountId,
          mutation,
          result,
        });
      }
      const missing = batch.filter((mutation) => !returned.has(mutation.id));
      if (missing.length) {
        await setMutationStatus(
          session.accountId,
          missing.map((mutation) => mutation.id),
          "retry",
          "The sync service did not acknowledge this mutation.",
          claimToken,
        );
      }
      await updateOfflineSyncMetadata(session.accountId, {
        lastAttemptAt: Date.now(),
        lastSuccessfulSyncAt: Date.now(),
        lastError: undefined,
      });
      const remaining = (await listOfflineMutations(session.accountId)).some(
        (mutation) =>
          mutation.entity !== "note" &&
          mutation.entity !== "noteGroup" &&
          (mutation.status === "pending" || mutation.status === "retry"),
      );
      if (remaining && "sync" in swSelf.registration) {
        // @ts-expect-error SyncManager is missing in some worker libdefs.
        await swSelf.registration.sync.register(SYNC_TAGS.OFFLINE_V2);
      }
    } catch (err: any) {
      const message =
        err instanceof Error ? err.message : "Background sync failed";
      const statusCode = Number(err?.statusCode ?? 0);
      await setMutationStatus(
        session.accountId,
        batch.map((mutation) => mutation.id),
        statusCode === 401 || statusCode === 403 ? "blocked" : "retry",
        statusCode === 401 || statusCode === 403
          ? "Sign in to sync your saved local changes."
          : message,
        claimToken,
      );
      await updateOfflineSyncMetadata(session.accountId, {
        lastAttemptAt: Date.now(),
        lastError:
          statusCode === 401 || statusCode === 403
            ? "Sign in to sync your saved local changes."
            : message,
      });
      error("offline-v2 sync error", err);
    }
  }

  //----------------------------------------------------------------
})();
