// server/utils/llm/cache.ts
import { createHash } from 'crypto'
import { getRedisClient } from './rateLimit'

/**
 * Generate consistent cache key for prompt + task
 * Uses SHA-256 hash truncated to 32 chars
 */
export function generateCacheKey(text: string, task: string): string {
  const hash = createHash('sha256')
    .update(`${task}:${text}`)
    .digest('hex')
    .slice(0, 32)
  
  return `llm:cache:${task}:${hash}`
}

/**
 * Check semantic cache for existing result
 * Returns cached response if found, null otherwise
 */
export async function checkSemanticCache(
  text: string,
  task: string
): Promise<{ hit: boolean; value: any | null }> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      console.debug('[cache] Redis not available, skipping cache check')
      return { hit: false, value: null }
    }
    
    const key = generateCacheKey(text, task)
    const cached = await redis.get(key)
    
    if (cached) {
      console.info('[cache] Hit:', {
        key: key.slice(0, 40),
        task,
        textLength: text.length,
      })
      return { hit: true, value: JSON.parse(cached) }
    }
    
    console.debug('[cache] Miss:', { key: key.slice(0, 40), task })
    return { hit: false, value: null }
  } catch (err) {
    console.error('[cache] Check error:', err)
    // Fail gracefully - don't block generation on cache errors
    return { hit: false, value: null }
  }
}

/**
 * Store result in semantic cache
 * Default TTL: 7 days
 */
export async function setSemanticCache(
  text: string,
  task: string,
  value: any,
  ttlSeconds = 60 * 60 * 24 * 7 // 7 days default
): Promise<void> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      console.debug('[cache] Redis not available, skipping cache set')
      return
    }
    
    const key = generateCacheKey(text, task)
    const serialized = JSON.stringify(value)
    
    await redis.set(key, serialized, 'EX', ttlSeconds)
    
    console.info('[cache] Set:', {
      key: key.slice(0, 40),
      task,
      textLength: text.length,
      valueSize: serialized.length,
      ttlSeconds,
    })
  } catch (err) {
    console.error('[cache] Set error:', err)
    // Don't throw - caching is optional
  }
}

/**
 * Invalidate cache entries for a specific task or all tasks
 * Useful when folder content changes significantly
 */
export async function invalidateCache(task?: string): Promise<number> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      console.debug('[cache] Redis not available, skipping invalidation')
      return 0
    }
    
    const pattern = task
      ? `llm:cache:${task}:*`
      : 'llm:cache:*'
    
    // Use SCAN for production-safe iteration
    let cursor = '0'
    let deleted = 0
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = nextCursor
      
      if (keys.length > 0) {
        deleted += await redis.del(...keys)
      }
    } while (cursor !== '0')
    
    console.info('[cache] Invalidated:', { pattern, count: deleted })
    return deleted
  } catch (err) {
    console.error('[cache] Invalidate error:', err)
    return 0
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return {
        available: false,
        keyCount: 0,
        memoryUsed: '0 bytes',
      }
    }
    
    // Count cache keys
    let cursor = '0'
    let keyCount = 0
    
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        'llm:cache:*',
        'COUNT',
        1000
      )
      cursor = nextCursor
      keyCount += keys.length
    } while (cursor !== '0')
    
    // Get memory info
    const info = await redis.info('memory')
    const memoryMatch = info.match(/used_memory_human:(\S+)/)
    const memoryUsed = memoryMatch ? memoryMatch[1] : 'unknown'
    
    return {
      available: true,
      keyCount,
      memoryUsed,
    }
  } catch (err) {
    console.error('[cache] Stats error:', err)
    return {
      available: false,
      keyCount: 0,
      memoryUsed: '0 bytes',
      error: String(err),
    }
  }
}
