# Module System Diagrams

> Current architecture map for the Cognilo modular monolith.
> Last checked from code: May 2026.

This document maps the current system from code, not only from intended architecture.
It should be read together with `docs/ARCHITECTURE.md`, feature READMEs under
`app/features/*`, and `scripts/check-architecture-boundaries.cjs`.

## System Shape

Cognilo is currently a single Nuxt/Nitro deployable with feature-oriented
frontend modules and server-side modular-monolith slices.

```mermaid
flowchart TD
  UI["Nuxt pages, layouts, feature containers"] --> Services["$api ServiceFactory"]
  Services --> Routes["server/api route adapters"]
  Routes --> Auth["requireRole / session auth"]
  Routes --> Contracts["shared Zod contracts"]
  Routes --> Modules["server/modules application services"]
  Modules --> Prisma["Prisma + MongoDB"]
  UI --> IDB["IndexedDB local cache"]
  UI --> SW["Service worker fallback sync"]
```

### Layer Rules

- API routes parse, authorize, call use cases, and return `success(...)`.
- Server domain code must not import Prisma, H3, Nuxt, fetch, application, or infrastructure code.
- Server modules should not import another module's application or infrastructure directly.
- Cross-feature behavior should go through ports, shared contracts, or domain events.
- Frontend feature internals should import local feature code explicitly, not legacy wrappers.
- Legacy wrapper paths stay for Nuxt auto-import compatibility.

## Shared Kernel

The shared kernel is intentionally small today.

```mermaid
flowchart TD
  SharedContracts["shared/utils Zod contracts"] --> Frontend["frontend services and stores"]
  SharedContracts --> Routes["server/api validators"]
  ErrorUtils["server/utils/error"] --> Routes
  AuthUtils["server/utils/auth"] --> Routes
  EventBus["DomainEventBus in-memory"] --> Review["Review use cases"]
  EventBus --> Language["Language use cases"]
  EventBus --> AI["AI generation events"]
```

Current status:

- Shared contracts are the strongest shared-kernel mechanism.
- `DomainEventBus` is in-memory and useful for decoupling inside one running process.
- Events are not durable. They should not be treated as guaranteed background jobs.

## Notes Module

Notes is local-first and is the most interaction-heavy module.

```mermaid
flowchart TD
  Drawer["NotesDrawer / NoteRow zones"] --> Commands["useNotesStore commands"]
  Editor["Text, math, canvas editors"] --> Drafts["Draft flush + debounced commit"]
  Commands --> LocalRepo["NotesLocalRepository IndexedDB"]
  Commands --> ContentQueue["pendingNotes content queue"]
  Commands --> GroupQueue["pendingNoteGroupChanges"]
  Commands --> LayoutQueue["pendingNoteLayouts latest layout"]

  ContentQueue --> SyncEngine["syncPendingChanges"]
  GroupQueue --> SyncEngine
  LayoutQueue --> SyncEngine
  Drafts --> SyncEngine

  SyncEngine --> Api["POST /api/notes/sync"]
  Api --> SyncApp["syncWorkspaceNotes"]
  SyncApp --> LayoutApp["applyWorkspaceNoteLayout"]
  SyncApp --> Prisma["Note / NoteGroup"]
  SyncApp --> IdMaps["noteIdMap / groupIdMap"]
  IdMaps --> LocalRepo
```

Interaction flow:

```mermaid
flowchart LR
  Drag["Drag handle"] --> Layout["layout command only"]
  Title["Title/link zone"] --> Open["open/select note only"]
  Split["Split zone"] --> SplitState["local split UI state only"]
  Actions["Actions menu"] --> Action["delete/download/etc only"]
```

Sync flow:

```mermaid
flowchart TD
  Change["User changes note/group/layout"] --> Local["Write local cache first"]
  Local --> Queue["Queue content/group/layout change"]
  Queue --> UI["Optimistic UI remains visible"]
  Online{"Verified online?"}
  UI --> Online
  Online -- "No" --> Wait["Wait for reconnect/manual sync"]
  Online -- "Yes" --> Drain["Flush drafts, drain queues"]
  Drain --> Remap["Apply note/group ID maps"]
  Remap --> Refresh["Refresh or hydrate local state"]
```

Important invariants:

- Reorder and group moves are layout changes, not content changes.
- Layout changes must not mark every note row as dirty/local.
- Group create/rename/delete are queued as group changes.
- Notes created in a temporary group must wait for `groupIdMap` before note sync drains.
- Split state is local UI state and must not sync to the server.
- Service worker sync is fallback; open-app sync should be client-owned.

