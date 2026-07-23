# Cognilo Features Documentation

> Detailed documentation of all major features and their implementations.
> **Last Updated**: 2026-07-23

---

## Table of Contents
1. [Daily](#daily)
2. [Notes System](#notes-system)
3. [Spaced Repetition (SM-2)](#spaced-repetition-sm-2)
4. [XP & Gamification](#xp--gamification)
5. [LLM Content Generation](#llm-content-generation)
6. [Materials Management](#materials-management)
7. [Workspaces & Organization](#workspaces--organization)
8. [Kanban Board](#kanban-board)
9. [User Tags](#user-tags)
10. [On-Device AI](#on-device-ai)
11. [Push Notifications](#push-notifications)
12. [PWA & Offline Support](#pwa--offline-support)
13. [Subscription & Quota](#subscription--quota)
14. [Authentication](#authentication)

---

## Daily

### Overview

Day-planner feature: recurring or one-off action items placed on calendar days, plus one continuous rich-text note per day. It's product-prominent — the first tab in the mobile nav and the first card in the app launcher.

Routed at `/day/[date]` (`app/pages/day/[date].vue`); `/day` redirects to today's date. There is **no** `/daily` route.

> Daily and Learning are also independently-deployable Nitro surfaces (selected via the `APP_SURFACE` env var), not just feature groupings — see [architecture/app-surfaces.md](./architecture/app-surfaces.md).

### Data Models

```typescript
interface DailyNote {
  id: string
  userId: string
  dateKey: string        // Calendar day key, e.g. "2026-07-23"
  content: Json          // Tiptap JSON
  contentFormat: string  // Default "TIPTAP_JSON"
  version: number
  createdAt: Date
  updatedAt: Date
  // @@unique([userId, dateKey])
}

interface ActionItem {
  id: string
  userId: string
  title: string
  description?: string
  timingMode: ActionTimingMode        // "ALL_DAY" | "TIMED"
  startDate: string
  localTime?: string
  timezone?: string
  recurrence?: Json                   // Recurrence rule
  lifecycle: ActionItemLifecycle      // ACTIVE | ARCHIVED
  createdAt: Date
  updatedAt: Date
}

interface ActionOccurrence {
  id: string
  occurrenceKey: string
  userId: string
  actionItemId: string
  originalDateKey: string
  currentPlacementId?: string
  status: ActionOccurrenceStatus      // OPEN | COMPLETED | SKIPPED | CANCELLED
  completedAt?: Date
  version: number
  createdAt: Date
  updatedAt: Date
  // @@unique([userId, occurrenceKey])
}

interface ActionPlacement {
  id: string
  userId: string
  occurrenceId: string
  occurrenceKey: string
  dateKey: string                     // Where this occurrence currently sits
  timingMode: ActionTimingMode
  localTime?: string
  timezone?: string
  position: string
  state: ActionPlacementState         // ACTIVE | MOVED | COMPLETED
  movedToPlacementId?: string
  createdAt: Date
  updatedAt: Date
}
```

`ActionItem` is the definition of a one-time action or recurring series; individual recurring appearances stay virtual until completion, movement, or another override requires a durable row. `ActionOccurrence` is one materialized instance of an item on a given day. `ActionPlacement` is where an occurrence currently sits — **rescheduling creates a new placement** (the old one marked `state: "MOVED"`, `movedToPlacementId` pointing at the new one) rather than mutating one in place.

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/daily/bootstrap` | GET | Bulk action items/occurrences for offline seeding |
| `/api/daily/day/[date]` | GET | Projected day (action items + note) for a date |

Backed by `server/modules/daily/` (`application/projectDailyDay.ts`, `domain/ensureOccurrence.ts`).

### Client Architecture

All paths relative to `app/features/daily/`:

| File | Purpose |
|------|---------|
| `composables/useDaily.ts` | CRUD/offline-mutation surface — `loadDay`, `createAction`, `setCompleted`, `reschedule`, `saveNote`, note-conflict `getNoteConflict`/`resolveNoteConflict` — via the generic Offline V2 queue |
| `domain/projectLocalDay.ts` | Pure function expanding recurrence into a day's projected items |
| `repositories/dailyLocalRepository.ts` | Local snapshot + server-merge reconciliation + note-conflict auto-resolution |

---

## Notes System

### Overview

A local-first rich text notes system with:
- Tiptap v3 editor with extensions (headings, images, lists, text style)
- Optimistic UI updates
- IndexedDB persistence
- Background sync
- Drag-and-drop reordering
- Conflict detection

> **Note**: The standalone `/notes` route currently has no entry in the mobile tab bar (`app/components/shell/MobileTabBar.vue`) or the app launcher (`app/components/home/AppLauncher.vue`). The route still works fully when reached directly — it's just not linked from primary navigation right now.

### Data Model

```typescript
interface Note {
  id: string
  content: string        // Rich text (HTML)
  workspaceId: string
  order: number          // Position in list
  tags: string[]         // Note tags
  noteType: string       // "TEXT" (default) or custom
  metadata: Json         // Extensible JSON metadata
  createdAt: Date
  updatedAt: Date        // For conflict detection
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notes` | GET | List notes by workspaceId |
| `/api/notes` | POST | Create note |
| `/api/notes/[id]` | PATCH | Update note |
| `/api/notes` | DELETE | Delete note(s) |
| `/api/notes/sync` | POST | Bulk sync from client |
| `/api/notes/reorder` | PATCH | Update order positions |

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
} = useNotesStore(workspaceId)
```

---

## Spaced Repetition (SM-2)

### Overview

Implementation of the SuperMemo 2 algorithm for optimal learning intervals. Supports flashcards, materials, and questions as reviewable items.

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
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)

    repetitions++
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * 0.08))
  } else {
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

### Ease Factor (EF)

**Ease Factor** is a multiplier (minimum 1.3) representing how easy a card is. It determines the interval between reviews:

```
Next Interval = Previous Interval × Ease Factor
```

| Grade | Change to EF |
|-------|--------------|
| 0 | **-0.80** |
| 1 | **-0.54** |
| 2 | **-0.32** |
| 3 | **-0.14** |
| 4 | **±0.00** |
| 5 | **+0.10** |

Penalties are asymmetric — forgetting is penalized much more harshly than remembering is rewarded. The floor of EF = 1.3 prevents infinite loops.

### Data Model

```typescript
interface CardReview {
  id: string
  userId: string
  workspaceId: string
  cardId: string           // Polymorphic: Flashcard.id, Material.id, or Question.id
  resourceType: string     // "flashcard" | "material" | "question"

  // SM-2 state
  repetitions: number      // Times correctly recalled
  easeFactor: number       // Minimum 1.3
  intervalDays: number     // Days until next review
  nextReviewAt: Date       // Scheduled review date
  lastReviewedAt?: Date
  lastGrade?: number       // Last grade (0-5)

  // Analytics
  streak: number           // Consecutive correct reviews
  suspended: boolean       // Pause reviews

  // Legacy compat
  flashcardId?: string
  materialId?: string
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/review/enroll` | POST | Enroll card (idempotent via upsert) |
| `/api/review/grade` | POST | Submit grade (transactional + idempotent) |
| `/api/review/queue` | GET | Get due cards |
| `/api/review/analytics` | GET | Learning statistics |
| `/api/review/enrollment-status` | GET | Bulk enrollment check |
| `/api/review/stats` | GET | Review statistics |

### Key Features

**Idempotent Enrollment** — Uses Prisma upsert on `userId_cardId` unique constraint.

**Transactional Grading** — Wrapped in `$transaction` for consistency. GradeRequest model prevents double-clicks via `requestId`.

**Polymorphic Resources** — Three resource types share the same review pipeline:
- `flashcard` — Traditional Q&A
- `material` — Direct material content review
- `question` — Multiple-choice questions

### Review Composables

| Composable | Purpose |
|------------|---------|
| `useCardReview` | Core review queue and grading |
| `useCardDisplay` | Card rendering logic |
| `useContentFormatter` | Content formatting for display |
| `useDebugControls` | Dev-only algorithm testing |
| `useWorkspaceEnrollment` | Bulk workspace enrollment |
| `useKeyboardShortcuts` | Keyboard navigation |
| `useReviewStats` | Statistics computation |
| `useSessionSummary` | Session summary |
| `useSessionTimer` | Session timing |

---

## XP & Gamification

### Overview

Experience points (XP) system encouraging consistent learning through reviews and enrollment.

### XP Calculation

**Review XP** = `BASE_XP × difficultyMultiplier × spacingMultiplier × gradeMultiplier × lateBonus`

Where:
- `BASE_XP = 5`
- `difficultyMultiplier = clamp(3.0 - easeFactor, 0.5, 2.0)`
- `spacingMultiplier = clamp(log2(intervalDays + 1), 0.5, 3.0)`
- `gradeMultiplier` = 0.2 (grade 0) → 1.4 (grade 5)
- `lateBonus = clamp(1 + daysLate × 0.1, 1.0, 1.5)`

**Enrollment XP** = 3 base XP per enrollment.

**Daily diminishing returns** (progressive tax after `DAILY_XP_TARGET = 300`):
- Below target: full XP
- Above target: progressively taxed up to 90%

### Data Models

```typescript
interface XpEvent {
  id: string
  userId: string
  cardId?: string
  source: string         // "review" | "enroll"
  xp: number             // Effective XP after diminishing returns
  createdAt: Date
}

interface Achievement {
  id: string
  userId: string
  type: AchievementType  // DAILY_STREAK | WEEKLY_STREAK | CARD_MASTERED | CARD_REVIEWED | CARD_REVIEWED_100
  streak: number
  createdAt: Date
  updatedAt: Date
}
```

---

## LLM Content Generation

### Overview

AI-powered generation of flashcards and questions from user content, using a strategy pattern for provider flexibility with smart routing.

### Providers

| Provider | Strategy | Models |
|----------|----------|--------|
| OpenAI | `OpenAIStrategy` | gpt-3.5-turbo, gpt-4o-mini, gpt-4o |
| Google | `GeminiStrategy` | gemini-2.0-flash-lite, gemini-1.5-flash-8b |
| DeepSeek | `DeepSeekStrategy` | deepseek-chat, deepseek-reasoner |
| Groq | `GroqStrategy` | llama-3.1-8b-instant, qwen-qwq-32b, llama-4-scout-17b |

### Strategy Interface

```typescript
interface LLMStrategy {
  generateFlashcards(input: string, options?: LLMGenerationOptions): Promise<FlashcardDTO[]>
  generateQuiz(input: string, options?: LLMGenerationOptions): Promise<QuizQuestionDTO[]>
}

interface LLMGenerationOptions {
  itemCount?: number // Adaptive item count
}
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/llm.gateway` | Smart routing with caching, quota, scoring |
| `GET /api/llm-usage` | Admin analytics |

### Smart Routing

See [LLM_GENERATION_FLOW.md](./LLM_GENERATION_FLOW.md) for the full end-to-end flow.

Models are scored by: `baseCost + latencyPenalty + priorityPenalty + healthPenalty + capabilityBonus`

### Rate Limiting

- **Per-user**: 5 req/min
- **Per-IP**: 20 req/min
- **Storage**: Redis primary, in-memory fallback
- Emits `X-RateLimit-*` headers and `Retry-After` on 429

### Semantic Caching

- Key derived from `text + task + itemCount`
- TTL: 7 days
- Cached responses still count toward quota

### Usage Tracking

Two tracking systems:
- `LlmUsage` — Legacy per-call cost tracking with micro-dollar precision
- `LlmGatewayLog` — Gateway analytics with model selection, latency, caching, depth

### Mock Mode

```bash
OPENAI_MOCK=1
GEMINI_MOCK=1
DEEPSEEK_MOCK=1
```

---

## Materials Management

### Overview

Upload and manage learning materials (PDFs, URLs, text) with AI-powered flashcard/quiz generation.

### Data Model

```typescript
interface Material {
  id: string
  title: string
  content: string         // Extracted/input text
  type?: string           // "pdf" | "video" | "audio" | "text"
  metadata?: Json         // Extensible metadata
  llmModel?: string       // Preferred LLM model
  llmPrompt?: string      // Custom prompt
  workspaceId: string
  createdAt: Date
  updatedAt: Date
  flashcards: Flashcard[] // Generated flashcards
  questions: Question[]   // Generated questions
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/materials` | GET | List by workspace |
| `/api/materials` | POST | Create material |
| `/api/materials/upload` | POST | Upload file (PDF, DOCX) |
| `/api/materials/[id]` | GET | Get single |
| `/api/materials/[id]` | PATCH | Update |
| `/api/materials` | DELETE | Delete |

### Flashcard/Quiz Generation

Generation is done via the LLM gateway:
```typescript
const result = await gatewayService.generateFlashcards(material.content, {
  materialId: material.id,
  save: true,
  replace: false, // append by default
})
```

When `replace=true`, old flashcards/questions and their CardReviews are cascade-deleted within a transaction.

---

## Workspaces & Organization

### Overview

Flat content organization with ordering. Each workspace groups notes, materials, flashcards, and questions.

> **Note**: Workspaces are flat — there is no hierarchy or nesting. Ordering is managed via the `order` field with a `@@unique([userId, order])` constraint.

### Data Model

```typescript
interface Workspace {
  id: string
  title: string
  description?: string
  metadata?: Json
  order: number
  rawText?: string
  llmModel: string       // Default: "gpt-3.5"
  userId: string
  createdAt: Date
  updatedAt: Date

  // Relations
  notes: Note[]
  materials: Material[]
  flashcards: Flashcard[]
  questions: Question[]
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workspaces` | GET | List user's workspaces |
| `/api/workspaces` | POST | Create workspace |
| `/api/workspaces/[id]` | GET | Get with contents |
| `/api/workspaces/[id]` | PATCH | Update |
| `/api/workspaces/[id]` | DELETE | Delete (cascade) |
| `/api/workspaces/count` | GET | Get workspace count |

### Cascade Delete

Deleting a workspace removes all contained notes, materials, flashcards, and questions via Prisma's `onDelete: Cascade`.

---

## Kanban Board

### Overview

Drag-and-drop Kanban board for task organization with customizable columns and tagged items.

> **Note**: `/board` currently has no entry in the mobile tab bar (`app/components/shell/MobileTabBar.vue`) or the app launcher (`app/components/home/AppLauncher.vue`). The route still works fully when reached directly — it's just not linked from primary navigation right now.

### Data Models

```typescript
interface BoardColumn {
  id: string
  name: string
  order: number
  userId: string
  items: BoardItem[]
  createdAt: Date
  updatedAt: Date
}

interface BoardItem {
  id: string
  content: string
  tags: string[]       // Color-coded tags
  order: number
  userId: string
  columnId?: string    // Optional column assignment
  createdAt: Date
  updatedAt: Date
}
```

### API Endpoints

**Board Columns**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board-columns` | GET | List columns |
| `/api/board-columns` | POST | Create column |
| `/api/board-columns/[id]` | PATCH | Update column |
| `/api/board-columns/[id]` | DELETE | Delete column |
| `/api/board-columns/reorder` | PATCH | Reorder columns |

**Board Items**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board-items` | GET | List items |
| `/api/board-items` | POST | Create item |
| `/api/board-items/[id]` | PATCH | Update item |
| `/api/board-items/[id]` | DELETE | Delete item |
| `/api/board-items/reorder` | PATCH | Reorder items |

**Board Item Comments**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board-item-comments` | GET | List comments on a board item |
| `/api/board-item-comments` | POST | Add a comment to a board item |

**Board Item Links**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board-item-links` | GET | List links for a board item |
| `/api/board-item-links` | POST | Link two board items together |
| `/api/board-item-links/[linkId]` | DELETE | Remove a link |

**Board Integrations** — connecting external providers (OAuth accounts) and importing their items onto the board:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/board-integrations/accounts` | GET | List connected integration accounts |
| `/api/board-integrations/accounts/[id]` | DELETE | Disconnect an integration account |
| `/api/board-integrations/oauth/[provider]/start` | GET | Begin OAuth connect flow |
| `/api/board-integrations/oauth/[provider]/callback` | GET | OAuth callback handler |
| `/api/board-integrations/sources` | GET | List importable sources for a connected account |
| `/api/board-integrations/import` | POST | Import external items onto the board |
| `/api/board-integrations/item-refs` | GET | Look up board items linked to external references |
| `/api/board-integrations/mappings` | GET/POST | Get/create field mappings for a provider |
| `/api/board-integrations/diagnostics` | GET | Integration health diagnostics |

### Composables

```typescript
// useBoardColumnsStore.ts — Column management
// useBoardItemsStore.ts — Item management with drag-and-drop
```

---

## User Tags

### Overview

Color-coded tags for organizing board items. Tags are user-scoped with unique names per user.

### Data Model

```typescript
interface UserTag {
  id: string
  name: string
  color: string     // Hex color, default "#3b82f6"
  order: number
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

### Composable

```typescript
// useUserTagsStore.ts — Tag CRUD and management
```

---

## On-Device AI

### Overview

Client-side AI features running in web workers using @huggingface/transformers. This keeps AI processing off the main thread and works offline.

### AI Worker

Built from `sw-src/ai-worker.ts` → `public/ai-worker.js` via esbuild.

### Composables

| Composable | Purpose |
|------------|---------|
| `useAIStore` | AI worker lifecycle management, model loading state |
| `useLocalMathRecognition` | Local math OCR using Hugging Face models |
| `useMathRecognition` | Orchestrator — local model + MyScript fallback |
| `useSpeachToText` | Speech-to-text transcription |
| `useTextSummarization` | Text summarization |
| `useTextToSpeechWorker` | Text-to-speech synthesis |

### MyScript Integration

Server-side proxy at `POST /api/ai/myscript` for stroke-based handwriting recognition:
- Receives raw stroke data (x, y coordinates)
- Signs requests with HMAC-SHA512
- Proxies to MyScript Cloud API
- Returns recognized math (LaTeX)

### Math Rendering

- **KaTeX** for rendering LaTeX math expressions
- **mathjs** for evaluating mathematical expressions

---

## Push Notifications

### Overview

Review reminder notifications via Web Push API with timezone-aware scheduling.

### Data Models

**Notification Subscription**:
```typescript
interface NotificationSubscription {
  id: string
  endpoint: string
  keys: { auth: string; p256dh: string }
  userId?: string
  isActive: boolean
  failureCount: number
  lastSeen?: Date
  userAgent?: string
  deviceInfo?: Json
  expiresAt?: Date
  createdAt: Date
}
```

**Scheduled Notification**:
```typescript
interface ScheduledNotification {
  id: string
  userId: string
  type: string           // 'CARD_DUE' | 'STUDY_REMINDER' | 'DAILY_REVIEW'
  cardId?: string
  scheduledFor: Date
  sent: boolean
  sentAt?: Date
  metadata?: Json        // Card count, workspace info, etc.
  failureCount: number
  lastError?: string
  createdAt: Date
  updatedAt: Date
}
```

**User Notification Preferences**:
```typescript
interface UserNotificationPreferences {
  // Card due notifications
  cardDueEnabled: boolean
  cardDueTime: string        // "HH:mm" format, default "09:00"
  cardDueThreshold: number   // Notify when >= N cards due, default 5

  // Daily reminders
  dailyReminderEnabled: boolean
  dailyReminderTime: string  // Default "19:00"

  // General
  timezone: string           // Default "UTC"
  quietHoursEnabled: boolean
  quietHoursStart: string    // Default "22:00"
  quietHoursEnd: string      // Default "08:00"

  // Advanced timing
  sendAnytimeOutsideQuietHours: boolean
  activeHoursEnabled: boolean
  activeHoursStart: string
  activeHoursEnd: string

  // Snooze
  snoozedUntil?: Date
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications/subscribe` | POST | Create push subscription |
| `/api/notifications/unsubscribe` | POST | Remove subscription |
| `/api/notifications/preferences` | GET/PUT | Get/update preferences |
| `/api/notifications/subscriptions` | GET | List subscriptions |
| `/api/notifications/send` | POST | Send notification |
| `/api/notifications/snooze` | POST | Snooze notifications |
| `/api/notifications/test` | POST | Test notification |
| `/api/notifications/recent` | GET | Recent notifications |
| `/api/notifications/vapid-key` | GET | Get VAPID public key |
| `/api/notifications/cron/` | - | Cron-triggered dispatch |

### Backend Services

- **NotificationScheduler** — Schedules reminders based on `nextReviewAt`, de-duplicates per card
- **CronManager** — Manages scheduled cron jobs for notification dispatch

---

## PWA & Offline Support

### Overview

Full progressive web app with offline support via Workbox service worker.

### Build Pipeline

```
sw-src/index.ts     → esbuild → public/sw.js        (service worker)
sw-src/ai-worker.ts → esbuild → public/ai-worker.js (AI web worker)
```

### Caching Strategies

| Content Type | Strategy | Rationale |
|--------------|----------|-----------|
| API responses | NetworkFirst | Fresh data preferred |
| Static assets | CacheFirst | Immutable files |
| Pages | StaleWhileRevalidate | Balance freshness/speed |
| Images | CacheFirst | Large, rarely change |

### IndexedDB Structure

Source of truth: [`app/utils/constants/pwa.ts`](../app/utils/constants/pwa.ts) (`DB_CONFIG`) — don't hand-copy the full store list here, it drifts. Currently: database `recwide_db`, version 20, with 19 object stores spanning notes, board, tags, and the generic Offline V2 sync queue, e.g.:

```typescript
export const DB_CONFIG = {
  NAME: "recwide_db",
  VERSION: 20,
  STORES: {
    NOTES: "notes",
    BOARD_ITEMS: "boardItems",
    OFFLINE_ENTITIES: "offlineEntities",    // generic Offline V2 sync queue
    OFFLINE_MUTATIONS: "offlineMutations",
    // ...15 more — see the source file for the full, current list
  },
} as const
```

### Background Sync

```typescript
const SYNC_TAGS = {
  FORM_SYNC: 'form-sync',
  NOTES_SYNC: 'notes-sync',
}
```

### Offline Flow

1. User edits note offline
2. Note saved to IndexedDB + pendingNotes
3. Service worker registers `notes-sync` tag
4. Network restored → sync event fires
5. `POST /api/notes/sync` with pending notes
6. Server responds with canonical state
7. IndexedDB updated, pending cleared

---

## Subscription & Quota

### Overview

Tiered subscription system controlling LLM generation access.

### Data Model

```typescript
interface UserSubscription {
  id: string
  userId: string
  tier: 'FREE' | 'PRO' | 'ENTERPRISE'
  periodStart: Date
  periodEnd?: Date
  generationsUsed: number     // Counter for this period
  generationsQuota: number    // Default 10 for FREE
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Quota Behavior

| Tier | Quota | Behavior |
|------|-------|----------|
| FREE | 10 generations | Decrements on each use |
| PRO | Unlimited | No decrement |
| ENTERPRISE | Unlimited | No decrement |

### API

- `GET /api/subscription/status` — Get current subscription status
- Quota is checked/incremented within the LLM gateway handler

---

## Authentication

### Overview

Multi-method authentication with credentials, passkeys (WebAuthn), and session management.

### Auth Stack

```
@sidebase/nuxt-auth (Nuxt module)
        ↓
NextAuth.js (Core)
        ↓
├── Credentials Provider (bcrypt)
└── Passkey / WebAuthn (SimpleWebAuthn)
        ↓
Prisma Adapter → MongoDB
```

### Session Management

- JWT-based sessions stored in httpOnly cookies
- Validated on each server request
- Client access via `useAuth()` composable

### Passkey Support

Uses `@simplewebauthn/browser` (client) and `@simplewebauthn/server` for WebAuthn-based passwordless login. Credentials stored in `publickeycreds` Prisma model.

### Password Handling

```typescript
// Registration
const hashedPassword = await bcrypt.hash(password, rounds)

// Login validation
const isValid = await bcrypt.compare(password, user.password)
```

### User Soft Delete

Users have `deletedAt` and `scheduledDeletionAt` fields for soft deletion with a 30-day grace period before permanent removal.

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design and data model
- **[LLM_GENERATION_FLOW.md](./LLM_GENERATION_FLOW.md)** — End-to-end LLM generation trace
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Setup and debugging
- **[MAINTENANCE.md](./MAINTENANCE.md)** — Operations and known issues
