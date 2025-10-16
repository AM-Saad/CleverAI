/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "web-push"
declare module "nuxt-auth"
declare module "socket.io-client"
declare module "bcryptjs"
// Workbox ESM shims for SW bundling
declare module 'workbox-core'
// Minimal shims for Workbox packages to satisfy TS when bundling in SW
declare module 'workbox-precaching' {
  export interface PrecacheEntry { url: string; revision?: string | null }
  export const precacheAndRoute: (entries: Array<string | PrecacheEntry>, opts?: any) => void
  export const cleanupOutdatedCaches: () => void
  export const createHandlerBoundToURL: (url: string) => any
}
declare module 'workbox-routing' {
  export const NavigationRoute: new (handler: any) => any
  export const registerRoute: (...args: any[]) => void
}
declare module 'workbox-strategies' {
  export const CacheFirst: new (opts?: any) => any
  export const StaleWhileRevalidate: new (opts?: any) => any
  export const NetworkFirst: new (opts?: any) => any
}
declare module 'workbox-expiration' {
  export const ExpirationPlugin: new (opts?: any) => any
}
interface Window {
  camStream?: MediaStream
  broadcast?: MediaStream
  mediaCamRecorder: MediaRecorder
  screenStream?: MediaStream
  audioCtx?: AudioContext
}

// extend tha blob interface to add chunks and name properties
declare interface Blob {
  chunks: BlobPart[]
  name: string
}
