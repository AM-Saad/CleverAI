// shared/constants/offline.ts
// Constants specific to offline functionality and page management

import type { OfflinePage } from '~/types/offline'

// ===== OFFLINE PAGE DEFINITIONS =====
export const OFFLINE_PAGES: OfflinePage[] = [
  {
    title: 'Home',
    path: '/',
    description: 'Main dashboard and overview',
    icon: 'home',
    priority: 1,
  },
  {
    title: 'Profile',
    path: '/profile',
    description: 'User profile and settings',
    icon: 'user',
    priority: 2,
  },
  {
    title: 'About',
    path: '/about',
    description: 'About CleverAI',
    icon: 'info',
    priority: 3,
  },
] as const

// ===== OFFLINE UI CONSTANTS =====
export const OFFLINE_UI = {
  CHECK_TIMEOUT: 5000, // 5 seconds
  RECONNECT_DELAY: 3000, // 3 seconds
  RETRY_ATTEMPTS: 3,
  REFRESH_LABEL: 'Refresh Page',
  CONNECTING_MESSAGE: 'Connecting...',
  CONNECTION_FAILED_MESSAGE: 'Connection failed. Retrying...',
  OFFLINE_MESSAGE: 'You are currently offline',
  ONLINE_MESSAGE: 'You are back online!',
  AVAILABLE_OFFLINE_TITLE: 'Available Offline',
  NETWORK_STATUS_TITLE: 'Network Status',
  RECONNECT_BUTTON_TEXT: 'Try to Reconnect',
  REFRESH_BUTTON_TEXT: 'Refresh Page',
} as const

// ===== OFFLINE STORAGE KEYS =====
export const OFFLINE_STORAGE_KEYS = {
  LAST_ONLINE: 'lastOnlineTime',
  CACHED_DATA: 'offlineCachedData',
  PENDING_FORMS: 'pendingOfflineForms',
  USER_PREFERENCES: 'offlineUserPreferences',
} as const

// ===== OFFLINE FORM CONSTANTS =====
export const OFFLINE_FORM_CONFIG = {
  MAX_PENDING_FORMS: 50,
  FORM_EXPIRY_DAYS: 7,
  AUTO_SYNC_DELAY: 2000, // 2 seconds
  SYNC_RETRY_INTERVALS: [1000, 2000, 5000, 10000], // Exponential backoff
} as const
