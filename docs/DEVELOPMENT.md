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
# Start dev server (builds AI worker first) — single-surface, port 8080
yarn dev

# Surface-scoped dev servers (see docs/architecture/app-surfaces.md)
yarn dev:platform   # APP_SURFACE=platform, port 8080
yarn dev:daily      # APP_SURFACE=daily, port 8081
yarn dev:learning   # APP_SURFACE=learning, port 8082

# Static site generation
yarn generate

# Preview production build
yarn preview

# Type checking
yarn typecheck
```

### Building & Running

```bash
# Production build (SW + AI worker build/check, icons, nuxt build, SW injection)
yarn build
# same command, explicit name:
yarn build:inject

# Surface-scoped production builds
yarn build:platform
yarn build:daily
yarn build:learning

# Runs sw:build/sw:check/ai-worker:build/ai-worker:check/generate:icons
# (invoked automatically by build:inject/preview; rarely run standalone)
yarn prebuild

# Run an already-built app
yarn start
yarn start:platform
yarn start:daily
yarn start:learning

# Runs automatically after `yarn install`: generates the Prisma client + `nuxt prepare`
yarn postinstall

# Installs Husky git hooks (also invoked by yarn pre-commit)
yarn prepare
```

### Realtime Collaboration

```bash
# Hocuspocus/Yjs collab server (server/collab-server.ts) — run this locally
# alongside `yarn dev` for realtime note collaboration to work
yarn collab:dev
yarn collab:start
```

### Database

```bash
# Generate Prisma client + push schema to MongoDB (no migrations)
yarn db:sync

# Generate Prisma client only
yarn db:generate

# Open Prisma Studio
yarn db:studio

# Seed sample data
yarn db:seed
```

### Service Worker & AI Worker

```bash
# Build service worker only (sw-src/index.ts -> public/sw.js)
yarn sw:build

# Verify the SW placeholder comment is present (scripts/check-sw-placeholder.cjs)
yarn sw:check

# Build the AI worker bundle (sw-src/ai-worker.ts -> public/ai-worker.js)
yarn ai-worker:build

# Verify the AI worker build (scripts/check-ai-worker.cjs)
yarn ai-worker:check
```

### Code Generation

```bash
# Regenerate PWA icons
yarn generate:icons

# Regenerate the typed API client from server routes/contracts
yarn generate:api

# Regenerate sitemap
yarn sitemap
```

### Code Quality

```bash
# Lint check (eslint + prettier --check)
yarn lint
yarn lint:eslint
yarn lint:prettier

# Lint fix (eslint --fix + prettier --write)
yarn lintfix

# Format code
yarn format

# Install hooks + run lint-staged (what Husky's pre-commit hook runs)
yarn pre-commit

# Layer/import boundary check (scripts/check-architecture-boundaries.cjs)
yarn arch:check

# Unit tests
yarn test:unit
```

### Design System

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) and [COMPONENT_SYSTEM.md](./COMPONENT_SYSTEM.md) for what each gate enforces.

```bash
# Regenerate tokens.generated.{css,ts} from app/design-system/tokens/index.cjs
yarn design:tokens
# Check generated tokens are up to date, without writing
yarn design:tokens:check

# Token-usage gate (no raw hex/palette classes/built-in rounded|shadow)
yarn design:check

# Component-boundary gate (Ui* wrappers vs raw Nuxt UI / raw HTML elements)
yarn design:boundaries

# Interactive-state coverage check
yarn design:states

# Primitive state-coverage / unused-primitive checks
yarn design:primitives
yarn design:primitives:unused

# Component API-contract check
yarn design:api

# WCAG AA contrast check
yarn design:contrast

# Reports (docs/component-audit/, etc.)
yarn design:audit
yarn design:components
```

### Testing

```bash
# Playwright PWA offline tests
yarn test:pwa-offline

# Run specific test file
npx playwright test tests/auth-flow.spec.ts
```

### Maintenance Scripts

```bash
# Backfill offline-v2 entities (scripts/migrations/backfill-offline-v2.ts)
yarn offline:backfill

