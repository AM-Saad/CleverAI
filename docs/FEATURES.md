# CleverAI Features Documentation

> Detailed documentation of all major features and their implementations.  
> **Last Updated**: Based on source code analysis

---

## Table of Contents
1. [Notes System](#notes-system)
2. [Spaced Repetition (SM-2)](#spaced-repetition-sm-2)
3. [LLM Content Generation](#llm-content-generation)
4. [Materials Management](#materials-management)
5. [Folders & Organization](#folders--organization)
6. [Push Notifications](#push-notifications)
7. [PWA & Offline Support](#pwa--offline-support)
8. [Authentication](#authentication)

---

## Notes System

### Overview

A local-first rich text notes system with:
- Optimistic UI updates
- IndexedDB persistence
- Background sync
- Drag-and-drop reordering
- Conflict detection

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client (Browser)                             │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │NotesSection  │───>│  useNotesStore  │───>│   IndexedDB   │  │
│  │  (Vue SFC)   │    │  (Composable)   │    │ (notes store) │  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
│         │                    │                      │          │
│         ▼                    │ debounced            │          │
│  ┌──────────────┐            │ sync (500ms)         │          │
│  │  Rich Text   │            ▼                      ▼          │
│  │   Editor     │    ┌─────────────────┐    ┌───────────────┐  │
│  └──────────────┘    │  Background     │    │ pendingNotes  │  │
│                      │  Sync Handler   │    │   (queue)     │  │
│                      └─────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Server (Nitro)                            │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ /api/notes/* │───>│     Prisma      │───>│   MongoDB     │  │
│  │   CRUD API   │    │                 │    │               │  │
│  └──────────────┘    └─────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
interface Note {
  id: string
  content: string        // Rich text (HTML)
  folderId: string
  order: number          // Position in list
  createdAt: Date
  updatedAt: Date        // For conflict detection
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notes` | GET | List notes by folderId |
| `/api/notes` | POST | Create note |
| `/api/notes/[id]` | PUT | Update note |
| `/api/notes/[id]` | DELETE | Delete note |
| `/api/notes/sync` | POST | Bulk sync from client |
| `/api/notes/reorder` | PUT | Update order positions |

### Key Features

**Optimistic Updates**:
```typescript
// useNotesStore.ts
async function updateNote(id: string, content: string) {
  // 1. Update local state immediately
  const note = notes.value.find(n => n.id === id)
  if (note) note.content = content
  
  // 2. Save to IndexedDB
  await saveToIndexedDB(note)
  
  // 3. Debounced server sync
  debouncedSync()
}
```

**Conflict Detection**:
```typescript
// Server checks updatedAt
if (serverNote.updatedAt > clientNote.updatedAt) {
  return { conflict: true, serverVersion: serverNote }
}
```

**Drag-and-Drop Reorder**:
```typescript
// NotesSection.vue uses vuedraggable
async function onDragEnd(event) {
  const newOrder = notes.value.map((n, i) => ({
    id: n.id,
    order: i
  }))
  await $api.notes.reorder(newOrder)
}
```

### Composable API

```typescript
const {
  notes,              // Ref<Note[]>
  loading,            // Ref<boolean>
  error,              // Ref<Error | null>
  createNote,         // (content: string) => Promise<Note>
  updateNote,         // (id: string, content: string) => Promise<void>
  deleteNote,         // (id: string) => Promise<void>
  reorderNotes,       // (newOrder: OrderUpdate[]) => Promise<void>
  syncNotes,          // () => Promise<void>
} = useNotesStore(folderId)
```

---

## Spaced Repetition (SM-2)

### Overview

Implementation of the SuperMemo 2 algorithm for optimal learning intervals. Supports both flashcards and materials as reviewable items.

### SM-2 Algorithm

**Grade Scale**:
| Grade | Meaning | Effect |
|-------|---------|--------|
| 0 | Complete blackout | Reset to day 1 |
| 1 | Incorrect, correct shown | Reset to day 1 |
| 2 | Incorrect, recalled easily | Reset to day 1 |
| 3 | Correct with difficulty | Advance, reduce ease |
| 4 | Correct with hesitation | Advance, slight ease reduction |
| 5 | Perfect recall | Advance, increase ease |

**Core Formula**:
```typescript
function calculateNext(prev: ReviewState, grade: 0|1|2|3|4|5): ReviewState {
  let { easeFactor, intervalDays, repetitions } = prev
  
  if (grade >= 3) {
    // Success - advance
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)
    
    repetitions++
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * 0.08))
  } else {
    // Failure - reset
    repetitions = 0
    intervalDays = 1
  }
  
  return {
    ...prev,
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewAt: addDays(new Date(), intervalDays),
    lastGrade: grade,
  }
}
```

### Architecture (DDD)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Domain Layer                               │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  SREngine    │  │  SRScheduler  │  │     SRPolicy        │  │
│  │              │  │   (SM-2)      │  │                     │  │
│  │ - enroll     │  │               │  │ - defaultEaseFactor │  │
│  │ - grade      │  │ - next()      │  │ - minEaseFactor     │  │
│  │ - getQueue   │  │               │  │ - maxIntervalDays   │  │
│  └──────────────┘  └───────────────┘  └─────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              CardReviewRepository (Interface)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
interface CardReview {
  id: string
  userId: string
  folderId: string
  cardId: string           // Flashcard.id or Material.id
  resourceType: 'flashcard' | 'material'
  
  // SM-2 state
  repetitions: number      // Times correctly recalled
  easeFactor: number       // 1.3 - 2.5 (difficulty)
  intervalDays: number     // Days until next review
  nextReviewAt: Date       // Scheduled review date
  lastReviewedAt?: Date
  lastGrade?: number       // Last grade (0-5)
  
  // Lifecycle
  status: 'active' | 'suspended'
  createdAt: Date
  updatedAt: Date
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/review/enroll` | POST | Enroll card (idempotent) |
| `/api/review/grade` | POST | Submit grade (transactional) |
| `/api/review/queue` | GET | Get due cards |
| `/api/review/analytics` | GET | Learning statistics |
| `/api/review/enrollment-status` | GET | Bulk enrollment check |

### Key Features

**Idempotent Enrollment**:
```typescript
// Uses upsert to prevent race conditions
await prisma.cardReview.upsert({
  where: { userId_cardId: { userId, cardId } },
  create: { ...initialState },
  update: {} // No-op if exists
})
```

**Transactional Grading**:
```typescript
// Wrapped in transaction for consistency
await prisma.$transaction(async (tx) => {
  const review = await tx.cardReview.findUnique(...)
  const newState = scheduler.next(review, grade)
  await tx.cardReview.update({ data: newState })
})
```

**Grade Idempotency**:
```typescript
// GradeRequest model prevents double-clicks
const existing = await prisma.gradeRequest.findUnique({
  where: { requestId }
})
if (existing) return { cached: true, result: existing }
```

### Composable API

```typescript
const {
  // Queue
  queue,                  // Ref<ReviewItem[]>
  currentCard,            // Computed<ReviewItem | null>
  hasMore,                // Computed<boolean>
  
  // Actions
  enroll,                 // (cardId, type) => Promise<void>
  grade,                  // (grade: 0-5) => Promise<void>
  skip,                   // () => void
  
  // State
  loading,
  grading,
  
  // Analytics
  analytics,              // { totalReviews, avgEaseFactor, ... }
} = useCardReview(folderId)
```

### UI Components

- `EnrollButton.vue` - One-click enrollment
- `CardReviewInterface.vue` - Full review UI with flip animation
- `ReviewAnalyticsSummary.vue` - Statistics dashboard
- `ReviewDebugPanel.vue` - Dev-only algorithm testing

---

## LLM Content Generation

### Overview

AI-powered generation of flashcards and questions from user content, using a strategy pattern for provider flexibility.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Request Flow                               │
│                                                                 │
│  Client Request                                                 │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │ Rate Limit  │────>│ User Quota   │────>│   LLMFactory    │  │
│  │   Check     │     │    Check     │     │  (Strategy)     │  │
│  └─────────────┘     └──────────────┘     └─────────────────┘  │
│                                                   │             │
│                            ┌──────────────────────┼────────┐    │
│                            │                      │        │    │
│                            ▼                      ▼        ▼    │
│                    ┌──────────────┐     ┌──────────────┐       │
│                    │GPT35Strategy │     │GeminiStrategy│       │
│                    │  (OpenAI)    │     │  (Google)    │       │
│                    └──────────────┘     └──────────────┘       │
│                            │                      │             │
│                            └──────────┬───────────┘             │
│                                       ▼                         │
│                              ┌──────────────┐                   │
│                              │  Log Usage   │                   │
│                              │  (LlmUsage)  │                   │
│                              └──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Strategy Interface

```typescript
interface LLMStrategy {
  generate(
    messages: ChatMessage[],
    options?: GenerateOptions,
    onMeasure?: (usage: TokenUsage) => void
  ): Promise<string>
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  model: string
}
```

### Providers

**GPT-3.5 Turbo** (`GPT35Strategy`):
```typescript
{
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 2048,
  cost: ~$0.002 per 1K tokens
}
```

**Google Gemini** (`GeminiStrategy`):
```typescript
{
  model: 'gemini-2.0-flash-lite',
  cost: Significantly lower than OpenAI
}
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/llm.generate.post` | Legacy generation endpoint |
| `/api/llm.gateway.post` | Smart routing with caching |
| `/api/questions/generate` | Question generation |

### Rate Limiting

**Implementation** (`server/utils/llm/rateLimit.ts`):
```typescript
interface RateLimitConfig {
  windowMs: number      // Time window
  maxRequests: number   // Max requests per window
}

// Redis-first with memory fallback
async function checkRateLimit(
  key: string, 
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = await getRedis()
  if (redis) {
    return redisRateLimit(redis, key, config)
  }
  return memoryRateLimit(key, config)
}
```

### Usage Tracking

```typescript
interface LlmUsage {
  id: string
  userId: string
  model: string
  promptTokens: number
  completionTokens: number
  estimatedCost: number
  endpoint: string
  timestamp: Date
}

// Logged via onMeasure callback in strategies
```

### Smart Routing (Gateway)

```typescript
// server/api/llm.gateway.post.ts
// Features:
// - Model scoring by cost/latency/health
// - Automatic fallback on failure
// - Response caching for identical prompts
// - User quota enforcement
```

---

## Materials Management

### Overview

Upload and manage learning materials (PDFs, URLs) with AI-powered flashcard generation.

### Material Types

| Type | Source | Processing |
|------|--------|------------|
| `pdf` | File upload | Text extraction |
| `url` | Web URL | Content scraping |
| `text` | Direct input | None |

### Data Model

```typescript
interface Material {
  id: string
  title: string
  type: 'pdf' | 'url' | 'text'
  content: string          // Extracted/scraped text
  sourceUrl?: string       // For URL type
  folderId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/materials` | GET | List by folder |
| `/api/materials` | POST | Create material |
| `/api/materials/[id]` | GET | Get single |
| `/api/materials/[id]` | PUT | Update |
| `/api/materials/[id]` | DELETE | Delete |
| `/api/materials/[id]/generate-flashcards` | POST | AI generation |

### Flashcard Generation

```typescript
// From material content, generates flashcards
// Uses LLM with specialized prompt
const flashcards = await generateFlashcards(material.content, {
  count: 10,           // Target count
  difficulty: 'mixed', // easy/medium/hard/mixed
})
```

---

## Folders & Organization

### Overview

Hierarchical organization for all content types (notes, materials, flashcards).

### Data Model

```typescript
interface Folder {
  id: string
  name: string
  description?: string
  parentId?: string       // For nesting
  userId: string
  createdAt: Date
  updatedAt: Date
  
  // Relations
  notes: Note[]
  materials: Material[]
  flashcards: Flashcard[]
  children: Folder[]
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/folders` | GET | List user's folders |
| `/api/folders` | POST | Create folder |
| `/api/folders/[id]` | GET | Get with contents |
| `/api/folders/[id]` | PUT | Update |
| `/api/folders/[id]` | DELETE | Delete (cascade) |
| `/api/folders/[id]/duplicate` | POST | Deep copy |

### Features

**Nested Structure**:
```typescript
// Recursive folder tree
const tree = await buildFolderTree(userId)
// Returns nested structure with depth limiting
```

**Cascade Delete**:
```typescript
// Deleting folder removes all contents
await prisma.folder.delete({
  where: { id },
  include: {
    notes: true,
    materials: true,
    flashcards: true,
    children: true
  }
})
```

---

## Push Notifications

### Overview

Review reminder notifications via Web Push API.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Notification Flow                           │
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌────────────────┐  │
│  │ Grade Card   │────>│  Schedule    │────>│ Scheduled      │  │
│  │              │     │  Notification│     │ Notification   │  │
│  └──────────────┘     └──────────────┘     │ (MongoDB)      │  │
│                                            └────────────────┘  │
│                                                    │           │
│                                            ┌───────▼────────┐  │
│                                            │  Cron Job      │  │
│                                            │  (scheduled)   │  │
│                                            └───────┬────────┘  │
│                                                    │           │
│                            ┌───────────────────────┼─────────┐ │
│                            │                       │         │ │
│                            ▼                       ▼         ▼ │
│                    ┌──────────────┐     ┌──────────────────┐   │
│                    │User Prefs OK?│     │ Push Subscription │   │
│                    │(Quiet hours) │     │     (web-push)    │   │
│                    └──────────────┘     └──────────────────┘   │
│                            │                       │           │
│                            └───────────┬───────────┘           │
│                                        ▼                       │
│                              ┌──────────────────┐              │
│                              │   Push Message   │              │
│                              │   to Browser     │              │
│                              └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Models

**User Subscription**:
```typescript
interface UserSubscription {
  id: string
  userId: string
  endpoint: string         // Push service endpoint
  keys: {
    auth: string
    p256dh: string
  }
  expirationTime?: Date
  createdAt: Date
}
```

**Scheduled Notification**:
```typescript
interface ScheduledNotification {
  id: string
  userId: string
  type: 'card_due' | 'study_reminder'
  cardId?: string          // For card-specific
  scheduledFor: Date
  sent: boolean
  sentAt?: Date
  createdAt: Date
}
```

**User Notification Preferences**:
```typescript
interface NotificationPreferences {
  enabled: boolean
  quietHoursStart: number  // Hour (0-23)
  quietHoursEnd: number
  categories: {
    cardDue: boolean
    studyReminder: boolean
    streakWarning: boolean
  }
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications/subscribe` | POST | Create subscription |
| `/api/notifications/unsubscribe` | POST | Remove subscription |
| `/api/notifications/preferences` | GET | Get preferences |
| `/api/notifications/preferences` | PUT | Update preferences |
| `/api/cron/send-notifications` | POST | Trigger sending |

### Key Services

**NotificationScheduler**:
```typescript
class NotificationScheduler {
  // Schedule based on nextReviewAt
  async scheduleCardDueNotification(
    userId: string,
    cardId: string,
    dueDate: Date
  ): Promise<void>
  
  // Process due notifications
  async processDueNotifications(): Promise<void>
}
```

**SubscriptionService**:
```typescript
class SubscriptionService {
  async createSubscription(userId: string, sub: PushSubscription): Promise<void>
  async getUserSubscriptions(userId: string): Promise<UserSubscription[]>
  async sendPush(userId: string, payload: NotificationPayload): Promise<void>
}
```

### Cron Configuration

```bash
# Enable in .env
ENABLE_CRON=true
CRON_SECRET_TOKEN=your-secret

# Test manually
curl -X POST http://localhost:3000/api/cron/send-notifications \
  -H "x-cron-secret: $CRON_SECRET_TOKEN"
```

---

## PWA & Offline Support

### Overview

Full progressive web app with offline support via Workbox service worker.

### Build Pipeline

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  sw-src/       │     │   esbuild      │     │  public/sw.js  │
│  index.ts      │────>│   (bundle)     │────>│  (development) │
└────────────────┘     └────────────────┘     └────────────────┘
                                                      │
                                                      ▼
                                              ┌────────────────┐
                                              │ inject-sw.cjs  │
                                              │ (hash assets)  │
                                              └────────────────┘
                                                      │
                                                      ▼
                                              ┌────────────────┐
                                              │  Production    │
                                              │  Build         │
                                              └────────────────┘
```

### Caching Strategies

| Content Type | Strategy | Rationale |
|--------------|----------|-----------|
| API responses | NetworkFirst | Fresh data preferred |
| Static assets | CacheFirst | Immutable files |
| Pages | StaleWhileRevalidate | Balance |
| Images | CacheFirst | Large, rarely change |

### IndexedDB Structure

```typescript
const DB_CONFIG = {
  name: 'clever-ai-db',
  version: 8,
  stores: {
    forms: 'forms',           // Queued form submissions
    notes: 'notes',           // Notes cache
    pendingNotes: 'pendingNotes' // Unsaved changes
  }
}
```

### Background Sync

```typescript
// Sync tags
const SYNC_TAGS = {
  FORM_SYNC: 'form-sync',
  NOTES_SYNC: 'notes-sync',
}

// Registration
await registration.sync.register(SYNC_TAGS.NOTES_SYNC)

// Handler
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAGS.NOTES_SYNC) {
    event.waitUntil(syncPendingNotes())
  }
})
```

### Push Notification Handling

```typescript
self.addEventListener('push', (event) => {
  const data = event.data?.json()
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: data.url },
      actions: data.actions
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
```

### Offline Flow

1. **Page Load**: Service worker intercepts, serves from cache
2. **Data Request**: NetworkFirst tries server, falls back to cache
3. **User Action**: Saved to IndexedDB, queued for sync
4. **Network Restored**: Background sync sends pending data
5. **Conflict Resolution**: Server-side timestamp comparison

### Debug Tools

```javascript
// Check SW status
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log('Registrations:', regs))

// Clear all caches
caches.keys().then(keys => 
  Promise.all(keys.map(k => caches.delete(k)))
)

// Force update
navigator.serviceWorker.getRegistration()
  .then(reg => reg?.update())
```

---

## Authentication

### Overview

NextAuth.js-based authentication with credentials and Google OAuth providers.

### Auth Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  @sidebase/nuxt-auth (Nuxt module wrapper)                     │
│       │                                                         │
│       ▼                                                         │
│  NextAuth.js (Core)                                            │
│       │                                                         │
│       ├──────────────────┬──────────────────┐                  │
│       ▼                  ▼                  ▼                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────────┐           │
│  │Credentials│    │  Google  │     │ Future       │           │
│  │ Provider  │    │  OAuth   │     │ Providers    │           │
│  └──────────┘     └──────────┘     └──────────────┘           │
│       │                  │                                     │
│       └──────────────────┴───────────────────┐                │
│                                               ▼                │
│                                    ┌──────────────────┐       │
│                                    │  Prisma Adapter  │       │
│                                    │   (MongoDB)      │       │
│                                    └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Session Management

```typescript
// JWT-based sessions
// Stored in httpOnly cookie
// Validated on each request

// Server-side access
const session = await getServerSession(event)
const userId = session?.user?.id

// Client-side access
const { data: session, status } = useAuth()
```

### API Protection

```typescript
// Server route protection
export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  // Attach user to context
  event.context.user = session.user
  
  // Continue with handler...
})
```

### Password Handling

```typescript
// Registration
const hashedPassword = await bcrypt.hash(password, 10)

// Login validation
const isValid = await bcrypt.compare(password, user.hashedPassword)
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Setup and debugging
- **[MAINTENANCE.md](./MAINTENANCE.md)** - Operations and known issues
