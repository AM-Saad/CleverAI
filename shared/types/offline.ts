// shared/constants/offline.ts
// Constants specific to offline functionality and page management

import type { OfflinePage } from "../../types/offline";
import { DB_CONFIG } from "../../app/utils";

export type STORES = (typeof DB_CONFIG)["STORES"][keyof typeof DB_CONFIG.STORES];


// ===== OFFLINE PAGE DEFINITIONS =====
export const OFFLINE_PAGES: OfflinePage[] = [
  {
    title: "Home",
    path: "/",
    description: "Main dashboard and overview",
    icon: "home",
    priority: 1,
  },
  {
    title: "Profile",
    path: "/profile",
    description: "User profile and settings",
    icon: "user",
    priority: 2,
  },
  {
    title: "About",
    path: "/about",
    description: "About CleverAI",
    icon: "info",
    priority: 3,
  },
  {
    title: "FOLDERS",
    path: "/folders",
    description: "Manage your folders",
    icon: "folder",
    priority: 4,
  },
] as const;

// ===== OFFLINE UI CONSTANTS =====
export const OFFLINE_UI = {
  CHECK_TIMEOUT: 5000, // 5 seconds
  RECONNECT_DELAY: 3000, // 3 seconds
  RETRY_ATTEMPTS: 3,
  REFRESH_LABEL: "Refresh Page",
  CONNECTING_MESSAGE: "Connecting...",
  CONNECTION_FAILED_MESSAGE: "Connection failed. Retrying...",
  OFFLINE_MESSAGE: "You are currently offline",
  ONLINE_MESSAGE: "You are back online!",
  AVAILABLE_OFFLINE_TITLE: "Available Offline",
  NETWORK_STATUS_TITLE: "Network Status",
  RECONNECT_BUTTON_TEXT: "Try to Reconnect",
  REFRESH_BUTTON_TEXT: "Refresh Page",
} as const;

// ===== OFFLINE STORAGE KEYS =====
export const OFFLINE_STORAGE_KEYS = {
  LAST_ONLINE: "lastOnlineTime",
  CACHED_DATA: "offlineCachedData",
  PENDING_FORMS: "pendingOfflineForms",
  USER_PREFERENCES: "offlineUserPreferences",
} as const;

// ===== OFFLINE FORM CONSTANTS =====
export const OFFLINE_FORM_CONFIG = {
  MAX_PENDING_FORMS: 50,
  FORM_EXPIRY_DAYS: 7,
  AUTO_SYNC_DELAY: 2000, // 2 seconds
  SYNC_RETRY_INTERVALS: [1000, 2000, 5000, 10000], // Exponential backoff
} as const;

// ===== FORM SYNC TYPES =====
export const FORM_SYNC_TYPES = {
  // Material management
  UPLOAD_MATERIAL: "upload-material",
  UPDATE_MATERIAL: "update-material",
  DELETE_MATERIAL: "delete-material",

  // Folder management
  CREATE_FOLDER: "create-folder",
  UPDATE_FOLDER: "update-folder",
  DELETE_FOLDER: "delete-folder",

  // Note management
  CREATE_NOTE: "create-note",
  UPDATE_NOTE: "update-note",
  DELETE_NOTE: "delete-note",
  

  // Review system
  ENROLL_CARD: "enroll-card",
  GRADE_CARD: "grade-card",
  UNENROLL_CARD: "unenroll-card",

  // User preferences
  UPDATE_PREFERENCES: "update-preferences",
  UPDATE_NOTIFICATION_SETTINGS: "update-notification-settings",
} as const;

// Type for form sync operations
export type FormSyncType =
  (typeof FORM_SYNC_TYPES)[keyof typeof FORM_SYNC_TYPES];

// ===== FORM SYNC HANDLERS MAPPING =====
export const FORM_SYNC_HANDLERS = {
  [FORM_SYNC_TYPES.UPLOAD_MATERIAL]: "material",
  [FORM_SYNC_TYPES.UPDATE_MATERIAL]: "material",
  [FORM_SYNC_TYPES.DELETE_MATERIAL]: "material",

  [FORM_SYNC_TYPES.CREATE_FOLDER]: "folder",
  [FORM_SYNC_TYPES.UPDATE_FOLDER]: "folder",
  [FORM_SYNC_TYPES.DELETE_FOLDER]: "folder",

  [FORM_SYNC_TYPES.CREATE_NOTE]: "note",
  [FORM_SYNC_TYPES.UPDATE_NOTE]: "note",
  [FORM_SYNC_TYPES.DELETE_NOTE]: "note",

  [FORM_SYNC_TYPES.ENROLL_CARD]: "review",
  [FORM_SYNC_TYPES.GRADE_CARD]: "review",
  [FORM_SYNC_TYPES.UNENROLL_CARD]: "review",

  [FORM_SYNC_TYPES.UPDATE_PREFERENCES]: "user",
  [FORM_SYNC_TYPES.UPDATE_NOTIFICATION_SETTINGS]: "notification",
} as const;

