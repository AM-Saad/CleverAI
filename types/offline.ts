// types/offline.ts
// Type definitions for offline functionality

export interface OfflinePage {
  title: string
  path: string
  description: string
  icon: string
  priority: number
}

export interface OfflineFormData {
  id: string
  formType: string
  data: Record<string, unknown>
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface NetworkStatus {
  isOnline: boolean
  isConnecting: boolean
  lastOnline: number | null
  connectionType?: string
}

export interface OfflineStorageData {
  lastSync: number
  pendingForms: OfflineFormData[]
  cachedPages: string[]
  userPreferences: Record<string, unknown>
}
