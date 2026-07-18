# Cognilo Architecture

> System design reference for the Cognilo AI-powered learning platform.
> **Last Updated**: June 2026 (providers, IndexedDB stores reconciled against code)

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

Cognilo is a **Nuxt 4** application providing AI-powered flashcard generation, quiz creation, and spaced repetition learning. Key architectural characteristics:

- **Hybrid SSR/SPA**: Server-side rendering with client-side hydration
- **Local-First Notes**: IndexedDB persistence with background sync
- **Strategy Pattern LLM**: Pluggable AI providers (OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter)
- **PWA-Native**: Full offline support via Workbox service worker
- **On-Device AI**: Web worker–based math recognition, speech-to-text, summarization

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐│
│  │ Vue 3 SFC   │  │ Pinia Store │  │ Service Worker (Workbox) ││
│  │ Components  │  │ + IndexedDB │  │ + Push + Background Sync ││
│  └─────────────┘  └─────────────┘  └──────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ AI Worker (Web Worker): Math Recognition, STT, TTS, Summary││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Service Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ FetchFactory    │  │ ServiceFactory  │                      │
│  │ (Result pattern)│  │ (API bindings)  │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nitro Server (API)                         │
│  ┌─────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │ API Routes  │  │ Rate Limiter  │  │ Auth (NextAuth.js)    │ │
│  │ /api/*      │  │ Redis/Memory  │  │ + Passkey (WebAuthn)  │ │
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
| Nuxt | 4.x | Meta-framework (SSR/SPA) |
| Vue | 3.5+ | UI library (Composition API) |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 4.x | Utility-first CSS |
| Pinia | 2.x | State management |
| shadcn-vue / Nuxt UI | 4.x | Component library |
| Tiptap | 3.x | Rich text editor |
| KaTeX | - | Math rendering |
| @huggingface/transformers | 3.8 | On-device AI models |
| motion-v | - | Animations |
| VueUse | 13.x | Composition utilities |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Nitro / H3 | - | Server engine (bundled with Nuxt) |
| Prisma | 4.8 | ORM for MongoDB |
| MongoDB | 5.x | Document database |
| Redis | - | Rate limiting, semantic caching (optional) |
| @sidebase/nuxt-auth | 0.9+ | Authentication (NextAuth wrapper) |
| SimpleWebAuthn | 13.x | Passkey / WebAuthn support |
| Zod | 4.x | Schema validation (shared contracts) |
| web-push | 3.x | Push notifications |

### LLM Providers
| Provider | Strategy | Models |
|----------|----------|--------|
| OpenAI | `OpenAIStrategy` | gpt-3.5-turbo, gpt-4o-mini, gpt-4o |
| Google Gemini | `GeminiStrategy` | gemini-2.0-flash-lite, gemini-1.5-flash-8b |
| DeepSeek | `DeepSeekStrategy` | deepseek-chat, deepseek-reasoner |
| Groq | `GroqStrategy` | llama-3.1-8b-instant, qwen-qwq-32b, llama-4-scout-17b |
| OpenRouter | `OpenRouterStrategy` | (aggregator — routes to many upstream models) |

### PWA
| Technology | Purpose |
|------------|---------|
| Workbox 7 | Service worker toolkit |
| IndexedDB | Client-side persistence |
| web-push | Push notifications |

---

## Directory Structure

```
cognilo/
├── app/                          # Nuxt app source (srcDir)
│   ├── components/               # Vue components
│   │   ├── workspace/               # Workspace-specific (NotesSection, etc.)
│   │   ├── materials/            # Materials UI (GenerateButton, etc.)
│   │   ├── review/               # SR review UI
│   │   └── ui/                   # Base UI components (shadcn-vue)
│   ├── composables/              # Vue composables
│   │   ├── ai/                   # AI-related composables
│   │   │   ├── useAIStore.ts     # AI worker management
│   │   │   ├── useLocalMathRecognition.ts
│   │   │   ├── useMathRecognition.ts
│   │   │   ├── useSpeachToText.ts
│   │   │   ├── useTextSummarization.ts
│   │   │   └── useTextToSpeechWorker.ts
│   │   ├── workspaces/              # Workspace, notes, materials, review composables
│   │   │   ├── useWorkspaces.ts
│   │   │   ├── useNotesStore.ts
│   │   │   ├── useMaterialsStore.ts
│   │   │   └── useCardReview.ts
│   │   ├── materials/            # useGenerateFromMaterial
│   │   ├── review/               # Review session composables
│   │   │   ├── useCardDisplay.ts
│   │   │   ├── useDebugControls.ts
│   │   │   ├── useWorkspaceEnrollment.ts
│   │   │   ├── useReviewStats.ts
│   │   │   ├── useSessionSummary.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── shared/               # useDataFetch, useOperation
│   │   ├── tags/                 # useUserTagsStore
│   │   ├── ui/                   # UI composables
│   │   └── user/                 # User composables
│   ├── domain/                   # Domain logic (DDD)
│   │   └── sr/                   # Spaced repetition domain
│   ├── features/                 # Incremental frontend feature modules
│   │   ├── review/               # Review feature slice
│   │   │   ├── containers/       # Route/page orchestration components
│   │   │   ├── components/       # Feature-owned UI
│   │   │   ├── composables/      # Feature workflows and state
│   │   │   └── services/         # Feature API service implementation
│   │   ├── language-learning/    # Language capture, word bank, and language review
│   │   │   ├── containers/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   └── services/
│   │   ├── notifications/        # Push subscription, prompts, and preferences UI
│   │   │   ├── components/
│   │   │   └── composables/
│   │   ├── materials/            # Material upload/listing and generation UI
│   │   │   ├── components/
│   │   │   └── composables/
│   │   ├── notes/                # Workspace notes UI, local-first state, notes API client
│   │   │   ├── containers/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   └── services/
│   │   └── board/                # Board UI, board state, board API clients
│   │       ├── containers/
│   │       ├── components/
│   │       ├── composables/
│   │       └── services/
│   ├── layouts/                  # Page layouts
│   ├── middleware/               # Route middleware
│   ├── pages/                    # File-based routing
│   ├── plugins/                  # Nuxt plugins
│   ├── services/                 # API service layer
│   │   ├── FetchFactory.ts       # HTTP client with Result pattern
│   │   ├── ServiceFactory.ts     # Service bindings (10 services)
│   │   ├── GatewayService.ts     # LLM gateway client
│   │   ├── Workspace.ts
│   │   ├── Material.ts
│   │   ├── Note.ts
│   │   ├── ReviewService.ts
│   │   ├── BoardItem.ts
│   │   ├── BoardColumn.ts
│   │   ├── AuthService.ts
│   │   ├── UserService.ts
│   │   └── UserTagService.ts
│   └── types/                    # TypeScript types
├── server/                       # Nitro server
│   ├── api/                      # API endpoints
│   │   ├── admin/                # Admin APIs
│   │   ├── ai/                   # AI proxy (MyScript)
│   │   ├── auth/                 # Authentication
│   │   ├── board-columns/        # Kanban columns CRUD
│   │   ├── board-items/          # Kanban items CRUD
│   │   ├── flashcards/           # Flashcard queries
│   │   ├── workspaces/              # Workspace CRUD
│   │   ├── materials/            # Materials CRUD + upload
│   │   ├── monitoring/           # Health monitoring
│   │   ├── notes/                # Notes CRUD + sync
│   │   ├── notifications/        # Push notifications + cron
│   │   ├── questions/            # Question queries
│   │   ├── review/               # Spaced repetition
│   │   ├── subscription/         # Subscription status
│   │   ├── templates/            # Templates
│   │   ├── user/                 # User management
│   │   ├── ai-worker.get.ts      # AI worker endpoint
│   │   ├── llm.gateway.post.ts   # Smart LLM gateway
│   │   └── llm-usage.get.ts      # Usage analytics
│   ├── services/                 # Backend services
│   │   ├── NotificationScheduler.ts
│   │   └── CronManager.ts
│   └── utils/                    # Server utilities
│       └── llm/                  # LLM strategies & routing
│           ├── LLMStrategy.ts    # Strategy interface
│           ├── LLMFactory.ts     # Factory (legacy + registry)
│           ├── OpenAIStrategy.ts  # OpenAI provider
│           ├── GeminiStrategy.ts # Google provider
│           ├── DeepSeekStrategy.ts # DeepSeek provider
│           ├── GroqStrategy.ts   # Groq provider
│           ├── routing.ts        # Smart model selection
│           ├── cache.ts          # Semantic caching
│           ├── rateLimit.ts      # Rate limiter
│           ├── adaptiveCount.ts  # Adaptive item count
│           ├── gatewayLogger.ts  # Gateway analytics
│           ├── modelRegistry.ts  # Model registry
│           ├── prompts.ts        # Prompt templates
│           └── tokenEstimate.ts  # Token estimation
├── shared/                       # Shared code (client + server)
│   ├── auth.schemas.ts           # Auth validation
│   ├── types/                    # Shared types
│   │   ├── ai-messages.ts
│   │   ├── offline.ts
│   │   └── sw-messages.ts
│   └── utils/                    # Shared contracts (Zod)
│       ├── auth.contract.ts
│       ├── boardColumn.contract.ts
│       ├── boardItem.contract.ts
│       ├── flashcard.contract.ts
│       ├── workspace.contract.ts
│       ├── llm-generate.contract.ts
│       ├── material.contract.ts
│       ├── note.contract.ts
│       ├── note-sync.contract.ts
│       ├── notification.contract.ts
│       ├── review.contract.ts
│       ├── user.contract.ts
│       └── user-tag.contract.ts
├── sw-src/                       # Service worker + AI worker source
│   ├── index.ts                  # Workbox SW (push, sync, cache)
│   └── ai-worker.ts             # On-device AI web worker
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # LLM pricing seed data
├── docs/                         # Documentation
├── scripts/                      # Build/migration scripts
└── tests/                        # Playwright tests
```

---

## Frontend Feature Modules

Frontend migration follows the backend modular-monolith direction, but remains incremental.

Rules:

- `app/pages/*` should become thin route adapters that render feature containers.
- `app/features/<feature>/containers` owns route-level UI orchestration for that feature.
- `app/features/<feature>/composables` owns feature workflows and state.
- `app/features/<feature>/services` owns feature API clients.
- Existing `app/components/*` and `app/composables/*` auto-import paths remain compatibility entrypoints until each feature is safely migrated.

Nuxt auto-import policy:

- Do not rely on Nuxt auto-import discovery inside `app/features/*`.
- Feature internals should use explicit imports.
- If an existing auto-imported name is already used widely, keep a small wrapper in `app/composables/*` or `app/services/*` that re-exports the feature implementation.
- Move visual components only after the feature container/composable/service boundary is stable, so component auto-import names do not change unexpectedly.

Current frontend slice:

- `review` owns `ReviewPageContainer`, `ReviewService`, review queue workflow, review stats, and session summary.
- Legacy entrypoints such as `useCardReview`, `useReviewStats`, `useSessionSummary`, and `app/services/ReviewService.ts` remain as compatibility wrappers.
- `language-learning` owns language pages, language service, language capture/review/stats workflows, speech capture, and language UI components.
- Legacy entrypoints such as `useLanguageCapture`, `useLanguageReview`, `useLanguageStats`, `useSpeechCapture`, and `app/services/LanguageService.ts` remain as compatibility wrappers.
- `notifications` owns push subscription, prompt timing, and notification preferences UI.
- Legacy entrypoints such as `useNotifications`, `useNotificationPrompt`, `NotificationSubscriptionModal`, and `NotificationPreferences` remain as compatibility wrappers.
- `materials` owns material upload/listing UI and material generation workflow state.
- Legacy entrypoints such as workspace hub material components and `useGenerateFromMaterial` remain as compatibility wrappers.
- `notes` owns the workspace notes panel, grouped notes drawer, note search, text/math/canvas note editors, local-first note state, note group state, and the notes API clients.
- Legacy entrypoints such as `WorkspaceNotesSection`, workspace note editor components, `useNotesStore`, and `app/services/Note.ts` remain as compatibility wrappers. Note groups use feature-owned frontend entrypoints plus `app/services/NoteGroup.ts` as the service compatibility wrapper.
- `board` owns the workspace board panel, kanban/list views, board cards, filters, board item/column stores, and board API clients.
- Legacy entrypoints such as `BoardNotesSection`, `app/components/board/*`, `useBoardItemsStore`, `useBoardColumnsStore`, `app/services/BoardItem.ts`, and `app/services/BoardColumn.ts` remain as compatibility wrappers.

Architecture fitness:

- `yarn arch:check` enforces server module boundaries and prevents frontend feature internals from importing their own legacy wrapper paths.
- Server domain code must remain framework- and persistence-free.
- Cross-feature behavior should go through ports, shared contracts, or explicit shared UI/composables rather than another feature's legacy wrapper.

---

## Data Model

### Core Entities (Prisma Schema)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │────<│    Workspace    │────<│   Material   │
│              │     │              │     │              │
│ - email      │     │ - title      │     │ - title      │
│ - password   │     │ - order      │     │ - type       │
│ - role       │     │ - llmModel   │     │ - content    │
│ - passkey    │     │ - metadata   │     │ - metadata   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    ├───────────<┬───────┘
       │                    │            │
       │             ┌──────────────┐  ┌──────────────┐
       │             │  Flashcard   │  │   Question   │
       │             │              │  │              │
       │             │ - front      │  │ - question   │
       │             │ - back       │  │ - choices    │
       │             │ - sourceRef  │  │ - answerIndex│
       │             │ - status     │  │ - sourceRef  │
       │             └──────┬───────┘  └──────┬───────┘
       │                    │                  │
       │                    └────────┬─────────┘
       │                             ▼
       │                      ┌──────────────┐
       │                      │  CardReview  │
       │                      │   (SM-2)     │
       │                      │              │
       │                      │ - easeFactor │
       │                      │ - interval   │
       │                      │ - resourceType│
       │                      └──────────────┘
       │
       ├────<┌──────────────┐    ┌──────────────┐
       │     │  BoardColumn │───<│  BoardItem   │
       │     │  - name      │    │  - content   │
       │     │  - order     │    │  - tags      │
       │     └──────────────┘    │  - order     │
       │                         └──────────────┘
       │
       ├────<┌──────────────┐    ┌──────────────┐
       │     │   UserTag    │    │    Note      │
       │     │  - name      │    │  - content   │
       │     │  - color     │    │  - tags      │
       │     │  - order     │    │  - noteType  │
       │     └──────────────┘    │  - order     │
       │                         └──────────────┘
       │
       └────<┌──────────────────┐
             │ UserSubscription │
             │  - tier (FREE/   │
             │    PRO/ENTERPRISE│
             │  - generationsUsed│
             │  - generationsQuota│
             └──────────────────┘
```

### Key Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `User` | Authentication | email, password, role, passkey_user_id, deletedAt |
| `Workspace` | Content grouping | title, order, userId, llmModel, metadata, rawText |
| `Material` | Learning content | title, type, content, metadata, llmModel, workspaceId |
| `Flashcard` | Q&A pairs | front, back, workspaceId, materialId, sourceRef, status |
| `Question` | Quiz questions | question, choices, answerIndex, workspaceId, materialId, sourceRef |
| `Note` | User notes | content (rich text), order, tags, noteType, metadata |
| `BoardColumn` | Kanban column | name, order, userId |
| `BoardItem` | Kanban item | content, tags, order, userId, columnId |
| `UserTag` | Color-coded tag | name, color, order, userId |
| `CardReview` | SM-2 state | easeFactor, intervalDays, nextReviewAt, resourceType, streak |
| `XpEvent` | XP tracking | userId, cardId, source, xp |
| `Achievement` | User achievements | userId, type (enum), streak |
| `GradeRequest` | Grade idempotency | requestId, cardId, grade |
| `LlmPrice` | Legacy pricing | provider, model, inputPer1kMicros, outputPer1kMicros |
| `LlmUsage` | Legacy cost tracking | tokens, cost (micro-dollars), model, userId |
| `LlmModelRegistry` | Model config | modelId, provider, inputCostPer1M, outputCostPer1M, healthStatus |
| `LlmGatewayLog` | Gateway analytics | requestId, selectedModelId, latencyMs, cached, depth |
| `UserSubscription` | Quota management | tier, generationsUsed, generationsQuota |
| `NotificationSubscription` | Push subscriptions | endpoint, keys, userId, failureCount |
| `ScheduledNotification` | Due reminders | scheduledFor, sent, type, metadata |
| `UserNotificationPreferences` | Notification config | timezone, quietHours, activeHours, snoozedUntil |

### Constraints & Indexes

```prisma
// Unique constraints
@@unique([userId, cardId])            // CardReview - one per user+card
@@unique([endpoint])                  // NotificationSubscription
@@unique([userId, name])              // UserTag - unique name per user
@@unique([userId, order])             // Workspace - unique order per user
@@unique([provider, model])           // LlmPrice

// Performance indexes
@@index([userId, nextReviewAt])       // Due card queries
@@index([workspaceId])                   // Note ordering queries
@@index([userId, order])              // Board items, columns, tags
@@index([columnId, order])            // Board items within column
@@index([materialId])                 // Flashcards/questions by material
@@index([scheduledFor, sent])         // Notification dispatch
@@index([userId, type, cardId, sent]) // Notification dedup
```

---

## Core Modules

### Modular Monolith Boundary

Cognilo remains one Nuxt/Nitro deployment, but backend business logic is now moving behind internal feature modules under `server/modules`.

```
server/modules/
├── shared-kernel/        # events and cross-feature primitives
├── review/               # SM-2, enrollment, grading, review ports
├── language-learning/    # language word enrollment/review adapters
├── notifications/        # scheduling and delivery ports/adapters
├── notes/                # workspace note sync use cases
├── board/                # board item sync use cases
├── subscription/         # quota and credit ports/adapters
└── ai-generation/        # generation lifecycle events/use cases
```

**Dependency rules**:
- `server/api/*` routes are adapters: validate/authenticate, call an application service, return a response.
- Domain code must not import Prisma, H3/Nitro, Nuxt, `$fetch`, or UI code.
- Cross-feature behavior goes through ports or domain events, not direct repository calls.
- Public API URLs stay stable while internal use cases move module-by-module.

**Fitness check**:
- Run `yarn arch:check` before merging module changes.
- Run `yarn test:unit` for fast module-level regression coverage of the current proof slice.
- The check scans `server/modules/**` and fails on frontend imports, API route imports, domain-to-infrastructure/application imports, and direct cross-module imports into another module's application or infrastructure layer.
- The unit runner uses the existing `tsx` dependency and currently covers SM-2, shared review grading, workspace note sync temp ID mapping/deletes, board item sync temp ID mapping/conflicts, generation quota credit-spend behavior, ad-reward idempotency, Stripe purchase idempotency, and generated artifact persistence.

**Current proof slice**:
- Review grading and language grading share `gradeReviewCard`.
- Review enrollment uses `enrollReviewableResource` plus `ReviewableResourceResolver`.
- Language word enrollment uses `enrollLanguageWord`.
- XP and notification side effects are behind ports.
- Notes and board sync routes delegate conflict detection, temp ID mapping, and apply results to module use cases.
- Subscription routes now delegate quota checks, credit balance/spend, Stripe checkout intent creation, ad rewards, and Stripe purchase grants to module application services while preserving existing endpoint contracts.
- AI generation gateway request preparation and completion now live in `prepareGatewayGeneration` and `completeGatewayGeneration`.
- Semantic cache reads/writes for the gateway now go through `GenerationCachePort`, keeping Redis-backed caching behind a module adapter.
- Notes and board frontend features now surface local sync state explicitly through feature-owned status bars plus per-item dirty/error indicators.
- Notes layout is separate from note content: grouped drawer drag emits layout commands, `notesLayoutController` queues latest workspace layout, and row-level `Local` is reserved for content edits only.

**Notes + Board sync QA checklist**:
- Edit a note offline, refresh, and confirm it rehydrates with a `Local` indicator until sync completes.
- Move a board item offline, refresh, and confirm the pending column/order still render before reconnecting.
- Reconnect and confirm both features clear pending indicators after sync.
- Force a failed sync and confirm retry affordances remain visible without discarding local edits.

### 1. Notes Module

**Purpose**: Rich-text notes with local-first architecture using Tiptap editor.

**Architecture**:
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  NotesSection   │────>│  useNotesStore  │────>│    IndexedDB    │
│ + NotesDrawer   │     │ + layout ctrl   │     │ notes + queues  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │ content + layout sync │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Grouped drawer  │     │ /api/notes/*    │────>│    MongoDB      │
│ Move/reorder    │     │ /api/note-groups│     │  notes/groups   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Key Features**:
- Optimistic updates (instant UI feedback)
- Debounced content sync
- Layout command controller for note move/reorder and workspace layout queueing
- Conflict detection via `updatedAt` timestamps
- Background sync via service worker `notes-sync` tag
- First-class note groups: one group per note, virtual `Ungrouped` section for `groupId: null`
- Group CRUD is online-first in v1; moving notes among existing groups is local-first through layout sync
- Sync order is draft flush, content queue drain, temp ID remap, layout queue drain, then server refresh
- Rich text editing with Tiptap + sanitization
- Note types: `TEXT` (default), customizable via `noteType` field
- Metadata support (JSON) for extensible note data

**API Endpoints**:
- `GET /api/notes?workspaceId=` — List notes
- `POST /api/notes` — Create note
- `PATCH /api/notes/[id]` — Update note
- `DELETE /api/notes` — Delete note(s)
- `POST /api/notes/sync` — Bulk sync from client
- `PATCH /api/notes/reorder` — Update order positions and optional `groupId`
- `GET /api/note-groups?workspaceId=` — List note groups
- `POST /api/note-groups` — Create note group
- `PATCH /api/note-groups/[id]` — Rename note group
- `DELETE /api/note-groups/[id]` — Delete note group and move notes to `Ungrouped`
- `PATCH /api/note-groups/reorder` — Reorder groups

### 2. Spaced Repetition Module

**Purpose**: SM-2 algorithm for optimal learning intervals. Supports flashcards, materials, and questions as reviewable items.

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
```

**SM-2 Algorithm**:
```typescript
// Grade: 0-5 (0-2 = fail, 3-5 = pass)
// Ease Factor: minimum 1.3 (difficulty modifier)
// Interval: Days until next review (capped at maxIntervalDays = 180)
// Source of truth: server/modules/review/domain/sm2.ts (calculateSM2)

if (grade >= 3) {
  if (repetitions === 0) interval = 1
  else if (repetitions === 1) interval = 6
  else interval = Math.round(prevInterval * easeFactor)
  repetitions++
} else {
  repetitions = 0
  interval = 1
}

// Ease factor is updated on EVERY review (full SuperMemo SM-2 formula),
// not just on passes:
easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
if (easeFactor < 1.3) easeFactor = 1.3
if (interval > 180) interval = 180
```

**API Endpoints**:
- `POST /api/review/enroll` — Enroll card in review (idempotent via upsert)
- `POST /api/review/grade` — Submit grade (transactional + idempotent via GradeRequest)
- `GET /api/review/queue?workspaceId=` — Get due cards
- `GET /api/review/analytics` — Learning statistics
- `GET /api/review/enrollment-status` — Bulk enrollment check
- `GET /api/review/stats` — Review statistics

### 3. LLM Module

**Purpose**: AI-powered content generation (flashcards, questions) with smart model routing.

**Strategy Pattern**:
```
┌──────────────────────┐
│ getLLMStrategyFrom    │──────────────────────────────────────────┐
│   Registry()         │                                          │
└──────────────────────┘                                          │
         │              │              │              │            │
         ▼              ▼              ▼              ▼            │
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐   │
│OpenAIStrategy │ │GeminiStrategy│ │DeepSeekStrat.│ │GroqStrat│   │
│  (OpenAI)    │ │  (Google)    │ │  (DeepSeek)  │ │ (Groq)  │   │
└──────────────┘ └──────────────┘ └──────────────┘ └─────────┘   │
```

**Strategy Interface**:
```typescript
interface LLMStrategy {
  generateFlashcards(input: string, options?: LLMGenerationOptions): Promise<FlashcardDTO[]>
  generateQuiz(input: string, options?: LLMGenerationOptions): Promise<QuizQuestionDTO[]>
}
```

**Gateway Flow**:
```
Request → Auth → Quota Check → Rate Limit → Validate → Cache Lookup
    → Model Selection (scoring) → Strategy → Generate → Save → Log
```

### 4. Materials Module

**Purpose**: Upload and manage learning materials for AI generation.

**Features**:
- PDF upload with text extraction (pdf-parse, mammoth for DOCX)
- URL content fetching
- Direct text input
- Material-to-flashcard/quiz generation via gateway
- Workspace organization

**API Endpoints**:
- `GET /api/materials?workspaceId=` — List materials
- `POST /api/materials` — Create material
- `POST /api/materials/upload` — Upload file (PDF, DOCX)
- `GET /api/materials/[id]` — Get single material
- `PATCH /api/materials/[id]` — Update material
- `DELETE /api/materials` — Delete material(s)

### 5. Workspaces Module

**Purpose**: Flat content organization with ordering.

> **Note**: Workspaces are flat (no hierarchy/nesting). Each workspace has an `order` field for positioning, with a `@@unique([userId, order])` constraint.

**API Endpoints**:
- `GET /api/workspaces` — List user's workspaces
- `POST /api/workspaces` — Create workspace
- `GET /api/workspaces/[id]` — Get workspace with contents
- `PATCH /api/workspaces/[id]` — Update workspace
- `DELETE /api/workspaces/[id]` — Delete workspace (cascade)
- `GET /api/workspaces/count` — Get workspace count

### 6. Kanban Board Module

**Purpose**: Drag-and-drop task organization with columns and items.

**Data Model**:
- `BoardColumn` — Named columns owned by user, with `order` field
- `BoardItem` — Content items with `tags` and `order`, optionally assigned to a column

**API Endpoints**:
- `GET/POST /api/board-columns` — List/create columns
- `PATCH/DELETE /api/board-columns/[id]` — Update/delete column
- `PATCH /api/board-columns/reorder` — Reorder columns
- `GET/POST /api/board-items` — List/create items
- `PATCH/DELETE /api/board-items/[id]` — Update/delete item
- `PATCH /api/board-items/reorder` — Reorder items

### 7. On-Device AI Module

**Purpose**: Client-side AI features via web workers using @huggingface/transformers.

**Composables**:
- `useAIStore` — AI worker lifecycle management
- `useLocalMathRecognition` — Local math OCR model
- `useMathRecognition` — Math recognition orchestrator (local + MyScript fallback)
- `useSpeachToText` — Speech-to-text transcription
- `useTextSummarization` — Text summarization
- `useTextToSpeechWorker` — Text-to-speech synthesis

**Server proxy**: `POST /api/ai/myscript` — MyScript Cloud API with HMAC-SHA512 signing

---

## Service Architecture

### Frontend Services

**ServiceFactory** (`app/services/ServiceFactory.ts`) — 10 service bindings:

| Service Key | Class | Purpose |
|-------------|-------|---------|
| `workspaces` | `WorkspacesModule` | Workspace CRUD |
| `materials` | `MaterialService` | Materials CRUD |
| `notes` | `NoteService` | Notes CRUD |
| `boardItems` | `BoardItemService` | Board items CRUD |
| `boardColumns` | `BoardColumnService` | Board columns CRUD |
| `review` | `ReviewService` | Spaced repetition |
| `auth` | `AuthModule` | Authentication |
| `user` | `UserService` | User management |
| `userTags` | `UserTagService` | Tag management |
| `gateway` | `GatewayService` | LLM generation |

**FetchFactory** (`app/services/FetchFactory.ts`):
- Result pattern — never throws
- Retry with exponential backoff for transient errors
- Request timeout
- Error hooks

### Backend Services

| Service | Purpose |
|---------|---------|
| `NotificationScheduler` | Schedules review reminders based on `nextReviewAt`, de-duplicates per card, sends via web-push |
| `CronManager` | Manages scheduled cron jobs for notification dispatch |

---

## Authentication & Authorization

### Auth Stack
```
@sidebase/nuxt-auth (Nuxt module)
        ↓
NextAuth.js (Core)
        ↓
├── Credentials Provider (bcrypt)
├── Google OAuth (planned)
└── Passkey / WebAuthn (SimpleWebAuthn)
        ↓
Prisma Adapter → MongoDB
```

### Session Flow
1. User submits credentials or authenticates via passkey
2. NextAuth validates (bcrypt for passwords, WebAuthn for passkeys)
3. JWT session created
4. Session stored in cookie (httpOnly)
5. Server validates JWT on each request
6. User data attached to `event.context`

### Authorization Patterns
```typescript
// Server-side: require authenticated user with role
const user = await requireRole(event, ["USER"])

// Resource ownership check
const workspace = await prisma.workspace.findFirst({
  where: { id: workspaceId, userId: user.id }
})
if (!workspace) throw createError({ statusCode: 403 })
```

---

## PWA & Offline Support

### Service Worker Architecture

**Build Pipeline**:
```
sw-src/index.ts  → esbuild → public/sw.js     (service worker)
sw-src/ai-worker.ts → esbuild → public/ai-worker.js (AI web worker)
```

**Caching Strategies**:
| Route Pattern | Strategy | Rationale |
|---------------|----------|-----------|
| `/api/` | NetworkFirst | Fresh data preferred |
| Static assets | CacheFirst | Immutable files |
| Pages | StaleWhileRevalidate | Balance freshness/speed |

**IndexedDB Stores** (`DB_CONFIG`, `app/utils/constants/pwa.ts`, currently `VERSION: 18`):
- `forms` — Offline form submissions
- `notes` — Local notes cache
- `noteGroups` — Local note-group cache
- `pendingNotes` — Unsaved note changes queue
- `pendingNoteGroupChanges` — Queued note-group mutations
- `pendingNoteLayouts` — Queued layout changes
- `noteSyncConflicts` — Durable local/server conflict snapshots
- `offlineEntities` / `offlineMutations` / `offlineConflicts` — account-scoped Offline V2 projection, outbox, and conflicts (the active Board durable path)
- `boardItems` / `pendingBoardItems` / `boardColumns` — legacy Board migration inputs only; Phase 2 clears them after moving recoverable data into V2
- `userTags` — Tag cache

**Background Sync Tags**:
- `form-sync` — Queued form submissions
- `notes-sync` — Notes synchronization

### Offline Flow
1. User edits note offline
2. Note saved to IndexedDB + pendingNotes
3. Service worker registers `notes-sync` tag
4. Network restored → sync event fires
5. `POST /api/notes/sync` with pending notes
6. Server responds with canonical state
7. IndexedDB updated, pending cleared

---

## LLM Integration

### Smart Routing (Gateway)

`POST /api/llm.gateway` is the primary LLM endpoint:

1. **Auth** → `requireRole(event, ["USER"])`
2. **Quota** → Check `UserSubscription` (FREE: 10 generations, PRO: unlimited)
3. **Rate limit** → 5 req/min per user, 20 req/min per IP
4. **Validate** → Zod schema (`GatewayGenerateRequest`)
5. **Adaptive count** → Calculate item count based on input length + depth
6. **Cache lookup** → Semantic cache (Redis / in-memory, 7-day TTL)
7. **Model selection** → Score all enabled models by cost + latency + health + capability
8. **Strategy** → Instantiate via `getLLMStrategyFromRegistry(modelId)`
9. **Generate** → Call `strategy.generateFlashcards()` or `strategy.generateQuiz()`
10. **Save** → Transaction: optionally replace old items + cascade delete CardReviews
11. **Quota increment** → Increment `generationsUsed` for FREE tier
12. **Cache set** → Store result for future identical prompts
13. **Log** → `LlmGatewayLog` with full metrics

### Model Selection Scoring

```
score = baseCost (input + output USD)
  + latencyPenalty (over budget)
  + priorityPenalty (higher = worse)
  + healthPenalty (degraded = worse)
  + capabilityBonus (match = better)
```

### Usage Tracking

Two tracking systems:
- **`LlmUsage`** — Legacy per-call cost tracking with micro-dollar precision
- **`LlmGatewayLog`** — Gateway analytics with model selection, latency, caching info

---

## Contracts & Validation

All API contracts defined in `shared/utils/` using Zod 4:

| Contract | Purpose |
|----------|---------|
| `auth.contract.ts` | Authentication requests |
| `boardColumn.contract.ts` | Board column CRUD |
| `boardItem.contract.ts` | Board item CRUD |
| `flashcard.contract.ts` | Flashcard data |
| `workspace.contract.ts` | Workspace CRUD |
| `llm-generate.contract.ts` | LLM generation requests |
| `material.contract.ts` | Material data |
| `note.contract.ts` | Note CRUD |
| `note-sync.contract.ts` | Note sync payloads |
| `notification.contract.ts` | Notification data |
| `review.contract.ts` | Spaced repetition |
| `user.contract.ts` | User data |
| `user-tag.contract.ts` | User tag CRUD |

---

## Design Patterns Summary

| Pattern | Usage | Location |
|---------|-------|----------|
| Strategy | LLM providers | `server/utils/llm/` |
| Repository | Data access | `app/domain/repositories/` |
| Factory | Service creation | `app/services/ServiceFactory.ts` |
| Factory | LLM strategy creation | `server/utils/llm/LLMFactory.ts` |
| Result | Error handling | `FetchFactory.call()` |
| Domain-Driven | SR business logic | `app/domain/sr/` |
| Local-First | Notes persistence | `useNotesStore` + IndexedDB |
| Optimistic Updates | UI responsiveness | All composables |

---

## Related Documentation

- **[FEATURES.md](./FEATURES.md)** — Detailed feature documentation
- **[LLM_GENERATION_FLOW.md](./LLM_GENERATION_FLOW.md)** — End-to-end LLM generation trace
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Setup, commands, debugging
- **[MAINTENANCE.md](./MAINTENANCE.md)** — Operations, known issues, roadmap
