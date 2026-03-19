# Cognilo Features Documentation

> Detailed documentation of all major features and their implementations.  
> **Last Updated**: Based on source code analysis

---

## Table of Contents
1. [Notes System](#notes-system)
2. [Spaced Repetition (SM-2)](#spaced-repetition-sm-2)
3. [XP & Gamification](#xp--gamification)
4. [LLM Content Generation](#llm-content-generation)
5. [Materials Management](#materials-management)
6. [Folders & Organization](#folders--organization)
7. [Push Notifications](#push-notifications)
8. [PWA & Offline Support](#pwa--offline-support)
9. [Authentication](#authentication)

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

### Ease Factor (EF) - Deep Dive

#### What is Ease Factor?

**Ease Factor** is a multiplier (typically 1.3 to 3.0+) that represents **how easy a card is for you personally**. It's used to calculate how long to wait before showing the card again:

```
Next Interval = Previous Interval × Ease Factor
```

#### The SM-2 Ease Factor Formula

The formula adjusts EF based on your grade:

```
EF' = EF + (0.1 - (5 - grade) × (0.08 + (5 - grade) × 0.02))
```

**Calculated changes for each grade:**

| Grade | Change to EF | Meaning |
|-------|--------------|---------|
| 0 | **-0.80** | Complete blackout |
| 1 | **-0.54** | Incorrect, remembered after seeing answer |
| 2 | **-0.32** | Incorrect, difficult to recall |
| 3 | **-0.14** | Correct, with difficulty |
| 4 | **±0.00** | Correct, some hesitation |
| 5 | **+0.10** | Perfect response |

#### Why Asymmetric Penalties?

Notice penalties are **much harsher** than rewards:
- Worst case (grade 0): **-0.80**
- Best case (grade 5): **+0.10**

**Rationale**: Forgetting is more costly than remembering. If you forget once, you likely need more practice. The algorithm is "pessimistic" - it's better to review too often than too little.

#### Floor Protection (Minimum EF = 1.3)

EF can never go below 1.3, preventing "death spiral" where a card becomes impossibly frequent:

```typescript
if (easeFactor < 1.3) {
  easeFactor = 1.3;
}
```

A card with EF = 1.3 needs **many perfect reviews** to recover:
- 1.3 → 1.4 → 1.5 → 1.6 → ... (only +0.1 per perfect grade 5)

This ensures you really know the material before intervals get long again.

#### How EF Affects Review Intervals

**Example: Two Cards with Different EFs**

**Card A** (Easy, EF = 2.8):
```
Review 3: interval = 6 × 2.8 = 17 days
Review 4: interval = 17 × 2.8 = 48 days
Review 5: interval = 48 × 2.8 = 134 days
```

**Card B** (Hard, EF = 1.4):
```
Review 3: interval = 6 × 1.4 = 8 days
Review 4: interval = 8 × 1.4 = 11 days
Review 5: interval = 11 × 1.4 = 15 days
```

**Visual Comparison:**
```
Days from enrollment:

Card A (EF=2.8): |1|---6---|--------17--------|----------------48----------------|
Card B (EF=1.4): |1|---6---|--8--|---11---|----15----|---21---|----29----|

Card A: Reviewed 4 times in ~70 days
Card B: Reviewed 7 times in ~70 days
```

#### Card Categories by Repetition Count

| Category | Definition | Query in Code |
|----------|------------|---------------|
| **New** | Never reviewed (repetitions = 0) | `repetitions: 0` |
| **Learning** | Reviewed 1-2 times | `repetitions: { gt: 0, lt: 3 }` |
| **Due** | Review time has passed | `nextReviewAt: { lte: new Date() }` |
| **Mature** | 3+ successful reviews | `repetitions: { gte: 3 }` |

#### Summary Table

| Aspect | Value/Purpose |
|--------|---------------|
| **What** | Multiplier for calculating next review interval |
| **Range** | 1.3 (hardest) to ~3.0+ (easiest) |
| **Initial Value** | 2.5 (neutral starting point) |
| **Adjusts Based On** | Your grade (0-5) each review |
| **Key Insight** | Penalties are much larger than rewards (asymmetric) |
| **Protection** | Minimum 1.3 prevents infinite loops |
| **Effect** | Low EF = frequent reviews, High EF = infrequent reviews |
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
  cardId: string           // Polymorphic: Flashcard.id, Material.id, or Question.id
  resourceType: 'flashcard' | 'material' | 'question'
  
  // SM-2 state
  repetitions: number      // Times correctly recalled
  easeFactor: number       // 1.3 - 2.5 (difficulty)
  intervalDays: number     // Days until next review
  nextReviewAt: Date       // Scheduled review date
  lastReviewedAt?: Date
  lastGrade?: number       // Last grade (0-5)
  
  // Analytics
  streak: number           // Consecutive correct reviews
  suspended: boolean       // Allow users to pause reviews
  
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

- `EnrollButton.vue` - One-click enrollment (supports material, flashcard, and question)
- `CardReviewInterface.vue` - Full review UI with flip animation
- `ReviewAnalyticsSummary.vue` - Statistics dashboard
- `ReviewDebugPanel.vue` - Dev-only algorithm testing

### Question Enrollment Support

**Overview**: Questions generated from materials can be enrolled in spaced repetition, providing the same review workflow as flashcards.

**Supported Resource Types**:
- `material` - Direct material content review
- `flashcard` - Traditional Q&A card review
- `question` - Multiple-choice questions with validation

**Question Review Data Model**:
```typescript
interface QuestionResource {
  question: string         // Question text
  choices: string[]        // Array of answer choices
  answerIndex: number      // Index of correct answer (0-based)
  folderId: string         // Parent folder
}
```

**Queue Integration**:
Questions are fetched alongside flashcards and materials in the review queue:
```typescript
// Parallel fetching for optimal performance
const [materials, flashcards, questions, folders] = await Promise.all([
  prisma.material.findMany({ where: { id: { in: cardIds } } }),
  prisma.flashcard.findMany({ where: { id: { in: cardIds } } }),
  prisma.question.findMany({ where: { id: { in: cardIds } } }),
  prisma.folder.findMany({ where: { id: { in: folderIds } } }),
]);
```

**UI Implementation** (`Questions.vue`):
- Enrollment status tracking via `enrolledQuestions` Set
- `checkEnrollmentStatus()` - Bulk status check on mount/watch
- `ReviewEnrollButton` component with `resource-type="question"`
- Visual indicators (checkmark badge) for enrolled questions
- Event handlers for enrollment success/error

---

## XP & Gamification

### Overview

Experience points (XP) system to encourage consistent learning through spaced repetition reviews and card enrollment.

### XP Calculation

**Review XP Formula**:
```typescript
// 1. Difficulty Multiplier (based on ease factor)
difficultyMultiplier = clamp(3.0 - easeFactor, 0.5, 2.0)

// 2. Spacing Multiplier (based on interval)
spacingMultiplier = clamp(log2(intervalDays + 1), 0.5, 3.0)

// 3. Grade Multiplier
gradeMultiplier = {
  5: 1.4,  // Perfect recall
  4: 1.2,  // Correct with hesitation
  3: 1.0,  // Correct with difficulty
  2: 0.6,  // Incorrect, recalled easily
  1: 0.4,  // Incorrect, correct shown
  0: 0.2,  // Complete blackout
}

// 4. Late Bonus (reviewing overdue cards)
daysLate = max(0, daysBetween(now, nextReviewAt))
lateBonus = clamp(1 + daysLate * 0.1, 1.0, 1.5)

// 5. Raw XP
rawXP = BASE_XP * difficultyMultiplier * spacingMultiplier * gradeMultiplier * lateBonus

// 6. Daily Diminishing Returns (progressive tax after target)
if (dailyXP < DAILY_XP_TARGET) {
  effectiveXP = rawXP
} else {
  surplus = dailyXP - DAILY_XP_TARGET
  taxRate = clamp(surplus / 100, 0.0, 0.9)
  effectiveXP = rawXP * (1 - taxRate)
}
```

**Enrollment XP Formula**:
```typescript
// Base XP for enrolling a card
baseEnrollXP = 3

// Daily diminishing returns (same as review XP)
if (dailyXP < DAILY_XP_TARGET) {
  effectiveXP = baseEnrollXP
} else {
  surplus = dailyXP - DAILY_XP_TARGET
  taxRate = clamp(surplus / 100, 0.0, 0.9)
  effectiveXP = baseEnrollXP * (1 - taxRate)
}
```

**Constants**:
- `BASE_XP = 5`
- `DAILY_XP_TARGET = 300`

### Data Models

**XpEvent**:
```typescript
interface XpEvent {
  id: string
  userId: string
  cardId?: string        // Card that triggered XP (null for non-card events)
  source: string         // "review" | "enroll" | "achievement"
  xp: number             // Effective XP earned (after diminishing returns)
  createdAt: Date
}
```

**Achievement**:
```typescript
interface Achievement {
  id: string
  userId: string
  type: AchievementType  // DAILY_STREAK | WEEKLY_STREAK | CARD_MASTERED | CARD_REVIEWED | CARD_REVIEWED_100
  unlockedAt: Date
}

enum AchievementType {
  DAILY_STREAK
  WEEKLY_STREAK
  CARD_MASTERED
  CARD_REVIEWED
  CARD_REVIEWED_100
}
```

### Key Features

**Idempotent XP Awards**:
```typescript
// Check if XP already awarded for this event
const existingXp = await prisma.xpEvent.findFirst({
  where: {
    userId: user.id,
    cardId: card.cardId,
    source: "enroll" // or "review"
  }
});

if (!existingXp) {
  // Award XP only if not already awarded
  await prisma.xpEvent.create({
    data: { userId, cardId, source, xp: effectiveXP }
  });
}
```

**Daily XP Tracking**:
```typescript
// Get today's accumulated XP
const dayStart = startOfDay(now);
const dayEnd = endOfDay(now);

const DailyXpAggregate = await prisma.xpEvent.aggregate({
  where: {
    userId: user.id,
    createdAt: { gte: dayStart, lte: dayEnd }
  },
  _sum: { xp: true }
});

const currentDailyXP = DailyXpAggregate._sum.xp ?? 0;
```

**Progressive Tax System**:
- Prevents XP grinding beyond daily target
- First 300 XP: Full value
- 301-400 XP: 90% value
- 401-500 XP: 80% value
- Beyond 1000 XP: 10% value (90% tax rate)

### Integration Points

**Review Grade Endpoint**:
- Calculates XP based on grade, difficulty, spacing, and lateness
- Applies daily diminishing returns
- Stores XpEvent record

**Card Enrollment Endpoint**:
- Awards 3 base XP for first enrollment
- Applies daily diminishing returns
- Checks for duplicate XP events

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
  name: 'cognilo-ai-db',
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
