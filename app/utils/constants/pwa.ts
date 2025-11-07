// shared/constants/pwa.ts
// Centralized PWA constants to eliminate hardcoded values across the system

// ===== SERVICE WORKER CONSTANTS =====
export const SW_CONFIG = {
  VERSION: "v2.0.0-enhanced",
  DEBUG_QUERY_PARAM: "swDebug",
  DEBUG_VALUE: "1",
  UPDATE_CHECK_INTERVAL: 30000, // 30 seconds
  UPDATE_SETTLE_DELAY: 1500, // 1.5 seconds
  NETWORK_TIMEOUT: 20000, // 20 seconds
  AUTO_HIDE_BANNER_DELAY: 15000, // 15 seconds
} as const;

// ===== CACHE NAMES =====
export const CACHE_NAMES = {
  PAGES: "pages",
  ASSETS: "assets",
  IMAGES: "images",
  STATIC: "static",
  API_AUTH: "api-auth",
  API_FOLDERS: "api-folders",
  API_NOTES: "api-notes",
} as const;

// ===== CACHE CONFIGURATION =====
export const CACHE_CONFIG = {
  IMAGES: {
    MAX_ENTRIES: 50,
    MAX_AGE_SECONDS: 30 * 24 * 60 * 60, // 30 days
  },
  ASSETS: {
    MAX_ENTRIES: 100,
    MAX_AGE_SECONDS: 7 * 24 * 60 * 60, // 7 days
  },
  PAGES: {
    MAX_ENTRIES: 100,
  },
} as const;

// ===== INDEXEDDB CONSTANTS =====
export const DB_CONFIG = {
  NAME: "recwide_db",
  // Bump to 4 to ensure unified store creation migration runs exactly once.
  // Previous versions created stores lazily per open; version 4 performs consolidated creation.
  VERSION: 4,
  STORES: {
    FORMS: "forms",
    NOTES: "notes",
  },
} as const;

// ===== IDB RETRY BACKOFF CONFIG =====
// Small, bounded exponential backoff for transient IndexedDB transaction errors
// (e.g., InvalidStateError while a previous connection is closing). Values kept
// tiny so UI writes (notes, form queue) remain snappy while still spacing retries.
export const IDB_RETRY_CONFIG = {
  MAX_ATTEMPTS: 3, // initial try + 2 retries
  BASE_DELAY_MS: 40, // starting delay
  FACTOR: 2, // exponential growth factor
  MAX_DELAY_MS: 400, // upper bound clamp
  JITTER_PCT: 0.2, // +/-20% jitter
} as const;

// ===== MESSAGE TYPES =====
export const SW_MESSAGE_TYPES = {
  // Sync messages
  FORM_SYNC_ERROR: "FORM_SYNC_ERROR",
  FORM_SYNCED: "FORM_SYNCED",
  SYNC_FORM: "SYNC_FORM",

  // Service worker control
  SW_ACTIVATED: "SW_ACTIVATED",
  SW_CONTROL_CLAIMED: "SW_CONTROL_CLAIMED",
  SW_UPDATE_AVAILABLE: "SW_UPDATE_AVAILABLE",

  // User commands
  SKIP_WAITING: "SKIP_WAITING",
  CLAIM_CONTROL: "CLAIM_CONTROL",
  SET_DEBUG: "SET_DEBUG",

  // Notifications
  NOTIFICATION_CLICK_NAVIGATE: "NOTIFICATION_CLICK_NAVIGATE",
  TEST_NOTIFICATION_CLICK: "TEST_NOTIFICATION_CLICK",

  // Generic error
  ERROR: "error",
} as const;

// ===== SYNC TAGS =====
export const SYNC_TAGS = {
  FORM: "syncForm",
  CONTENT: "content-sync",
} as const;

// ===== NOTIFICATION CONSTANTS =====
export const NOTIFICATION_CONFIG = {
  DEFAULT_TITLE: "Notification",
  DEFAULT_TAG: "default",
  FALLBACK_TAG: "fallback",
  FALLBACK_TITLE: "CleverAI Notification",
  FALLBACK_BODY: "You have a new notification",
  DEFAULT_ICON: "/icons/192x192.png",
  BADGE_ICON: "/icons/96x96.png",
  DEFAULT_URL: "/",
} as const;

