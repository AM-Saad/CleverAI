# Cognilo Maintenance & Operations

> Known issues, technical debt, security considerations, and roadmap.  
> **Last Updated**: Based on source code analysis

---

## Table of Contents
1. [Critical Issues](#critical-issues)
2. [Security Considerations](#security-considerations)
3. [Technical Debt](#technical-debt)
4. [Performance Optimizations](#performance-optimizations)
5. [Operations Guide](#operations-guide)
6. [Monitoring & Observability](#monitoring--observability)
7. [Roadmap](#roadmap)

---

## Critical Issues

### 🔴 CRITICAL: FetchFactory Retry Logic Broken

**Location**: `app/services/FetchFactory.ts`

**Issue**: Retry logic never executes because `attempt` is declared with `const`:
```typescript
// BROKEN - attempt never increments
const attemptLimit = this.retries + 1
const attempt = 0  // ← Should be `let`
while (attempt < attemptLimit) {
  // ... retry logic ...
  // attempt++ has no effect
}
```

**Impact**: 
- All API calls fail on first error
- No retry for transient failures (429, 503)
- Poor UX during network hiccups

**Fix**:
```typescript
let attempt = 0  // Change const to let
```

**Priority**: P0 - Fix immediately

---

### 🔴 CRITICAL: Exposed Google Client Secret

**Location**: `nuxt.config.ts` (approximately line 286)

**Issue**: `GOOGLE_CLIENT_SECRET` is exposed in public runtime config:
```typescript
public: {
  // ... other config ...
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET, // ← DANGER
}
```

**Impact**:
- Secret visible in client-side JavaScript
- OAuth security compromised
- Potential account takeover

**Fix**:
Move to `runtimeConfig.private` (server-only):
```typescript
runtimeConfig: {
  private: {
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
  public: {
    // Only non-sensitive values
  }
}
```

**Priority**: P0 - Fix immediately, rotate secret

---

### 🟡 HIGH: Rate Limit Header Bug

**Location**: `server/utils/llm/rateLimit.ts`

**Issue**: `Retry-After` header calculation mixes units:
```typescript
// resetTime is in milliseconds, but Retry-After expects seconds
headers.set('Retry-After', String(resetTime))
```

**Impact**:
- Clients wait way too long (1000x intended)
- Poor rate-limited user experience

**Fix**:
```typescript
headers.set('Retry-After', String(Math.ceil(resetTime / 1000)))
```

**Priority**: P1 - Fix soon

---

## Security Considerations

### Authentication

| Area | Status | Notes |
|------|--------|-------|
| Password hashing | ✅ Good | bcrypt with proper rounds |
| Session management | ✅ Good | JWT in httpOnly cookie |
| CSRF protection | ⚠️ Review | Relies on SameSite cookies |
| Rate limiting auth | ⚠️ Missing | No brute-force protection |

**Recommendations**:
1. Add rate limiting to `/api/auth/*` endpoints
2. Implement account lockout after failed attempts
3. Add CSRF tokens for sensitive operations

### Authorization

| Area | Status | Notes |
|------|--------|-------|
| Resource ownership | ✅ Fixed | Folder ownership verified |
| API protection | ✅ Good | Session checked on all routes |
| Admin routes | ✅ N/A | No admin functionality |

### Data Protection

| Area | Status | Notes |
|------|--------|-------|
| XSS prevention | ✅ Good | Vue's v-text, sanitization available |
| SQL injection | ✅ N/A | Prisma with parameterized queries |
| Input validation | ✅ Good | Zod schemas on all inputs |
| Secrets management | 🔴 Issue | GOOGLE_CLIENT_SECRET exposed |

### Service Worker Security

| Area | Status | Notes |
|------|--------|-------|
| Debug mode | ⚠️ Risk | `?debug=true` enables extra logging |
| Cache poisoning | ✅ Good | Proper cache key strategies |
| Push auth | ✅ Good | VAPID keys properly configured |

**Recommendation**: Remove debug querystring in production builds.

---

## Technical Debt

### High Priority

#### 1. Duplicated Token Estimation
**Location**: `server/utils/llm/GPT35Strategy.ts`, `GeminiStrategy.ts`

**Issue**: Token estimation duplicated 4x across strategies:
```typescript
// Same code in multiple places
const estimatedTokens = Math.ceil(text.length / 4)
```

**Recommendation**: Extract to shared utility:
```typescript
// server/utils/llm/tokenEstimation.ts
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

#### 2. Monolithic Service Worker
**Location**: `sw-src/index.ts` (1011 lines)

**Issue**: Single file handling caching, push, sync, IndexedDB

**Recommendation**: Split into modules:
```
sw-src/
├── index.ts           # Entry point, event registration
├── caching.ts         # Workbox caching strategies
├── push.ts            # Push notification handlers
├── sync.ts            # Background sync logic
├── idb.ts             # IndexedDB operations
└── utils.ts           # Shared utilities
```

#### 3. Hardcoded Model Names
**Location**: LLM strategies

**Issue**: Model names hardcoded in strategy implementations:
```typescript
model: 'gpt-3.5-turbo'  // Hardcoded
```

**Recommendation**: Use config or registry:
```typescript
const model = config.openai.defaultModel || 'gpt-3.5-turbo'
```

### Medium Priority

#### 4. Missing Request Timeouts
**Location**: LLM strategies

**Issue**: No timeouts on LLM API calls - can hang indefinitely

**Recommendation**: Add AbortController with timeout:
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000)

try {
  const response = await fetch(url, { signal: controller.signal })
} finally {
  clearTimeout(timeout)
}
```

#### 5. No Centralized Error Logging
**Issue**: Errors logged to console, no aggregation

**Recommendation**: Add error tracking service (Sentry, etc.):
```typescript
// plugins/error-tracking.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:error', (error) => {
    errorTracker.capture(error)
  })
})
```

#### 6. Inconsistent API Response Format
**Issue**: Some endpoints return data directly, others use envelope

**Recommendation**: Standardize on envelope format:
```typescript
// Success
{ success: true, data: { ... } }

// Error  
{ success: false, error: { code: '...', message: '...' } }
```

### Low Priority

#### 7. Missing Database Indexes
**Potential**: Some queries may be slow without proper indexes

**Recommendation**: Review slow queries and add indexes:
```prisma
model Note {
  // ...
  @@index([folderId, order])  // For ordered listing
}
```

#### 8. No API Versioning
**Issue**: Breaking changes affect all clients

**Recommendation**: Add version prefix:
```
/api/v1/folders
/api/v2/folders  // New version
```

---

## Performance Optimizations

### Completed Optimizations

| Optimization | Location | Impact |
|--------------|----------|--------|
| N+1 query fix | `/api/review/queue.get.ts` | 7x faster |
| Upsert for enrollment | `/api/review/enroll.post.ts` | Prevents duplicates |
| Transaction for grading | `/api/review/grade.post.ts` | Data consistency |

### Recommended Optimizations

#### 1. Add Response Caching
```typescript
// For read-heavy endpoints
export default defineCachedEventHandler(async (event) => {
  // Handler code
}, {
  maxAge: 60,  // 1 minute cache
  swr: true,   // Stale-while-revalidate
})
```

#### 2. Implement Connection Pooling
```typescript
// prisma/client.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
})
```

#### 3. Lazy Load Heavy Components
```vue
<script setup>
const HeavyComponent = defineAsyncComponent(() => 
  import('~/components/HeavyComponent.vue')
)
</script>
```

#### 4. Image Optimization
```vue
<!-- Use Nuxt Image -->
<NuxtImg
  src="/image.jpg"
  width="300"
  height="200"
  format="webp"
  loading="lazy"
/>
```

---

## Operations Guide

### Database Operations

#### Backup
```bash
# MongoDB dump
mongodump --uri="$DATABASE_URL" --out=./backup-$(date +%Y%m%d)

# Restore
mongorestore --uri="$DATABASE_URL" ./backup-20240101
```

#### Schema Changes
```bash
# 1. Edit schema.prisma
# 2. Sync to database (no migrations for MongoDB)
yarn db:sync

# 3. Generate client
npx prisma generate

# 4. Restart server
```

#### Data Cleanup Scripts
```bash
# Remove orphaned CardReviews
npx tsx scripts/cleanup-orphaned-cardreviews.ts

# Clean orphaned preferences
npx tsx scripts/cleanup-orphaned-preferences.ts

# Fix note ordering
npx tsx scripts/update-notes-order.ts
```

### Service Worker Management

#### Force Update for All Users
```javascript
// In sw-src/index.ts, update CACHE_VERSION
const CACHE_VERSION = 'v2'  // Increment this
```

#### Clear Problematic Caches
```javascript
// Browser console
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key))
})
```

### Push Notification Operations

#### Test Notifications
```bash
# Via cron endpoint
curl -X POST http://localhost:3000/api/cron/send-notifications \
  -H "x-cron-secret: $CRON_SECRET_TOKEN"
```

#### Debug Subscription Issues
```javascript
// Check user's subscriptions
const subs = await prisma.userSubscription.findMany({
  where: { userId: 'user-id' }
})
console.log('Active subscriptions:', subs)
```

### Cron Jobs

#### Enable Cron
```bash
# .env
ENABLE_CRON=true
CRON_SECRET_TOKEN=your-secret-token
```

#### Manual Trigger
```bash
# Send due notifications
curl -X POST http://localhost:3000/api/cron/send-notifications \
  -H "x-cron-secret: $CRON_SECRET_TOKEN"
```

---

## Monitoring & Observability

### Key Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| API response time | Logs | > 2s average |
| LLM error rate | LlmUsage | > 5% |
| Push delivery rate | Notification logs | < 90% |
| Auth failures | Auth logs | > 10/min |
| Database connections | Prisma | > 80% pool |

### Logging Strategy

**Current State**: Console logging only

**Recommended Structure**:
```typescript
// Structured logging
logger.info('llm.generate', {
  userId,
  model,
  promptTokens,
  completionTokens,
  latencyMs,
})

logger.error('llm.generate.failed', {
  userId,
  model,
  error: error.message,
  stack: error.stack,
})
```

### Health Checks

```typescript
// Add health endpoint
// server/api/health.get.ts
export default defineEventHandler(async () => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    llm: await checkLLMProviders(),
  }
  
  const healthy = Object.values(checks).every(c => c.status === 'ok')
  
  return {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }
})
```

---

## Roadmap

### Phase 1: Stability (Immediate)

| Task | Priority | Effort |
|------|----------|--------|
| Fix FetchFactory retry bug | P0 | 1h |
| Move GOOGLE_CLIENT_SECRET to private config | P0 | 30m |
| Fix Retry-After header units | P1 | 30m |
| Add auth rate limiting | P1 | 2h |

### Phase 2: Code Quality (1-2 weeks)

| Task | Priority | Effort |
|------|----------|--------|
| Extract token estimation utility | P2 | 1h |
| Split service worker into modules | P2 | 4h |
| Standardize API response format | P2 | 3h |
| Add request timeouts to LLM calls | P2 | 2h |

### Phase 3: Observability (2-4 weeks)

| Task | Priority | Effort |
|------|----------|--------|
| Add structured logging | P2 | 4h |
| Implement health check endpoint | P2 | 2h |
| Add error tracking (Sentry) | P2 | 3h |
| Performance monitoring | P3 | 4h |

### Phase 4: Features (Ongoing)

| Feature | Description |
|---------|-------------|
| Collaborative folders | Share folders with other users |
| AI study plans | Auto-generated study schedules |
| Mobile apps | React Native or Flutter |
| Offline flashcard review | Full SR functionality offline |
| Import/Export | Anki, Quizlet compatibility |

### Phase 5: Scale (As Needed)

| Task | Trigger |
|------|---------|
| Database sharding | > 100k users |
| CDN for static assets | > 10k daily actives |
| LLM request queue | > 1k concurrent requests |
| Horizontal scaling | CPU > 80% sustained |

---

## Security Fixes Applied

### Previously Fixed Issues

| Issue | Status | Details |
|-------|--------|---------|
| Enrollment race condition | ✅ Fixed | Upsert with unique constraint |
| Grade transaction missing | ✅ Fixed | Wrapped in $transaction |
| Grade idempotency | ✅ Fixed | GradeRequest model |
| Notification scheduling race | ✅ Fixed | Added cardId filter |
| Folder authorization bypass | ✅ Fixed | Ownership check added |
| IndexedDB failure silent | ✅ Fixed | ensureDB() with retry |
| SW update listener leak | ✅ Fixed | Listener cleanup on unmount |
| N+1 query in queue | ✅ Fixed | Single folder query |

### Database Schema Updates

```prisma
// Added unique constraints
@@unique([userId, cardId])  // CardReview

// Added indexes
@@index([userId, type, cardId, sent])  // ScheduledNotification

// New model for idempotency
model GradeRequest {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  requestId   String   @unique
  userId      String
  cardId      String
  grade       Int
  processedAt DateTime @default(now())
}
```

---

## Emergency Procedures

### Database Connection Issues
```bash
# 1. Check MongoDB status
mongosh "$DATABASE_URL" --eval "db.serverStatus()"

# 2. Restart application
pm2 restart cognilo-ai

# 3. Check connection pool
# In application logs, look for connection errors
```

### Service Worker Breaking Users
```javascript
// Emergency SW removal script
// Run in browser console

// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister())
})

// 2. Clear all caches
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key))
})

// 3. Clear IndexedDB
indexedDB.deleteDatabase('cognilo-ai-db')

// 4. Hard refresh
location.reload(true)
```

### LLM Provider Outage
```typescript
// Gateway automatically falls back between providers
// Manual override:
// Set OPENAI_API_KEY="" to force Gemini
// Set GOOGLE_GENERATIVE_AI_API_KEY="" to force OpenAI
```

### Push Notification Issues
```bash
# 1. Check VAPID keys match
echo $VAPID_PUBLIC_KEY | base64 -d | xxd

# 2. Test push manually
npx web-push send-notification \
  --endpoint="$ENDPOINT" \
  --key="$AUTH_KEY" \
  --auth="$P256DH" \
  --payload='{"title":"Test"}'

# 3. Check subscription validity
curl -I "$PUSH_ENDPOINT"
# 410 Gone = subscription expired
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Setup and debugging
- **[FEATURES.md](./FEATURES.md)** - Feature documentation
