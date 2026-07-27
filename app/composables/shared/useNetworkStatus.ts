// composables/shared/useNetworkStatus.ts
/**
 * Multi-signal network monitor (singleton).
 *
 * Three signals combine for near-real-time accuracy:
 *  1. navigator.onLine events — instant but unreliable (true on captive portals)
 *  2. Server ping (GET /api/health) — slow but reliable, confirms reachability
 *  3. API failure reports — the service layer and the sync paths report
 *     FETCH_ERROR / TIMEOUT to trigger an immediate re-verify
 *
 * A slow heartbeat also runs while reachability is verified, because a silent
 * drop (captive portal, dead Wi-Fi, VPN flap, DNS failure) never fires an
 * `offline` event. Without it the app could report "online" indefinitely while
 * every request failed.
 *
 * Exported state:
 *  - isOnline:         fast signal from navigator.onLine (use for instant UI indicators)
 *  - isVerifiedOnline:  slow signal from server ping (use for sync / skip-fetch decisions)
 *  - isTransitioning:  true during a 2 s debounce after state changes (prevents flicker)
 *
 * All fields are reactive (Vue refs).
 */

import { isNetworkClassError } from "../../utils/networkErrors";

/** Why the app stopped being reachable. */
export type OfflineReason = "browser" | "unreachable";

export type OnlineTransition = {
  /**
   * False for the app's first successful reachability check after boot. The
   * monitor starts unverified, so that first check is not a reconnection and
   * must not be reported to the user as one.
   */
  isRecovery: boolean;
};

export type OfflineTransition = {
  /** `browser` = navigator fired `offline`; `unreachable` = ping failed while navigator claimed online. */
  reason: OfflineReason;
};

// ─── Module-scoped singleton state ───────────────────────────────────────────
const isOnline = ref(true);
const isVerifiedOnline = ref(true);
const isTransitioning = ref(false);
const isConnecting = ref(false);
/**
 * False until the first reachability check resolves. Before that, an unverified
 * state means "not checked yet", not "unreachable" — UI must not report a
 * problem during that window or every cold start looks like an outage.
 */
const hasCheckedReachability = ref(false);

let initialised = false;
/** Set once the server has been reached at least once this page lifetime. */
let hasVerifiedOnce = false;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryPingTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let inflightPing: Promise<boolean> | null = null;
let verificationPromise: Promise<boolean> | null = null;

// Callbacks registered via onOnline / onOffline
const onlineCallbacks = new Set<
  (transition: OnlineTransition) => void | Promise<void>
>();
const offlineCallbacks = new Set<
  (transition: OfflineTransition) => void | Promise<void>
>();

// ─── Config ──────────────────────────────────────────────────────────────────
const PING_URL = "/api/health"; // lightweight unauthenticated endpoint
const PING_TIMEOUT_MS = 5_000;
// Poll while reachability is unverified. Five seconds keeps durable outboxes
// from appearing stuck after a transient API/network failure.
const RECOVERY_PING_INTERVAL_MS = 5_000;
// Liveness check while healthy. Deliberately much slower than the recovery
// poll — it exists to notice a silent drop, not to react instantly.
const HEARTBEAT_INTERVAL_MS = 30_000;
const TRANSITION_DEBOUNCE_MS = 2_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Concurrent callers share one request. Aborting an in-flight ping to start a
 * fresh one used to make the recovery poll cancel itself whenever a ping took
 * longer than the poll interval, so a slow-but-alive link never recovered.
 */
async function ping(): Promise<boolean> {
  if (inflightPing) return inflightPing;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  inflightPing = fetch(PING_URL, {
    method: "GET",
    cache: "no-store",
    signal: controller.signal,
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      clearTimeout(timer);
      inflightPing = null;
    });
  return inflightPing;
}

function startTransitionDebounce() {
  isTransitioning.value = true;
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    isTransitioning.value = false;
    transitionTimer = null;
  }, TRANSITION_DEBOUNCE_MS);
}

function startRecoveryPing() {
  if (recoveryPingTimer) return;
  recoveryPingTimer = setInterval(async () => {
    // Only polls while the browser says online but we haven't verified yet.
    if (!isOnline.value || isVerifiedOnline.value) return;
    if (await ping()) markVerified();
  }, RECOVERY_PING_INTERVAL_MS);
}

