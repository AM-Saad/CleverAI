import { createError } from "h3";
import { useRuntimeConfig } from "#imports";
import Redis from "ioredis";

export type MemCounter = Map<string, { count: number; timestamp: number }>;

// Window size shared across helpers
export const WINDOW_SEC = 60;

// Optional Redis-backed limiter (preferred in production)
let redisClient: Redis | null = null;
let redisUnavailableUntil = 0;
const REDIS_RETRY_COOLDOWN_MS = 60_000;

function markRedisUnavailable(error: unknown) {
  const now = Date.now();
  const message = (error as any)?.message || error;
  if (now >= redisUnavailableUntil) {
    console.warn("[rateLimit] Redis unavailable, using memory limiter:", message);
  }
  redisUnavailableUntil = now + REDIS_RETRY_COOLDOWN_MS;
  redisClient?.disconnect();
  redisClient = null;
}

export function getRedisClient(): Redis | null {
  try {
    if (Date.now() < redisUnavailableUntil) return null;
    if (redisClient) return redisClient;
    const url = (useRuntimeConfig() as any)?.redisUrl || process.env.REDIS_URL;
    if (!url) return null;
    redisClient = new Redis(url, {
      // Upstash/Serverless-friendly defaults
      maxRetriesPerRequest: 1, // don't spam retries per command
      enableOfflineQueue: false, // fail fast if disconnected
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times) => {
        // backoff up to 1s, stop retrying after ~5 attempts by returning null
        const delay = Math.min(times * 200, 1000);
        return times > 5 ? null : delay;
      },
      // TLS automatically enabled by rediss://
    });
    // Keep the listener so ioredis does not emit unhandled error events, but
    // cool down after DNS/network failures so local dev logs stay readable.
    redisClient.on("error", (err: any) => {
      markRedisUnavailable(err);
    });
    return redisClient;
  } catch (e) {
    markRedisUnavailable(e);
    return null;
  }
}

export async function checkRedisLimit(
  key: string,
  max: number
): Promise<{ used: boolean; remaining?: number }> {
  try {
    const client = getRedisClient();
    if (!client) return { used: false };
    // Ensure the client is connected/ready; attempt a fast connect once
    if ((client as any).status !== "ready") {
      try {
        await client.connect();
      } catch (e) {
        // Not ready; fall back to memory without throwing
        markRedisUnavailable(e);
        return { used: false };
      }
      if ((client as any).status !== "ready") return { used: false };
    }
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, WINDOW_SEC);
    if (count > max)
      throw createError({
        statusCode: 429,
        statusMessage: "Rate limit exceeded. Please wait before trying again.",
      });
    return { used: true, remaining: Math.max(0, max - count) };
  } catch (e) {
    // Fall back to in-memory limiter on any Redis error
    markRedisUnavailable(e);
    return { used: false };
  }
}

export function getClientIp(event: any): string {
  const xff = event.node.req.headers["x-forwarded-for"];
  const xffStr = Array.isArray(xff) ? xff[0] : xff || "";
  const forwardedIp = String(xffStr).split(",")[0]?.trim();
  const socketIp =
    (event.node.req.socket && event.node.req.socket.remoteAddress) ||
    (event.node.req.connection as any)?.remoteAddress ||
    "";
  const rawIp = forwardedIp || socketIp || "unknown";
  return rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
}

export async function applyLimit(
  key: string,
  max: number,
  mem: MemCounter,
  now: number,
  windowMs: number
): Promise<number> {
  const redisRes = await checkRedisLimit(key, max);
  if (redisRes.used) return Math.max(0, redisRes.remaining ?? 0);
  const rl = mem.get(key);
  if (!rl || now - rl.timestamp > windowMs) {
    mem.set(key, { count: 1, timestamp: now });
    return max - 1;
  }
  if (rl.count >= max)
    throw createError({
      statusCode: 429,
      statusMessage: "Rate limit exceeded. Please wait before trying again.",
    });
  rl.count++;
  return Math.max(0, max - rl.count);
}

export function setRateLimitHeaders(
  event: any,
  overallRemaining: number,
  userRemaining: number,
  ipRemaining: number,
  now: number
) {
  event.node.res.setHeader("X-RateLimit-Remaining", String(overallRemaining));
  event.node.res.setHeader("X-RateLimit-Remaining-User", String(userRemaining));
  event.node.res.setHeader("X-RateLimit-Remaining-IP", String(ipRemaining));
  const resetSeconds = Math.ceil(
    WINDOW_SEC - (now % (WINDOW_SEC * 1000)) / 1000
  );
  event.node.res.setHeader("X-RateLimit-Reset", String(resetSeconds));
  if (overallRemaining === 0)
    event.node.res.setHeader("Retry-After", String(resetSeconds));
}

// ── Shared LLM rate-limit buckets ───────────────────────────────────────────
// Module-level singletons so EVERY LLM entrypoint (gateway, language fresh
// translation, AND language shared-translation cache hits) shares the same
// user/IP buckets. With Redis these share via the `rl:user:`/`rl:ip:` keys; the
// in-memory maps keep that sharing intact in the Redis-down fallback too.
const _llmUserRateLimitMap: MemCounter = new Map();
const _llmIpRateLimitMap: MemCounter = new Map();

/**
 * Apply the per-user + per-IP LLM rate limit for a 60s window and write the
 * X-RateLimit-* headers. Throws a 429 when either limit is exceeded.
 */
export async function enforceLlmRateLimit(
  event: any,
  userId: string,
  options: { userMax: number; ipMax: number }
): Promise<void> {
  const now = Date.now();
  const windowMs = WINDOW_SEC * 1000;
  const userRemaining = await applyLimit(
    `rl:user:${userId}`,
    options.userMax,
    _llmUserRateLimitMap,
    now,
    windowMs
  );
  const clientIp = getClientIp(event);
  const ipRemaining = await applyLimit(
    `rl:ip:${clientIp}`,
    options.ipMax,
    _llmIpRateLimitMap,
    now,
    windowMs
  );
  setRateLimitHeaders(
    event,
    Math.min(userRemaining, ipRemaining),
    userRemaining,
    ipRemaining,
    now
  );
}
