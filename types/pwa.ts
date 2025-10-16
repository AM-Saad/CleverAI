// types/pwa.ts
// Type definitions for PWA and service worker functionality

export interface SwMessage {
  type: string
  payload?: unknown
  id?: string
}

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
}

export interface ChunkUploadData {
  file: File
  chunkSize: number
  totalChunks: number
  fileName: string
  fileId: string
}

export interface SyncFormData {
  id: string
  formData: FormData
  endpoint: string
  timestamp: number
  retryCount?: number
}

export interface CacheConfig {
  maxEntries?: number
  maxAgeSeconds?: number
  purgeOnQuotaError?: boolean
}

export interface NotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export interface SwConfig {
  version: string
  debug: boolean
  cacheNames: Record<string, string>
  networkTimeout: number
  updateCheckInterval: number
}

export interface DbSchema {
  name: string
  version: number
  stores: Record<string, string>
  keyPath: string
}

export interface BackgroundSyncData {
  tag: string
  data: unknown
  timestamp: number
}

export interface PwaInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