# Clean up stale push-notification subscriptions
yarn notifications:cleanup
```

---

## Project Structure

### Source Directories

```
app/                    # Nuxt srcDir - all frontend code
├── components/         # Vue components (auto-imported)
├── composables/        # Vue composables (auto-imported)
├── domain/             # DDD domain logic
├── features/           # Feature-local code (components/composables/domain/services) — see below
├── layouts/            # Page layouts
├── middleware/         # Route middleware
├── pages/              # File-based routing
├── plugins/            # Nuxt plugins
├── services/           # API service layer (older flat/type-first layout)
├── types/              # TypeScript definitions
└── utils/              # Utility functions

server/                 # Nitro server
├── api/                # API routes (/api/*)
├── middleware/         # Server middleware
├── modules/            # Feature-local server code, mirrors app/features/ — see below
├── plugins/            # Server plugins
├── services/           # Business logic services (older flat layout)
├── tasks/              # Scheduled tasks
└── utils/              # Server utilities

prisma/                 # Prisma schema + seed — root-level, NOT under server/
└── schema.prisma       # MongoDB schema, synced via `yarn db:sync` (db push, no migrations)

shared/                 # Shared between client/server
├── utils/*.contract.ts # Zod schemas (authoritative request/response shapes)
├── types/              # Shared types
└── utils/              # Shared utilities

sw-src/                 # Service worker source
└── index.ts            # Workbox + push handlers
```

`app/features/<feature>/` and `server/modules/<feature>/` are the canonical, newer home for feature code — e.g. `board`, `daily`, `notes`, `review`, `language-learning`, `materials`, `notifications` — each with its own `components/`, `composables/`, `domain/`, `presentation/`, `repositories/`/`application/`, instead of the older flat `app/components/`, `app/composables/`, `app/services/`, `server/services/` layout. `app/features/**` is **not** auto-imported (unlike `app/components/**`); import explicitly from `~/features/<feature>/...`. See [Adding a New Feature](#adding-a-new-feature) below for the worked example.

### Key Configuration Files

| File | Purpose |
|------|---------|
| `nuxt.config.ts` | Nuxt configuration |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config |
| `prisma/schema.prisma` | Database schema (root-level — there is no `server/prisma/`) |
| `playwright.config.ts` | E2E test config |
| `eslint.config.mjs` | Linting rules |
| `components.json` | shadcn-vue config |

---

## Development Workflow

### Adding a New Feature

New features live under `app/features/<feature>/` (client) and `server/modules/<feature>/` (server) — **not** the older flat `app/services/` / `app/composables/` / `app/components/` layout. The worked example below follows `daily`, the newest feature (`app/features/daily/`, `server/modules/daily/`).

1. **Define the contract** in `shared/utils/<feature>.contract.ts` (Zod schema, authoritative for both client and server — see `shared/utils/daily.contract.ts`):
```typescript
// shared/utils/feature.contract.ts
export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type FeatureDTO = z.infer<typeof FeatureSchema>
```

2. **Add a database model** in `prisma/schema.prisma` (root-level — there is no `server/prisma/`):
```prisma
model Feature {
  id   String @id @default(auto()) @map("_id") @db.ObjectId
  name String
}
```

3. **Add server-side domain/application logic** in `server/modules/<feature>/domain/` and `server/modules/<feature>/application/` (e.g. `server/modules/daily/domain/ensureOccurrence.ts`), then call it from an API route in `server/api/<feature>/`:
```typescript
// server/api/features/index.get.ts
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401 })

  return prisma.feature.findMany({ where: { userId: user.id } })
})
```

4. **Add a local repository + composable** in `app/features/<feature>/repositories/` and `app/features/<feature>/composables/` (mirrors `app/features/daily/repositories/dailyLocalRepository.ts` + `app/features/daily/composables/useDaily.ts`). Feature-internal files use **explicit imports** for anything outside Nuxt/Vue's own globals — sibling subfolders via relative paths, shared contracts via the `@shared`/`~/shared` alias:
```typescript
// app/features/feature/composables/useFeature.ts
import type { FeatureDTO } from "@shared/utils/feature.contract"
import { getFeatureSnapshot } from "../repositories/featureLocalRepository"

export function useFeature() {
  const { $api } = useNuxtApp() // Nuxt/Vue globals (ref, useNuxtApp, ...) stay auto-imported everywhere
  return useDataFetch('features', () => $api.features.getAll())
}
```

5. **Add domain/presentation helpers** where useful — pure logic in `app/features/<feature>/domain/` (e.g. `projectLocalDay.ts`), view-model shaping in `app/features/<feature>/presentation/` (e.g. `dailyActionViewModel.ts`).

6. **Build the UI component** in `app/features/<feature>/components/`. `app/features/**` is **not** auto-imported (unlike `app/components/**`), so pages/containers import it explicitly by path — the real pattern used in `app/pages/day/[date].vue`:
```vue
<script setup lang="ts">
import DailyActionSection from "~/features/daily/components/DailyActionSection.vue"
import { useDaily } from "~/features/daily/composables/useDaily"
</script>
```

7. **Keep an old auto-imported name working, if one existed**: if the feature previously had an auto-imported composable/service under the flat layout, leave a thin re-export shim in the old location instead of touching every call site. This is a real existing pattern — `app/composables/board/useBoardColumnsStore.ts` in full:
```typescript
export {
  useBoardColumnsStore,
  cleanupBoardColumnsStore,
  type BoardColumnState,
} from "~/features/board/composables/useBoardColumnsStore";
```
A brand-new feature with no pre-existing name to preserve (e.g. `daily`) skips this step entirely.

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
// Check IndexedDB stores (name/version source of truth: app/utils/constants/pwa.ts DB_CONFIG)
const db = await indexedDB.open('recwide_db', 20)
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
├── auth-flow.spec.ts          # Authentication flows
├── pwa-offline-basic.spec.ts  # Basic offline tests (run by yarn test:pwa-offline)
├── pwa-offline.spec.ts        # Comprehensive PWA tests
└── server/                    # Server-side/service tests (notifications, review, sm2, ...)
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
// IndexedDB name/version/stores — single source of truth is
// app/utils/constants/pwa.ts (DB_CONFIG). Do not hardcode these elsewhere.
import { DB_CONFIG } from '~/utils/constants/pwa'

DB_CONFIG.NAME    // 'recwide_db'
DB_CONFIG.VERSION // 20 — bump whenever a store is added/changed; see the
                  // version-history comment above DB_CONFIG in that file
DB_CONFIG.STORES  // 19 stores as of this writing: FORMS, NOTES, NOTE_GROUPS,
                  // PENDING_NOTES, PENDING_NOTE_GROUP_CHANGES,
                  // PENDING_NOTE_LAYOUTS, NOTE_SYNC_CONFLICTS, BOARD_ITEMS,
                  // PENDING_BOARD_ITEMS, BOARD_COLUMNS, USER_TAGS,
                  // OFFLINE_ENTITIES, OFFLINE_MUTATIONS, OFFLINE_CONFLICTS,
                  // OFFLINE_PACKS, OFFLINE_BLOBS, OFFLINE_SESSIONS,
                  // OFFLINE_SYNC_META, OFFLINE_LEGACY_RECOVERY
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

One-off data-migration script in `scripts/`:
- `annotate-cardreview-resourcetype.ts`

Versioned migrations in `scripts/migrations/`:
- `backfill-offline-v2.ts` (also runnable via `yarn offline:backfill`)
- `dedupe-offline-mutation-receipts.ts`
- `migrate-board-notes-to-board-items.ts`
- `migrate-note-types.ts`
- `migrate-workspace.ts`

Run with:
```bash
npx tsx scripts/script-name.ts
# or, for scripts/migrations/:
npx tsx scripts/migrations/script-name.ts
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
  'gpt-3.5-turbo': OpenAIStrategy,
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
indexedDB.deleteDatabase('recwide_db')
// Refresh page
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- **[FEATURES.md](./FEATURES.md)** - Feature documentation
- **[MAINTENANCE.md](./MAINTENANCE.md)** - Operations and known issues
- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - Design-token architecture and enforcement (`yarn design:*` gates)
- **[COMPONENT_SYSTEM.md](./COMPONENT_SYSTEM.md)** - Component ownership, `Ui*` wrappers, and boundary rules
- **[architecture/app-surfaces.md](./architecture/app-surfaces.md)** - Platform/Daily/Learning app-surface split
- **[MODULE_SYSTEM_DIAGRAMS.md](./MODULE_SYSTEM_DIAGRAMS.md)** - Architecture map for the modular monolith