// ===== UPLOAD CONSTANTS =====
// (Upload constants removed) Previously defined upload-specific config has been
// pruned as the upload feature is not active. Reintroduce alongside feature code if needed.

// ===== URL PATTERNS =====
export const URL_PATTERNS = {
  // Development files to skip
  DEV_FILES: [
    "/@fs/",
    "/node_modules/",
    "error-dev.vue",
    "builds/meta/dev.json",
    "/@vite/",
    "/@id/",
    "/__vite_ping",
    "/nuxt/dist/app/",
    "sw.js",
  ],

  // Asset patterns
  IMAGES: /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/,
  NUXT_ASSETS:
    /\/(?:_nuxt|_assets)\/[A-Za-z0-9._\-/]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico)/g,

  // API patterns
  AUTH_API: "/api/auth/",
  FORM_SYNC_API: "/api/form-sync",

  // Static files
  MANIFEST: "/manifest.webmanifest",
  FAVICON: "/favicon.ico",
  NUXT_BUILD: "/_nuxt/",
} as const;

// ===== PREWARM PATHS =====
export const PREWARM_PATHS = ["/", "/about", "/folders"] as const;

// (STATIC_WARM_FILES removed) Static warm list now lives inline in sw prewarm implementation.

// ===== AUTH STUBS =====
export const AUTH_STUBS = {
  "/api/auth/session": { user: null, expires: null },
  "/api/auth/csrf": { csrfToken: null },
  "/api/auth/providers": {},
} as const;

// ===== NETWORK STATUS =====
export const NETWORK_CONFIG = {
  CHECK_TIMEOUT: 5000, // 5 seconds
  CHECK_DELAY: 1000, // 1 second
  RETRY_DELAY: 500, // 0.5 seconds
} as const;

// ===== HOST DETECTION =====
export const HOST_CONFIG = {
  LOCAL_HOSTS: ["localhost", "127.0.0.1"],
  LOCAL_DOMAIN_SUFFIX: ".local",
} as const;

// ===== PERIODIC SYNC =====
export const PERIODIC_SYNC_CONFIG = {
  CONTENT_SYNC_INTERVAL: 60 * 60 * 1000, // 1 hour
} as const;

// ===== DOM EVENT NAMES =====
export const DOM_EVENTS = {
  OFFLINE_FORM_SAVED: "offline-form-saved",
  OFFLINE_FORM_SYNC_STARTED: "offline-form-sync-started",
  OFFLINE_FORM_SYNCED: "offline-form-synced",
  OFFLINE_FORM_SYNC_ERROR: "offline-form-sync-error",
  VISIBILITY_CHANGE: "visibilitychange",
  ONLINE: "online",
  STORAGE_RESTRICTED: "storage-restricted",
} as const;

// ===== HTTP CONSTANTS =====
export const HTTP_CONFIG = {
  METHODS: {
    GET: "GET",
    POST: "POST",
  },
  HEADERS: {
    CONTENT_TYPE: "Content-Type",
    CACHE_CONTROL: "Cache-Control",
    RETRY_AFTER: "Retry-After",
  },
  CONTENT_TYPES: {
    JSON: "application/json",
    JAVASCRIPT: "application/javascript",
    HTML: "text/html",
  },
  CACHE_DIRECTIVES: {
    NO_STORE: "no-store",
    NO_CACHE: "no-cache",
  },
  STATUS_CODES: {
    OK: 200,
    SERVICE_UNAVAILABLE: 503,
  },
} as const;

// ===== REQUEST DESTINATIONS =====
export const REQUEST_DESTINATIONS = {
  SCRIPT: "script",
  STYLE: "style",
  IMAGE: "image",
} as const;

// ===== REQUEST MODES =====
export const REQUEST_MODES = {
  NAVIGATE: "navigate",
} as const;

// ===== OFFLINE HTML =====
export const OFFLINE_HTML_CONFIG = {
  TITLE: "Offline",
  MAIN_HEADING: "Offline",
  MESSAGE: "This page isn't available offline yet.",
  INSTRUCTION: "Please check your connection and try again.",
  BUTTONS: {
    TRY_AGAIN: "Try Again",
    GO_HOME: "Go Home",
  },
  COLORS: {
    BACKGROUND: "#f5f5f5",
    PRIMARY: "#007bff",
    PRIMARY_HOVER: "#0056b3",
  },
} as const;
