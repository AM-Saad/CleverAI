import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(async (nuxtApp) => {
  // Ensure this plugin never runs in the browser
  if (process.client) return

  // Lazy import server-only modules
  const { useRuntimeConfig } = await import('#imports')
  const { default: Redis } = await import('ioredis')

  const config = useRuntimeConfig()
  const redisUrl = (config as any).redisUrl || process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[redis] No REDIS_URL configured — Redis client will not be available.')
    return
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1, // fail fast
    enableOfflineQueue: false, // don't queue when disconnected
    connectTimeout: 5000,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 1000)),
    // TLS handled automatically if using rediss://
  })

  client.on('error', (err) => {
    console.error('[redis] connection error:', err?.message || err)
  })

  client.on('connect', () => {
    console.log('[redis] connected')
  })

  // Attach to NuxtApp for global access (server-side only)
  ;(nuxtApp as any).$redis = client
})