function stopRecoveryPing() {
  if (recoveryPingTimer) {
    clearInterval(recoveryPingTimer);
    recoveryPingTimer = null;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    if (!isVerifiedOnline.value || !isOnline.value) return;
    // A hidden tab cannot act on the result, and browsers throttle its timers
    // anyway. `visibilitychange` re-verifies on the way back.
    if (document.hidden) return;
    if (!(await ping())) markUnreachable();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function fireOnline(transition: OnlineTransition) {
  for (const cb of onlineCallbacks) {
    try {
      Promise.resolve(cb(transition)).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

function fireOffline(transition: OfflineTransition) {
  for (const cb of offlineCallbacks) {
    try {
      Promise.resolve(cb(transition)).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

/** Single entry point for "the server answered". */
function markVerified() {
  const wasVerified = isVerifiedOnline.value;
  isVerifiedOnline.value = true;
  isConnecting.value = false;
  hasCheckedReachability.value = true;
  stopRecoveryPing();
  startHeartbeat();
  if (wasVerified) return;
  const isRecovery = hasVerifiedOnce;
  hasVerifiedOnce = true;
  startTransitionDebounce();
  fireOnline({ isRecovery });
}

/** Single entry point for "navigator says online but the server is not there". */
function markUnreachable() {
  const wasVerified = isVerifiedOnline.value;
  isVerifiedOnline.value = false;
  isConnecting.value = false;
  hasCheckedReachability.value = true;
  stopHeartbeat();
  startRecoveryPing();
  if (!wasVerified) return;
  startTransitionDebounce();
  // Firing this is what lets the UI report a degraded connection. Consumers
  // that gate syncing still read isVerifiedOnline; this is only the edge.
  fireOffline({ reason: "unreachable" });
}

// ─── Core init (runs once) ───────────────────────────────────────────────────

function init() {
  if (initialised || !import.meta.client) return;
  initialised = true;

  isOnline.value = navigator.onLine;
  isVerifiedOnline.value = false;

  // Signal 1: navigator.onLine events
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  // A drop that happened while the tab was hidden produces no event the tab
  // could observe, so re-verify whenever it becomes visible again.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && navigator.onLine) void verifyConnection();
  });

  if (isOnline.value) void verifyConnection();
}

async function verifyConnection(): Promise<boolean> {
  if (!import.meta.client) return true;
  if (!navigator.onLine) {
    handleBrowserOffline();
    return false;
  }
  if (verificationPromise) return verificationPromise;
  isConnecting.value = true;
  const run = ping().then((ok) => {
    const verified = ok && navigator.onLine;
    if (verified) markVerified();
    else markUnreachable();
    return verified;
  });
  verificationPromise = run.finally(() => {
    verificationPromise = null;
  });
  return verificationPromise;
}

async function handleBrowserOnline() {
  isOnline.value = true;
  startTransitionDebounce();
  await verifyConnection();
}

function handleBrowserOffline() {
  const wasVerified = isVerifiedOnline.value;
  isOnline.value = false;
  isVerifiedOnline.value = false;
  isConnecting.value = false;
  hasCheckedReachability.value = true;
  startTransitionDebounce();
  stopRecoveryPing();
  stopHeartbeat();
  if (wasVerified || hasVerifiedOnce) fireOffline({ reason: "browser" });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Signal 3: call when a request fails with FETCH_ERROR / TIMEOUT.
 * Triggers an immediate re-verify of connectivity.
 */
async function reportFailure(): Promise<void> {
  if (!isVerifiedOnline.value) return; // already known offline
  if (!(await ping())) markUnreachable();
}

/**
 * Report a caught fetch error. Only network-class failures (no HTTP response)
 * count as connectivity signals — a 500 means the server is reachable.
 * Use this at raw `$fetch` call sites, which bypass the service layer's hook.
 */
async function reportFetchError(error: unknown): Promise<void> {
  if (!isNetworkClassError(error)) return;
  await reportFailure();
}

/**
 * Register a callback that fires when verified-online is established.
 * Returns a cleanup function.
 */
function onOnline(
  cb: (transition: OnlineTransition) => void | Promise<void>,
): () => void {
  onlineCallbacks.add(cb);
  return () => {
    onlineCallbacks.delete(cb);
  };
}

/**
 * Register a callback that fires when connectivity is lost — either the browser
 * went offline or a ping confirmed the server is unreachable.
 * Returns a cleanup function.
 */
function onOffline(
  cb: (transition: OfflineTransition) => void | Promise<void>,
): () => void {
  offlineCallbacks.add(cb);
  return () => {
    offlineCallbacks.delete(cb);
  };
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
        console.error("All retry attempts failed");
        return null;
      }

      if (!isVerifiedOnline.value) {
        const connected = await waitForConnection(
          baseDelay * Math.pow(2, attempt),
        );
        if (!connected) {
          console.warn("Network timeout, continuing with retry");
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
    /** False until the first reachability check resolves. */
    hasCheckedReachability: readonly(hasCheckedReachability),
    /** Call when a request fails with FETCH_ERROR / TIMEOUT. */
    reportFailure,
    /** Call with a caught error at raw `$fetch` sites; ignores HTTP failures. */
    reportFetchError,
    /** Run or join a server reachability check. */
    verifyConnection,
    /** Register callback for verified-online transition. Returns cleanup fn. */
    onOnline,
    /** Register callback for connectivity loss. Returns cleanup fn. */
    onOffline,
    waitForConnection,
    retryWithBackoff,
  };
};
