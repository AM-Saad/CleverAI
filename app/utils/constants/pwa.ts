// shared/constants/pwa.ts
// Centralized PWA constants to eliminate hardcoded values across the system

// ===== SERVICE WORKER CONSTANTS =====
export const SW_CONFIG = {
  VERSION: "v2.0.5-enhanced",
  // Changes only when ownership/semantics of a durable sync queue change.
  // Unlike an asset update, protocol upgrades must activate immediately to
  // prevent an old worker from draining a queue with obsolete rules.
  SYNC_PROTOCOL: "notes-v1.1-offline-v2-daily-v1",
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
  API_FOLDERS: "api-workspaces",
  API_NOTES: "api-notes",
  // Explicitly user-downloaded attachments only. This is intentionally not a
  // general user-data HTTP cache.
  OFFLINE_FILES: "offline-files",
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
  // VERSION HISTORY
  // 4: Unified creation of forms + notes stores
  // 5: Added PENDING_NOTES store (offline notes sync queue)
  // 6: Added post-open verification & auto-repair logic
  // 7: Reconciliation bump after detecting live DB already at version 7 (prevent VersionError when client still used 6)
  // 8: Added type, userId indexes for board notes support
  // 9: Board notes feature - added type/userId indexes to notes store
  // 10: BoardItem separation - added BOARD_ITEMS and PENDING_BOARD_ITEMS stores
  // 11: Added BOARD_COLUMNS store for board column offline support
  // 12: Added USER_TAGS store for offline tag caching
  // 13: Added groupId index for workspace note grouping
  // 14: Added pendingNoteLayouts store for local-first note/group layout sync
  // 15: Added noteGroups + pendingNoteGroupChanges for local-first note grouping
  // 16: Added noteSyncConflicts for durable local/server conflict snapshots
  // 17: Account-scoped offline-v2 snapshots, outbox, packs, blobs and recovery
  // 18: Durable per-account sync metadata and crash-recovery state.
  // 19: Daily app projection and feature-owned command outbox (v1, retired).
  // 20: Daily entities/mutations moved onto the shared offline-v2 stores;
  //     the dedicated v19 Daily stores are dropped.
  VERSION: 20,
  STORES: {
    FORMS: "forms",
    NOTES: "notes",
    NOTE_GROUPS: "noteGroups",
    PENDING_NOTES: "pendingNotes",
    PENDING_NOTE_GROUP_CHANGES: "pendingNoteGroupChanges",
    PENDING_NOTE_LAYOUTS: "pendingNoteLayouts",
    NOTE_SYNC_CONFLICTS: "noteSyncConflicts",
    BOARD_ITEMS: "boardItems",
    PENDING_BOARD_ITEMS: "pendingBoardItems",
    BOARD_COLUMNS: "boardColumns",
    USER_TAGS: "userTags",
    OFFLINE_ENTITIES: "offlineEntities",
    OFFLINE_MUTATIONS: "offlineMutations",
    OFFLINE_CONFLICTS: "offlineConflicts",
    OFFLINE_PACKS: "offlinePacks",
    OFFLINE_BLOBS: "offlineBlobs",
    OFFLINE_SESSIONS: "offlineSessions",
    OFFLINE_SYNC_META: "offlineSyncMeta",
    OFFLINE_LEGACY_RECOVERY: "offlineLegacyRecovery",
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
  OFFLINE_SYNC_STARTED: "OFFLINE_SYNC_STARTED",
  OFFLINE_SYNCED: "OFFLINE_SYNCED",
  OFFLINE_SYNC_ERROR: "OFFLINE_SYNC_ERROR",

  SYNC_NOTES: "SYNC_NOTES",
  NOTES_SYNC_STARTED: "NOTES_SYNC_STARTED",
  NOTES_SYNCED: "NOTES_SYNCED",
  NOTES_SYNC_ERROR: "NOTES_SYNC_ERROR",
  NOTES_SYNC_CONFLICTS: "NOTES_SYNC_CONFLICTS",

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

// ===== AI WORKER MESSAGE TYPES =====
export const AI_WORKER_MESSAGE_TYPES = {
  // Model loading
  LOAD_MODEL: "LOAD_MODEL",
  MODEL_LOAD_INITIATE: "MODEL_LOAD_INITIATE",
  MODEL_LOAD_PROGRESS: "MODEL_LOAD_PROGRESS",
  MODEL_LOAD_DONE: "MODEL_LOAD_DONE",
  MODEL_LOAD_COMPLETE: "MODEL_LOAD_COMPLETE",
  MODEL_LOAD_ERROR: "MODEL_LOAD_ERROR",

  // Inference
  RUN_INFERENCE: "RUN_INFERENCE",
  INFERENCE_STARTED: "INFERENCE_STARTED",
  INFERENCE_COMPLETE: "INFERENCE_COMPLETE",
  INFERENCE_ERROR: "INFERENCE_ERROR",

  // Model management
  UNLOAD_MODEL: "UNLOAD_MODEL",

  // Generative model (auto-classes API: AutoProcessor + Model.from_pretrained)
  LOAD_GENERATIVE_MODEL: "LOAD_GENERATIVE_MODEL",
  RUN_GENERATION: "RUN_GENERATION",
  GENERATION_TOKEN: "GENERATION_TOKEN",
  GENERATION_COMPLETE: "GENERATION_COMPLETE",
  GENERATION_ERROR: "GENERATION_ERROR",

  // Worker control
  WORKER_READY: "WORKER_READY",
  SET_DEBUG: "SET_DEBUG",
} as const;

// ===== SYNC TAGS =====
export const SYNC_TAGS = {
  CONTENT: "content-sync",
  NOTES: "notes-sync",
  OFFLINE_V2: "offline-v2-sync",
} as const;

// ===== NOTIFICATION CONSTANTS =====
export const NOTIFICATION_CONFIG = {
  DEFAULT_TITLE: "Notification",
  DEFAULT_TAG: "default",
  FALLBACK_TAG: "fallback",
  FALLBACK_TITLE: "Cognilo Notification",
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
  // Static files
  MANIFEST: "/manifest.webmanifest",
  FAVICON: "/favicon.ico",
  NUXT_BUILD: "/_nuxt/",
} as const;

// ===== PREWARM PATHS =====
// Only a neutral app shell is stored as HTML. Account data lives in IndexedDB
// packs; authenticated route responses must never become an offline data cache.
export const PREWARM_PATHS = ["/"] as const;

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