Current maturity: high value but still high complexity. This module needs the most regression tests.

## Board Module

Board items, columns, links, and comments share one Offline V2 local-first
pipeline. Reactive stores are projections; `offlineEntities` is the only
durable Board state and `offlineMutations` is the only outbox.

```mermaid
flowchart TD
  BoardUI["BoardNotesSection / kanban / list / detail panel"] --> ItemStore["useBoardItemsStore"]
  BoardUI --> ColumnStore["useBoardColumnsStore"]
  ItemStore --> Repo["Board Offline V2 repository ports"]
  ColumnStore --> Repo
  Repo --> Entities["offlineEntities"]
  Repo --> Outbox["offlineMutations"]
  Outbox --> Owner{"Visible page?"}
  Owner -->|"yes"| Browser["browser drainer"]
  Owner -->|"no"| Worker["service-worker drainer"]
  Browser --> Api["POST /api/offline/sync"]
  Worker --> Api
  Api --> Domain["Board transaction + revision + receipt"]
  Domain --> Ack["generic remap / acknowledgement"]
  Ack --> Entities
  Ack --> Outbox
  Ack --> ItemStore
  Ack --> ColumnStore
```

Important invariants:

- Temporary IDs are remapped atomically in generic entities, dependent payloads, and mutations.
- Server snapshots replace only clean rows; active mutations and `localDirty` drafts win.
- Server-newer conflicts retain local and server snapshots until explicit resolution.
- Columns, related item revision changes, links, and comments use the same receipt-aware pipeline.

Current maturity: high after Board Offline V2 Phase 2; authenticated multi-tab and no-window browser scenarios remain valuable operational coverage.

## Review Module

Review is the cleanest backend slice.

```mermaid
flowchart TD
  ReviewUI["Review frontend feature"] --> ReviewService["reviewService"]
  ReviewService --> EnrollRoute["/api/review/enroll"]
  ReviewService --> GradeRoute["/api/review/grade"]

  EnrollRoute --> Enroll["enrollReviewableResource"]
  GradeRoute --> Grade["gradeReviewCard"]

  Grade --> SM2["domain/sm2"]
  Grade --> Repo["ReviewRepository"]
  Grade --> XP["XpPort"]
  Grade --> Notify["NotificationPort"]
  Grade --> Events["ReviewCardGraded"]
  Enroll --> Resolver["ReviewableResourceResolver"]
  Enroll --> Events2["ReviewCardEnrolled"]

  Repo --> Prisma["CardReview"]
```

Important invariants:

- SM-2 calculation is pure domain logic.
- Grading is idempotent when `requestId` is provided.
- XP goes through `XpPort`.
- Review due notifications go through `NotificationPort`.
- Cross-resource enrollment goes through `ReviewableResourceResolver`.

Current maturity: high.

## Language Learning Module

Language learning owns capture, translation, stories, word bank, and language-specific review cards.

```mermaid
flowchart TD
  LangUI["Language feature containers/components"] --> LangRuntime["LanguageLearningRuntime"]
  LangRuntime --> LangService["languageService"]
  LangService --> Translate["/api/language/translate"]
  LangService --> SaveWord["/api/language/words"]
  LangService --> Story["/api/language/generate-story"]
  LangService --> Queue["/api/language/queue"]
  LangService --> GradeRoute["/api/language/grade"]
  LangService --> EnrollRoute["/api/language/words/:id/enroll"]

  Translate --> CaptureWord["captureLanguageWord"]
  SaveWord --> SaveWordUseCase["saveLanguageWord"]
  Story --> GenerateStory["generateLanguageStory"]
  Queue --> QueueUseCase["getLanguageReviewQueue"]
  GradeRoute --> SharedGrade["review.gradeReviewCard"]
  SharedGrade --> LangRepo["PrismaLanguageReviewRepository"]
  EnrollRoute --> EnrollWord["enrollLanguageWord"]
  GenerateStory --> EnrollWord
  CaptureWord --> Prisma["LanguageWord / LanguageTranslation"]
  SaveWordUseCase --> Prisma
  EnrollWord --> Prisma2["LanguageStory / LanguageCardReview"]
```

Important invariants:

