# Offline and PWA behavior

Offline access is local-first, not a cache of authenticated API responses. It is protected by the `NUXT_PUBLIC_OFFLINE_V2` rollout switch and must not be described as “full offline support” until the acceptance matrix below passes. A user first signs in online and chooses **Make available offline** from the Sync Center. The resulting account-scoped pack contains workspace content, board data, materials, study/review data, language data, and safe preferences.

Supported offline writes are saved locally and reconciled one mutation at a time after reconnect. The Sync Center exposes pending, retrying, rejected, and conflict states; no queued mutation is discarded merely because a request returned HTTP 200.

AI generation/translation/capture, authentication, OAuth/imports, billing, push registration, and real-time collaboration presence require a connection. New binary material uploads are retained as local drafts and must be explicitly sent once online. Logging out clears the account's IndexedDB records, cached pack data, blobs, and offline identity from that device.

The production build always injects Workbox's precache manifest after Nuxt finishes building; the build fails if the placeholder remains uninjected.

Before enabling the runtime for any user, run `yarn offline:backfill` after the schema deployment, then verify cold and warm offline starts, reload/crash recovery, account clearing, reconnect idempotency, pack refresh/removal, mutation conflicts, and cache-miss states in Chromium, Firefox, and WebKit.
