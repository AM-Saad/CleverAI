# Cognilo Architecture

> System design reference for Cognilo - an AI-powered learning platform.  
> **Last Updated**: Based on source code analysis

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Data Model](#data-model)
5. [Core Modules](#core-modules)
6. [Service Architecture](#service-architecture)
7. [Authentication & Authorization](#authentication--authorization)
8. [PWA & Offline Support](#pwa--offline-support)
9. [LLM Integration](#llm-integration)

---

## System Overview

Cognilo is a **Nuxt 3** application providing AI-powered flashcard generation and spaced repetition learning. Key architectural characteristics:

- **Hybrid SSR/SPA**: Server-side rendering with client-side hydration
- **Local-First Notes**: IndexedDB persistence with background sync
- **Strategy Pattern LLM**: Pluggable AI providers (OpenAI, Google Gemini)
- **PWA-Native**: Full offline support via Workbox service worker

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐│
│  │ Vue 3 SFC   │  │ Pinia Store │  │ Service Worker (Workbox) ││
│  │ Components  │  │ + IndexedDB │  │ + Push + Background Sync ││
│  └─────────────┘  └─────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ FetchFactory    │  │ serviceFactory  │                      │
│  │ (Result pattern)│  │ (API bindings)  │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nitro Server (API)                         │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │ API Routes  │  │ Rate Limiter  │  │ Auth (NextAuth.js)    │ │
│  │ /api/*      │  │ Redis/Memory  │  │ @sidebase/nuxt-auth   │ │
│  └─────────────┘  └───────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Prisma ORM  │  │ MongoDB      │  │ Redis (optional)     │   │
│  │ + Contracts │  │ Document DB  │  │ Rate limits + cache  │   │
│  └─────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Nuxt 3 | 3.16+ | Meta-framework (SSR/SPA) |
| Vue 3 | 3.5+ | UI library (Composition API) |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first CSS |
| Pinia | 2.x | State management |
| shadcn-vue (Nuxt UI) | - | Component library |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Nitro | - | Server engine (bundled with Nuxt) |
| Prisma | 6.x | ORM for MongoDB |
| MongoDB | - | Document database |
| Redis | - | Rate limiting, caching (optional) |
| @sidebase/nuxt-auth | 0.10+ | Authentication (NextAuth wrapper) |

### LLM Providers
| Provider | Model | Use Case |
|----------|-------|----------|
| OpenAI | gpt-3.5-turbo | Flashcard generation |
| Google Gemini | gemini-2.0-flash-lite | Cost-optimized generation |

### PWA
| Technology | Purpose |
|------------|---------|
| Workbox | Service worker toolkit |
| IndexedDB | Client-side persistence |
| web-push | Push notifications |

---

## Directory Structure

```
cognilo/
├── app/                        # Nuxt app source (srcDir)
│   ├── components/             # Vue components
│   │   ├── folder/             # Folder-specific (NotesSection, etc.)
│   │   ├── review/             # SR review UI
│   │   └── ui/                 # Base UI components
│   ├── composables/            # Vue composables
│   │   ├── folders/            # useNotesStore, useFolders
│   │   └── shared/             # useDataFetch, useOperation
│   ├── domain/                 # Domain logic (DDD)
│   │   ├── sr/                 # Spaced repetition domain
│   │   └── repositories/       # Repository interfaces
│   ├── layouts/                # Page layouts
│   ├── middleware/             # Route middleware
│   ├── pages/                  # File-based routing
│   ├── plugins/                # Nuxt plugins
│   ├── services/               # API service layer
│   │   ├── FetchFactory.ts     # HTTP client with Result pattern
│   │   └── serviceFactory.ts   # Service bindings
│   └── types/                  # TypeScript types
├── server/                     # Nitro server
│   ├── api/                    # API endpoints
│   │   ├── auth/               # Authentication
│   │   ├── folders/            # Folder CRUD
│   │   ├── llm.generate.post.ts
│   │   ├── llm.gateway.post.ts
│   │   ├── materials/          # Materials CRUD
│   │   ├── notes/              # Notes CRUD + sync
│   │   ├── notifications/      # Push notifications
│   │   ├── questions/          # AI-generated questions
│   │   └── review/             # Spaced repetition
│   ├── middleware/             # Server middleware
│   ├── prisma/                 # Prisma schema
│   │   └── schema.prisma
│   ├── services/               # Business services
│   │   ├── NotificationScheduler.ts
│   │   └── SubscriptionService.ts
│   └── utils/                  # Server utilities
│       ├── llm/                # LLM strategies
│       │   ├── LLMFactory.ts
│       │   ├── GPT35Strategy.ts
│       │   └── GeminiStrategy.ts
│       └── sm2.ts              # SM-2 algorithm
├── shared/                     # Shared code (client + server)
│   ├── *.contract.ts           # Zod schemas
│   └── types/                  # Shared types
├── sw-src/                     # Service worker source
│   └── index.ts                # Workbox + push + sync
├── docs/                       # Documentation
├── scripts/                    # Build/migration scripts
└── tests/                      # Playwright tests
```

---

## Data Model

### Core Entities (Prisma Schema)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │────<│    Folder    │────<│   Material   │
│              │     │              │     │   (PDF/URL)  │
│ - email      │     │ - name       │     │ - title      │
│ - password   │     │ - userId     │     │ - type       │
│ - provider   │     │ - parentId?  │     │ - content    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            │                    ▼
                            │            ┌──────────────┐
                            ├───────────<│   Flashcard  │
                            │            │              │
                            │            │ - question   │
                            │            │ - answer     │
                            │            └──────────────┘
                            │                    │
                            ▼                    │
                     ┌──────────────┐            │
                     │     Note     │            │
                     │              │            │
                     │ - content    │            │
                     │ - order      │            │
                     └──────────────┘            │
                                                 ▼
                                          ┌──────────────┐
                                          │  CardReview  │
                                          │   (SM-2)     │
                                          │              │
                                          │ - easeFactor │
                                          │ - interval   │
                                          │ - nextReview │
                                          └──────────────┘
```

### Key Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Authentication | email, hashedPassword, provider |
| `Folder` | Learning units | name, parentId (nested), userId |
| `Material` | Learning content | title, type (pdf/url), content |
| `Flashcard` | Q&A pairs | question, answer, folderId, materialId? |
| `Note` | User notes | content (rich text), order, folderId |
| `CardReview` | SM-2 state | easeFactor, intervalDays, nextReviewAt |
| `LlmUsage` | Cost tracking | tokens, cost, model, userId |
| `LlmModelRegistry` | Model config | name, costPer1kTokens, rateLimit |
| `UserSubscription` | Push subscriptions | endpoint, keys, userId |
| `ScheduledNotification` | Due reminders | scheduledFor, sent, cardId |

### Constraints & Indexes

```prisma
// Unique constraints (prevent race conditions)
@@unique([userId, cardId])           // CardReview - one per user+card
@@unique([endpoint])                 // UserSubscription - one per browser

// Performance indexes
@@index([userId, type, cardId, sent]) // ScheduledNotification
@@index([folderId])                   // Note ordering queries
@@index([nextReviewAt])               // Due card queries
```

---

## Core Modules

### 1. Notes Module

**Purpose**: Rich-text notes with local-first architecture

**Architecture**:
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  NotesSection   │────>│  useNotesStore  │────>│    IndexedDB    │
│  (Component)    │     │  (Composable)   │     │  (notes store)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │ debounced sync        │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Drag & Drop    │     │  /api/notes/*   │────>│    MongoDB      │
│  Reordering     │     │  CRUD + sync    │     │  (persistent)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Features**:
- Optimistic updates (instant UI feedback)
- Debounced server sync (500ms delay)
- Conflict detection via updatedAt timestamps
- Background sync via service worker `notes-sync` tag
- Rich text editing with sanitization

**API Endpoints**:
- `GET /api/notes?folderId=` - List notes
- `POST /api/notes` - Create note
- `PUT /api/notes/[id]` - Update note
- `DELETE /api/notes/[id]` - Delete note
- `POST /api/notes/sync` - Bulk sync from client
- `PUT /api/notes/reorder` - Update order positions

### 2. Spaced Repetition Module

**Purpose**: SM-2 algorithm for optimal learning intervals

**Domain-Driven Architecture**:
```
┌─────────────────────────────────────────────────────────────────┐
│                        Domain Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   SREngine   │  │ SRScheduler  │  │   SRPolicy   │          │
│  │ (Orchestrator│  │  (SM-2 Algo) │  │   (Config)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────────────────────────────────────────┐          │
│  │          CardReviewRepository (Interface)         │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                         │
│  ┌──────────────────────────────────────────────────┐          │
│  │       PrismaCardReviewRepository (Impl)           │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**SM-2 Algorithm**:
```typescript
// Grade: 0-5 (0-2 = fail, 3-5 = pass)
// Ease Factor: 1.3 - 2.5 (difficulty modifier)
// Interval: Days until next review

if (grade >= 3) {
  if (repetitions === 0) interval = 1
  else if (repetitions === 1) interval = 6
  else interval = Math.round(prevInterval * easeFactor)
  
  repetitions++
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * 0.08))
} else {
  repetitions = 0
  interval = 1
}
```

**API Endpoints**:
- `POST /api/review/enroll` - Enroll card in review (idempotent via upsert)
- `POST /api/review/grade` - Submit grade (transactional + idempotent)
- `GET /api/review/queue?folderId=` - Get due cards
- `GET /api/review/analytics` - Learning statistics

### 3. LLM Module

**Purpose**: AI-powered content generation (flashcards, questions)

**Strategy Pattern**:
```
┌─────────────────┐
│   LLMFactory    │────────────────────────────────┐
│ getLLMStrategy()│                                │
└─────────────────┘                                │
         │                                         │
         ▼                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GPT35Strategy  │     │ GeminiStrategy  │     │ Future Strategy │
│                 │     │                 │     │                 │
│ - OpenAI API    │     │ - Google AI     │     │ - Anthropic?    │
│ - gpt-3.5-turbo │     │ - gemini-flash  │     │ - Local?        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Common Interface**:
```typescript
interface LLMStrategy {
  generate(
    messages: ChatMessage[],
    options?: GenerateOptions,
    onMeasure?: (usage: TokenUsage) => void
  ): Promise<string>
}
```

**Rate Limiting Flow**:
```
Request → Check User Quota → Check Model Rate Limit → LLM Strategy → Log Usage
              ↓                      ↓
         Over quota?            Rate limited?
              ↓                      ↓
          429 Error              Retry-After header
```

### 4. Materials Module

**Purpose**: PDF and URL content management

**Features**:
- PDF upload with text extraction
- URL content fetching
- Material-to-flashcard generation
- Folder organization

### 5. Folders Module

**Purpose**: Hierarchical content organization

**Features**:
- Nested folder structure (parentId)
- Folder-level operations (duplicate, delete cascade)
- Content aggregation (notes, materials, flashcards)

---

## Service Architecture

### Frontend Services

**FetchFactory** (`app/services/FetchFactory.ts`):
```typescript
class FetchFactory {
  // Result pattern - never throws
  async call<T>(fn: () => Promise<T>): Promise<Result<T, APIError>>
  
  // Configuration
  retries: number      // Retry count for transient errors
  retryDelay: number   // Base delay (exponential backoff)
  timeout: number      // Request timeout
  
  // Error hooks
  onError?: (error: APIError) => void
}
```

**Service Factory** (`app/services/serviceFactory.ts`):
```typescript
const services = {
  folders: new FolderService(fetchFactory),
  materials: new MaterialService(fetchFactory),
  notes: new NoteService(fetchFactory),
  flashcards: new FlashcardService(fetchFactory),
  review: new ReviewService(fetchFactory),
  notifications: new NotificationService(fetchFactory),
}
```

### Backend Services

**NotificationScheduler** (`server/services/NotificationScheduler.ts`):
- Schedules review reminders based on nextReviewAt
- De-duplicates notifications per card
- Handles push via web-push

**SubscriptionService** (`server/services/SubscriptionService.ts`):
- Manages push notification subscriptions
- Handles subscription lifecycle (create, update, delete)

---

## Authentication & Authorization

### Auth Stack
```
@sidebase/nuxt-auth (Nuxt module)
        ↓
NextAuth.js (Core)
        ↓
Providers: Credentials + Google OAuth
        ↓
Prisma Adapter → MongoDB
```

### Auth Flow
```
1. User submits credentials
2. NextAuth validates (bcrypt for passwords)
3. JWT session created
4. Session stored in cookie (httpOnly)
5. Server validates JWT on each request
6. User data attached to event.context.user
```

### Authorization Patterns
```typescript
// Server-side authorization check
const user = event.context.user
if (!user) throw createError({ statusCode: 401 })

// Resource ownership check
const folder = await prisma.folder.findFirst({
  where: { id: folderId, userId: user.id }
})
if (!folder) throw createError({ statusCode: 403 })
```

---

## PWA & Offline Support

### Service Worker Architecture

**Build Pipeline**:
```
sw-src/index.ts → esbuild → public/sw.js → inject-sw.cjs → production
       ↓
  Workbox plugins
  Push handlers
  Background sync
  IndexedDB
```

**Caching Strategies**:
| Route Pattern | Strategy | Rationale |
|---------------|----------|-----------|
| `/api/` | NetworkFirst | Fresh data preferred |
| Static assets | CacheFirst | Immutable files |
| Pages | StaleWhileRevalidate | Balance freshness/speed |

**IndexedDB Stores** (version 8):
- `forms` - Offline form submissions
- `notes` - Local notes cache
- `pendingNotes` - Unsaved changes queue

**Background Sync Tags**:
- `form-sync` - Queued form submissions
- `notes-sync` - Notes synchronization

### Offline Flow
```
1. User edits note offline
2. Note saved to IndexedDB + pendingNotes
3. Service worker registers 'notes-sync' tag
4. Network restored → sync event fires
5. POST /api/notes/sync with pending notes
6. Server responds with canonical state
7. IndexedDB updated, pending cleared
```

---

## LLM Integration

### Provider Configuration

**OpenAI (GPT35Strategy)**:
```typescript
{
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 2048,
  // Cost: ~$0.002 per 1K tokens
}
```

**Google Gemini (GeminiStrategy)**:
```typescript
{
  model: 'gemini-2.0-flash-lite',
  // Significantly lower cost
  // Good for high-volume generation
}
```

### Usage Tracking

Every LLM call logged to `LlmUsage`:
```typescript
{
  userId: string
  model: string
  promptTokens: number
  completionTokens: number
  estimatedCost: number
  endpoint: string
  timestamp: Date
}
```

### Rate Limiting

**Implementation** (`server/utils/llm/rateLimit.ts`):
- Redis-first with in-memory fallback
- Per-user, per-model limits
- Sliding window algorithm
- Returns `Retry-After` header on 429

### Smart Routing (Gateway)

**Features** (`server/api/llm.gateway.post.ts`):
- Model scoring by cost/latency/health
- Automatic fallback on failures
- Response caching for identical prompts
- Usage quota enforcement

---

## Contracts & Validation

All API contracts defined in `shared/` using Zod:

```typescript
// shared/note.contract.ts
export const NoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  folderId: z.string(),
  order: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Used in both client validation and server parsing
```

**Contract Files**:
- `note.contract.ts` - Notes CRUD
- `review.contract.ts` - Spaced repetition
- `llm-generate.contract.ts` - LLM requests
- `user.contract.ts` - User data
- `auth.schemas.ts` - Authentication

---

## Design Patterns Summary

| Pattern | Usage | Location |
|---------|-------|----------|
| Strategy | LLM providers | `server/utils/llm/` |
| Repository | Data access | `app/domain/repositories/` |
| Factory | Service creation | `app/services/serviceFactory.ts` |
| Result | Error handling | `FetchFactory.call()` |
| Domain-Driven | SR business logic | `app/domain/sr/` |
| Local-First | Notes persistence | `useNotesStore` + IndexedDB |
| Optimistic Updates | UI responsiveness | All composables |

---

## Related Documentation

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Setup, commands, debugging
- **[FEATURES.md](./FEATURES.md)** - Detailed feature documentation
- **[MAINTENANCE.md](./MAINTENANCE.md)** - Operations, known issues, roadmap
