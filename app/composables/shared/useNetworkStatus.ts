// composables/shared/useNetworkStatus.ts
/**
 * Multi-signal network monitor (singleton).
 *
 * Three signals combine for near-real-time accuracy:
 *  1. navigator.onLine events — instant but unreliable (true on captive portals)
 *  2. Server ping (HEAD /api/auth/session) — slow but reliable, confirms reachability
 *  3. API failure reports — FetchFactory reports FETCH_ERROR / TIMEOUT to trigger
 *     an immediate re-verify
 *
 * Exported state:
 *  - isOnline:         fast signal from navigator.onLine (use for instant UI indicators)
 *  - isVerifiedOnline:  slow signal from server ping (use for sync / skip-fetch decisions)
 *  - isTransitioning:  true during a 2 s debounce after state changes (prevents flicker)
 *
 * All fields are reactive (Vue refs).
 */

// ─── Module-scoped singleton state ───────────────────────────────────────────
const isOnline = ref(true);
const isVerifiedOnline = ref(true);
const isTransitioning = ref(false);
const isConnecting = ref(false);

let initialised = false;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let periodicPingTimer: ReturnType<typeof setInterval> | null = null;
let pingController: AbortController | null = null;

// Callbacks registered via onOnline / onOffline
const onlineCallbacks = new Set<() => void | Promise<void>>();
const offlineCallbacks = new Set<() => void | Promise<void>>();

// ─── Config ──────────────────────────────────────────────────────────────────
const PING_URL = '/api/auth/session'; // lightweight, always-cached endpoint
const PING_TIMEOUT_MS = 5_000;
const PERIODIC_PING_INTERVAL_MS = 30_000;
const TRANSITION_DEBOUNCE_MS = 2_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ping(): Promise<boolean> {
  // Cancel any in-flight ping
  if (pingController) {
    try { pingController.abort(); } catch { /* ignore */ }
  }
  pingController = new AbortController();
  const timer = setTimeout(() => pingController?.abort(), PING_TIMEOUT_MS);

  try {
    const resp = await fetch(PING_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: pingController.signal,
    });
    return resp.ok || resp.status === 401 || resp.status === 403;
    // 401/403 means server is reachable but user is unauthenticated — still "online"
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    pingController = null;
  }
}

function startTransitionDebounce() {
  isTransitioning.value = true;
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    isTransitioning.value = false;
    transitionTimer = null;
  }, TRANSITION_DEBOUNCE_MS);
}

function startPeriodicPing() {
  stopPeriodicPing();
  periodicPingTimer = setInterval(async () => {
    // Only polls while browser says online but we haven't verified yet
    if (isOnline.value && !isVerifiedOnline.value) {
      const ok = await ping();
      if (ok && !isVerifiedOnline.value) {
        isVerifiedOnline.value = true;
        startTransitionDebounce();
        fireCallbacks(onlineCallbacks);
      }
    }
  }, PERIODIC_PING_INTERVAL_MS);
}

function stopPeriodicPing() {
  if (periodicPingTimer) {
    clearInterval(periodicPingTimer);
    periodicPingTimer = null;
  }
}

function fireCallbacks(cbs: Set<() => void | Promise<void>>) {
  for (const cb of cbs) {
    try { Promise.resolve(cb()).catch(() => {}); } catch { /* ignore */ }
  }
}

// ─── Core init (runs once) ───────────────────────────────────────────────────

function init() {
  if (initialised || !import.meta.client) return;
  initialised = true;

  isOnline.value = navigator.onLine;
  // Assume initially verified if navigator says online — first real API call will correct if wrong
  isVerifiedOnline.value = navigator.onLine;

  // Signal 1: navigator.onLine events
  window.addEventListener('online', handleBrowserOnline);
  window.addEventListener('offline', handleBrowserOffline);

  // Start periodic ping if not verified
  if (isOnline.value && !isVerifiedOnline.value) {
    startPeriodicPing();
  }
}

async function handleBrowserOnline() {
  isOnline.value = true;
  isConnecting.value = true;
  startTransitionDebounce();

  // Verify with a ping before marking verified
  const ok = await ping();
  isConnecting.value = false;

  if (ok) {
    isVerifiedOnline.value = true;
    stopPeriodicPing();
    fireCallbacks(onlineCallbacks);
  } else {
    // Browser says online but server unreachable — start polling
    isVerifiedOnline.value = false;
    startPeriodicPing();
  }
}

function handleBrowserOffline() {
  isOnline.value = false;
  isVerifiedOnline.value = false;
  isConnecting.value = false;
  startTransitionDebounce();
  stopPeriodicPing();
  fireCallbacks(offlineCallbacks);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Signal 3: call when FetchFactory sees FETCH_ERROR / TIMEOUT.
 * Triggers an immediate re-verify of connectivity.
 */
async function reportFailure(): Promise<void> {
  if (!isVerifiedOnline.value) return; // already known offline
  const ok = await ping();
  if (!ok) {
    isVerifiedOnline.value = false;
    startTransitionDebounce();
    startPeriodicPing();
    // Don't fire offlineCallbacks here — the browser didn't fire 'offline',
    // we're in a degraded "online but unreachable" state. Stores should check
    // isVerifiedOnline before syncing.
  }
}

/**
 * Register a callback that fires when verified-online is established.
 * Returns a cleanup function.
 */
function onOnline(cb: () => void | Promise<void>): () => void {
  onlineCallbacks.add(cb);
  return () => { onlineCallbacks.delete(cb); };
}

/**
 * Register a callback that fires when the browser goes offline.
 * Returns a cleanup function.
 */
function onOffline(cb: () => void | Promise<void>): () => void {
  offlineCallbacks.add(cb);
  return () => { offlineCallbacks.delete(cb); };
}

/**
 * Wait until verified online or timeout.
 */
async function waitForConnection(timeout = 5000): Promise<boolean> {
  if (isVerifiedOnline.value) return true;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    const cleanup = onOnline(() => {
      clearTimeout(timeoutId);
      cleanup();
      resolve(true);
    });
  });
}

/**
 * Retry a function with exponential backoff, waiting for connectivity when offline.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        console.error('All retry attempts failed');
        return null;
      }

      if (!isVerifiedOnline.value) {
        const connected = await waitForConnection(baseDelay * Math.pow(2, attempt));
        if (!connected) {
          console.warn('Network timeout, continuing with retry');
        }
      } else {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, attempt)),
        );
      }
    }
  }
  return null;
}

// ─── Composable ──────────────────────────────────────────────────────────────

export const useNetworkStatus = () => {
  // Ensure singleton init (safe to call multiple times)
  init();

  return {
    /** Fast signal — mirrors navigator.onLine. Use for instant UI (badges, banners). */
    isOnline: readonly(isOnline),
    /** Verified via server ping. Use for sync/skip-fetch decisions. */
    isVerifiedOnline: readonly(isVerifiedOnline),
    /** True for 2 s after any transition — use to prevent flicker. */
    isTransitioning: readonly(isTransitioning),
    /** True while verifying connectivity (ping in flight). */
    isConnecting: readonly(isConnecting),
    /** Call when FetchFactory sees FETCH_ERROR / TIMEOUT. */
    reportFailure,
    /** Register callback for verified-online transition. Returns cleanup fn. */
    onOnline,
    /** Register callback for offline transition. Returns cleanup fn. */
    onOffline,
    waitForConnection,
    retryWithBackoff,
  };
};
