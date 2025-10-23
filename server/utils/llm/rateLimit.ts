import { createError } from "h3";
import { useRuntimeConfig } from "#imports";
import Redis from "ioredis";

export type MemCounter = Map<string, { count: number; timestamp: number }>;

// Window size shared across helpers
export const WINDOW_SEC = 60;

// Optional Redis-backed limiter (preferred in production)
let redisClient: Redis | null = null;
export function getRedisClient(): Redis | null {
  try {
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
    // basic error logging to avoid 'Unhandled error event'
    redisClient.on("error", (err: any) => {
      console.error("[rateLimit][redis] error:", err?.message || err);
    });
    return redisClient;
  } catch (e) {
    console.error("[rateLimit] Redis init failed, falling back to memory:", e);
    redisClient = null;
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
    console.warn(
      "[rateLimit] Redis unavailable, falling back to memory:",
      (e as any)?.message || e
    );
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