- Language grading reuses the shared review engine.
- Language review persistence is isolated by `PrismaLanguageReviewRepository`.
- Language word enrollment emits `LanguageWordEnrolled`.
- Translation and story routes are thin adapters over language application services.
- Capture/story LLM responses are parsed and validated before quota finalization.
- AI translation/story generation is online-only. Preferences, word bank,
  enrollment, deletion, review, grading, and stats use account-scoped Offline
  V2 projections and typed mutations.
- User-facing Capture always saves the lexical entry. Translation fields are
  optional and default from `translateOnCapture`; definition-only and translated
  cache identities remain separate.
- `POST /api/language/words` remains the idempotent, non-generative persistence
  command for callers that already hold a `translationId`.
- Clicking a bank card opens word details. Story generation is a deliberate
  dialog action, and story text is constrained to the learned language.
- Frontend word-bank refresh goes through `LanguageLearningRuntime`, not global browser events.

Current maturity: high for review reuse and capture/save separation,
medium-high for offline Language integration. Authenticated browser coverage for
offline enrollment followed by dependent grading remains a release follow-up.

## Materials Module

Materials own uploaded/created learning source content and generation entrypoints.

```mermaid
flowchart TD
  MaterialsUI["Materials feature UI"] --> MaterialService["Material service"]
  MaterialsUI --> Generate["useGenerateFromMaterial"]
  MaterialService --> MaterialRoutes["/api/materials/*"]
  Generate --> Gateway["GatewayService"]
  Gateway --> LlmGateway["/api/llm.gateway"]

  MaterialRoutes --> PrismaMaterial["Material"]
  LlmGateway --> AiGeneration["ai-generation module"]
  AiGeneration --> Generated["Flashcard / Question"]
```

Important invariants:

- Materials are workspace-owned.
- Generation from a material goes through the LLM gateway.
- Regeneration is user-confirmed and can replace or append.

Current maturity: medium. Frontend feature slice exists; server material routes are not fully extracted into a `materials` module yet.

## AI Generation Module

AI generation coordinates request preparation, model routing, semantic cache, provider execution, quota, and saving artifacts.

```mermaid
flowchart TD
  GatewayRoute["/api/llm.gateway"] --> Run["runGatewayGeneration"]
  Run --> Prepare["prepareGatewayGeneration"]
  Run --> Pipeline["llmRequestPipeline"]
  Pipeline --> RateLimit["rate limit"]
  Pipeline --> Quota["QuotaPort"]
  Pipeline --> Router["model routing"]
  Router --> Strategy["LLM provider strategy"]
  Run --> Cache["GenerationCachePort"]
  Strategy --> Complete["completeGatewayGeneration"]
  Cache --> Complete
  Complete --> Save["saveGeneratedArtifacts"]
  Save --> Prisma["Flashcard / Question / LlmGatewayLog"]
  Quota --> Subscription["subscription module"]
```

Important invariants:

- Public route remains `/api/llm.gateway`.
- Quota is checked/consumed through `QuotaPort`.
- Provider calls are isolated behind LLM strategies.
- Generated artifacts are saved inside the ai-generation application flow.
- The route is thin, but the application still accepts `H3Event` because the pipeline still depends on HTTP request context.

Current maturity: medium-high. The boundary is much better, but HTTP context should eventually be pushed out of application code.

## Subscription Module

Subscription owns generation quotas, credits, ad rewards, Stripe checkout, and Stripe credit grants.

```mermaid
flowchart TD
  CreditRoutes["/api/credits/*"] --> Ledger["creditLedger"]
  CheckoutRoute["/api/credits/checkout"] --> Checkout["createStripeCreditCheckout"]
  Webhook["/api/webhooks/stripe"] --> Grant["grantStripePurchaseCredits"]
  StatusRoute["/api/subscription/status"] --> QuotaPort["PrismaQuotaPort"]
  AiGeneration["ai-generation"] --> QuotaPort
  QuotaPort --> Quota["generationQuota"]
  Ledger --> Prisma["UserSubscription / CreditTransaction"]
  Quota --> Prisma
  Grant --> Prisma
```

Important invariants:

- AI generation depends on `QuotaPort`, not direct subscription internals.
- Credit transactions should be idempotent by metadata/session/payment intent.
- Free quota and credit balance are server-authoritative.

Current maturity: high for quota/credits; subscription billing lifecycle can grow here.

## Notifications Module

Notifications owns push subscriptions, notification preferences, scheduled notifications, and delivery.

