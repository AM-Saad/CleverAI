# Cognilo Development Guide

> Developer setup, commands, debugging, and contribution guidelines.  
> **Last Updated**: Based on source code analysis

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Common Commands](#common-commands)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Debugging Tools](#debugging-tools)
7. [Testing](#testing)
8. [Service Worker Development](#service-worker-development)
9. [Database Management](#database-management)
10. [Code Patterns & Conventions](#code-patterns--conventions)

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd cognilo-ai
yarn install

# 2. Setup environment
cp .env.example .env
# Edit .env with your values

# 3. Sync database
yarn db:sync

# 4. Build service worker + start dev
yarn dev
```

**Dev server**: http://localhost:3000

---

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL="mongodb+srv://..."

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# LLM Providers (at least one required)
OPENAI_API_KEY="sk-..."
GOOGLE_GENERATIVE_AI_API_KEY="..."

# Push Notifications
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:your@email.com"
```

### Optional Environment Variables

```bash
# Redis (rate limiting - falls back to in-memory)
REDIS_URL="redis://localhost:6379"

# Cron jobs
ENABLE_CRON="true"
CRON_SECRET_TOKEN="your-cron-secret"

# Debug
DEBUG_MODE="true"
```

### Nuxt Dev Server Checks

The following env vars are checked on startup (`nuxt.config.ts` → `hooks.ready`):
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

Missing vars show warnings but don't fail startup.

---

## Common Commands

### Development

```bash
# Start dev server (builds SW first)
yarn dev

# Build for production
yarn build
# or with SW injection
yarn build:inject

# Preview production build
yarn preview

# Type checking
yarn typecheck
```

### Database

```bash
# Sync schema to MongoDB (no migrations)
yarn db:sync

# Open Prisma Studio
yarn db:studio

# Seed sample data
yarn db:seed
```

### Service Worker

```bash
# Build service worker only
yarn sw:build

# Check SW placeholder exists
yarn sw:check-placeholder
```

### Code Quality

```bash
# Lint check
yarn lint

# Lint fix
yarn lintfix

# Format code
yarn format

# Pre-commit checks
yarn pre-commit
```

### Testing

```bash
# Playwright PWA offline tests
yarn test:pwa-offline

# Run specific test file
npx playwright test tests/auth-flow.spec.ts
```

---

## Project Structure

### Source Directories

```
app/                    # Nuxt srcDir - all frontend code
├── components/         # Vue components (auto-imported)
├── composables/        # Vue composables (auto-imported)
├── domain/             # DDD domain logic
├── layouts/            # Page layouts
├── middleware/         # Route middleware
├── pages/              # File-based routing
├── plugins/            # Nuxt plugins
├── services/           # API service layer
├── types/              # TypeScript definitions
└── utils/              # Utility functions

server/                 # Nitro server
├── api/                # API routes (/api/*)
├── middleware/         # Server middleware
├── plugins/            # Server plugins
├── prisma/             # Prisma schema
├── services/           # Business logic services
├── tasks/              # Scheduled tasks
└── utils/              # Server utilities

shared/                 # Shared between client/server
├── *.contract.ts       # Zod schemas
├── types/              # Shared types
└── utils/              # Shared utilities

sw-src/                 # Service worker source
└── index.ts            # Workbox + push handlers
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `nuxt.config.ts` | Nuxt configuration |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `server/prisma/schema.prisma` | Database schema |
| `playwright.config.ts` | E2E test config |
| `eslint.config.mjs` | Linting rules |
| `components.json` | shadcn-vue config |

---

## Development Workflow

### Adding a New Feature

1. **Define contract** in `shared/*.contract.ts`:
```typescript
// shared/feature.contract.ts
export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type Feature = z.infer<typeof FeatureSchema>
```

2. **Add database model** in `server/prisma/schema.prisma`:
```prisma
model Feature {
  id   String @id @default(auto()) @map("_id") @db.ObjectId
  name String
}
```

3. **Create API endpoint** in `server/api/`:
```typescript
// server/api/features/index.get.ts
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401 })
  
  return prisma.feature.findMany({ where: { userId: user.id } })
})
```

4. **Add service** in `app/services/`:
```typescript
// app/services/FeatureService.ts
export class FeatureService {
  constructor(private fetch: FetchFactory) {}
  
  async getAll() {
    return this.fetch.call(() => 
      $fetch('/api/features')
    )
  }
}
```

5. **Create composable** in `app/composables/`:
```typescript
// app/composables/useFeatures.ts
export function useFeatures() {
  const { $api } = useNuxtApp()
  
  return useDataFetch('features', () => $api.features.getAll())
}
```

6. **Build UI component** in `app/components/`:
```vue
<!-- app/components/feature/FeatureList.vue -->
<script setup lang="ts">
const { data: features, pending } = useFeatures()
</script>
```

### Modifying Existing Code

1. Find the feature entry point (page or component)
2. Trace data flow: Component → Composable → Service → API
3. Check shared contracts for type definitions
4. Make changes, run `yarn typecheck`
5. Test locally, then run `yarn lint`

---

## Debugging Tools

### Floating Debug Panel

**Access Methods**:
- Purple beaker icon (bottom-right in dev)
- Keyboard: `Ctrl/Cmd + Shift + D`
- URL: `?debug=true`

**Features**:
- System status (server time, timezone)
- Quick actions for all major systems
- Preset test scenarios
- Console helper commands

### Service Worker Debug

```typescript
// Browser console - check SW status
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => {
    console.log('State:', reg.active?.state)
    console.log('Script:', reg.active?.scriptURL)
  })
})

// Test SW messages
navigator.serviceWorker.controller?.postMessage({
  type: 'TEST_MESSAGE',
  payload: { test: true }
})

// Force SW update
navigator.serviceWorker.getRegistration().then(reg => {
  reg?.update()
})
```

### Spaced Repetition Debug

Access via gear icon during card review:
- Apply custom SM-2 values
- Reset card state
- Load preset scenarios (new card, learning, difficult)
- Test algorithm calculations

### Network Debugging

```bash
# Enable MongoDB query profiling
mongosh
> use cognilo-ai
> db.setProfilingLevel(2)
> db.system.profile.find().sort({ts: -1}).limit(10)
```

### Console Helpers

```javascript
// Check IndexedDB stores
const db = await indexedDB.open('cognilo-ai-db', 8)
db.onsuccess = (e) => {
  const stores = e.target.result.objectStoreNames
  console.log('Stores:', Array.from(stores))
}

// Check push subscription
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Push subscription:', sub?.toJSON())
  })
})
```

---

## Testing

### Test Stack

- **Playwright** - E2E and PWA tests
- Manual testing guides in `debug-archive/`

### Running Tests

```bash
# All PWA offline tests
yarn test:pwa-offline

# Specific test file
npx playwright test tests/pwa-offline-basic.spec.ts

# Debug mode (headed browser)
npx playwright test --debug
```

### Test Files

```
tests/
├── auth-flow.spec.ts       # Authentication flows
├── pwa-offline-basic.spec.ts  # Basic offline tests
├── pwa-offline.spec.ts     # Comprehensive PWA tests
├── auth/                   # Auth-specific tests
└── server/                 # API tests
```

### Manual Testing Scenarios

**Offline Testing**:
1. Open DevTools → Network → "Offline"
2. Navigate app (should work from cache)
3. Edit notes (should queue to IndexedDB)
4. Re-enable network
5. Verify sync occurs

**Push Notification Testing**:
```bash
# Test via cron endpoint
curl -X POST http://localhost:3000/api/cron/send-notifications \
  -H "x-cron-secret: $CRON_SECRET_TOKEN"
```

---

## Service Worker Development

### Build Pipeline

```
sw-src/index.ts
      ↓ (esbuild)
public/sw.js
      ↓ (inject-sw.cjs)
Production build with hashed assets
```

### Development Cycle

1. Edit `sw-src/index.ts`
2. Run `yarn sw:build`
3. Refresh browser
4. Check for update notification
5. Test update flow

### Key SW Features

**Caching** (Workbox):
```typescript
// NetworkFirst for API
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache' })
)
```

**Push Handling**:
```typescript
self.addEventListener('push', (event) => {
  const data = event.data?.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url }
    })
  )
})
```

**Background Sync**:
```typescript
self.addEventListener('sync', (event) => {
  if (event.tag === 'notes-sync') {
    event.waitUntil(syncNotes())
  }
})
```

### IndexedDB Management

```typescript
// SW IndexedDB stores
const DB_NAME = 'cognilo-ai-db'
const DB_VERSION = 8

const stores = {
  forms: 'forms',           // Offline form queue
  notes: 'notes',           // Notes cache
  pendingNotes: 'pendingNotes' // Unsaved changes
}
```

---

## Database Management

### Schema Changes

```bash
# 1. Edit schema.prisma
# 2. Sync to database
yarn db:sync

# 3. Generate Prisma Client
npx prisma generate
```

### Common Operations

```bash
# View data in browser
yarn db:studio

# Reset database (DANGER - drops all data)
npx prisma db push --force-reset

# Seed sample data
yarn db:seed
```

### Migration Scripts

Located in `scripts/`:
- `cleanup-orphaned-cardreviews.ts`
- `cleanup-orphaned-preferences.ts`
- `annotate-cardreview-resourcetype.ts`
- `update-notes-order.ts`

Run with:
```bash
npx tsx scripts/script-name.ts
```

---

## Code Patterns & Conventions

### API Response Format

```typescript
// Success (envelope format)
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input'
  }
}
```

### Error Handling

**Server**:
```typescript
throw createError({
  statusCode: 400,
  statusMessage: 'Bad Request',
  data: { code: 'VALIDATION_ERROR' }
})
```

**Client (FetchFactory)**:
```typescript
const result = await $api.service.method()
if (!result.success) {
  // result.error is APIError
  console.error(result.error.code, result.error.message)
}
```

### Composables Pattern

```typescript
// Data fetching
export function useFeatures() {
  const { $api } = useNuxtApp()
  return useDataFetch('features', () => $api.features.getAll())
}

// Operations
export function useFeatureOperations() {
  const createOp = useOperation()
  
  const create = (data) => createOp.execute(() => 
    $api.features.create(data)
  )
  
  return {
    create,
    creating: createOp.pending,
    createError: createOp.typedError
  }
}
```

### LLM Strategy Pattern

```typescript
// Adding new provider
// 1. Create strategy
export class NewProviderStrategy implements LLMStrategy {
  async generate(messages, options, onMeasure) {
    // Implementation
    onMeasure?.({ promptTokens, completionTokens, model })
    return result
  }
}

// 2. Register in factory
// server/utils/llm/LLMFactory.ts
const strategies = {
  'gpt-3.5-turbo': GPT35Strategy,
  'gemini-2.0-flash-lite': GeminiStrategy,
  'new-model': NewProviderStrategy,
}
```

### Contract-First Development

1. Define Zod schema in `shared/`
2. Use for both client validation and server parsing
3. Export inferred TypeScript types

```typescript
// shared/feature.contract.ts
import { z } from 'zod'

export const CreateFeatureSchema = z.object({
  name: z.string().min(1).max(100),
})

export const FeatureSchema = CreateFeatureSchema.extend({
  id: z.string(),
  createdAt: z.date(),
})

export type Feature = z.infer<typeof FeatureSchema>
export type CreateFeature = z.infer<typeof CreateFeatureSchema>
```

---

## Git Workflow

### Pre-commit Hooks

Husky + lint-staged configured:
```bash
# Install hooks
yarn pre-commit

# Runs on commit:
# - ESLint on staged files
# - Prettier formatting
```

### Branch Naming

```
feature/feature-name
fix/bug-description
chore/task-description
```

### Commit Messages

Follow conventional commits:
```
feat: add new feature
fix: resolve bug
chore: update dependencies
docs: improve documentation
refactor: restructure code
```

---

## Troubleshooting

### Common Issues

**"NEXTAUTH_SECRET required"**:
```bash
# Generate secret
openssl rand -base64 32
# Add to .env
NEXTAUTH_SECRET="generated-secret"
```

**Service Worker not updating**:
```javascript
// Force unregister all SWs
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister())
})
// Clear caches
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key))
})
// Hard refresh
location.reload(true)
```

**Prisma Client outdated**:
```bash
npx prisma generate
# Restart dev server
```

**IndexedDB errors**:
```javascript
// Delete database
indexedDB.deleteDatabase('cognilo-ai-db')
// Refresh page
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- **[FEATURES.md](./FEATURES.md)** - Feature documentation
- **[MAINTENANCE.md](./MAINTENANCE.md)** - Operations and known issues