```mermaid
flowchart TD
  PrefUI["Notification preferences UI"] --> PrefApi["/api/notifications/preferences"]
  PushUI["useNotifications"] --> SubscribeApi["subscribe/unsubscribe"]
  Review["Review grading"] --> Port["NotificationPort"]
  Port --> Scheduler["NotificationScheduler"]
  Cron["notification cron routes"] --> Scheduler
  Scheduler --> Prisma["NotificationSubscription / ScheduledNotification / Preferences"]
  Scheduler --> WebPush["web-push delivery"]
```

Important invariants:

- Review scheduling uses `NotificationPort`.
- Preferences, subscriptions, scheduled records, cron orchestration, and delivery are separate concerns conceptually.
- Several API routes still include direct behavior and should gradually move into application services.

Current maturity: medium. The port exists, but the module is not fully extracted.

## Auth, User, Workspace, Tags

These are foundational app capabilities but are not yet represented as full `server/modules/*` feature modules.

```mermaid
flowchart TD
  AuthUI["auth composables/pages"] --> AuthApi["/api/auth/*"]
  WorkspaceUI["workspace UI"] --> WorkspaceApi["/api/workspaces/*"]
  TagsUI["tag store"] --> TagsApi["/api/user/tags/*"]
  UserUI["profile/settings"] --> UserApi["/api/user/*"]

  AuthApi --> PrismaUser["User"]
  WorkspaceApi --> PrismaWorkspace["Workspace"]
  TagsApi --> PrismaTags["UserTag"]
  UserApi --> PrismaUser
```

Current maturity: legacy-route style. These areas work as platform services, but they are not modularized to the same level as Review, Notes, or Subscription.

## Offline Runtime

The offline runtime supports notes, board items, forms, cached app assets, push, and background sync.

```mermaid
flowchart TD
  UserChange["User mutation"] --> LocalWrite["Write IndexedDB/local state"]
  LocalWrite --> Queue["Queue pending record"]
  Queue --> Register["Register background sync tag"]
  OnlineEvent["window online"] --> Flush["Flush debounced drafts"]
  Flush --> DirectSync["Client-owned sync"]
  DirectSync --> ApiSync["Sync endpoint"]
  SW["Service worker"] --> Fallback["Fallback sync when page is not active"]
  ApiSync --> Result["applied / conflicts / id maps"]
  Result --> LocalMerge["Clear/remap queues and local cache"]
```

Important invariants:

- UI should never wait for server sync before reflecting a local change.
- Reconnect sync must flush drafts before reading queues.
- Open-app sync should avoid racing the service worker against the page.
- ID maps must be applied before layout changes referencing temp IDs are sent again.

## Cross-Module Collaboration

```mermaid
flowchart TD
  AI["ai-generation"] -->|QuotaPort| Subscription["subscription"]
  Review["review"] -->|NotificationPort| Notifications["notifications"]
  Review -->|XpPort| UserProgress["XP/progress persistence"]
  Language["language-learning"] -->|ReviewRepository adapter| Review
  Notes["notes"] -->|workspace ownership| Workspace["workspace"]
  Board["board"] -->|workspace ownership| Workspace
  Materials["materials"] -->|source content| AI
  AI -->|saves generated artifacts| Reviewables["flashcards/questions"]
  Review -->|resolver| Reviewables
  Modules["feature modules"] --> Contracts["shared contracts"]
```

## Current Health Summary

Strong areas:

- Review core has clean domain/application/ports separation.
- Language grading correctly reuses the review engine.
- Notes now has explicit content, group, and layout queues.
- AI generation is mostly behind `runGatewayGeneration`.
- Subscription exposes quota through a port.
- Architecture checks exist and enforce key server/frontend boundaries.

Still risky:

- Notes remains the highest-complexity module because editor state, split UI, DnD, IndexedDB, temp IDs, and sync all meet there.
- Board item sync is local-first, but board columns are not equally local-first.
- Notifications has a port but still has route-heavy behavior.
- Materials server logic is still route-oriented.
- Domain events are not durable.
- Some platform services remain legacy-route style.

## Recommended Fitness Checks

These should be kept as tests or architecture checks:

- Notes reorder/group move never sets note content dirty.
- Notes group temp IDs are remapped before note content/layout sync drains.
- Notes manual sync flushes drafts before reading pending queues.
- Service worker and page do not both POST the same notes queue while the app is open.
- Board temp IDs are replaced everywhere after sync.
- Review domain does not import Prisma, H3, Nuxt, or fetch.
- Server modules do not import other modules' application/infrastructure layers.
- Frontend feature internals do not import their own legacy wrappers.
