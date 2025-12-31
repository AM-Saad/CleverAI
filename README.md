# Cognilo

Cognilo is a Nuxt 3 + TypeScript application providing AI-powered study tools like flashcards and quizzes, with support for multiple LLM backends. It includes a modular architecture, centralized rate limiting, and a service layer for maintainability.

---

## 📱 Progressive Web App (PWA)

Cognilo is a fully functional Progressive Web App with robust offline capabilities. Users can:
- Install the app on any device
- Access content completely offline
- Navigate between pages without internet connection
- Experience fast, native-app-like performance

**📖 For detailed PWA implementation, caching strategy, and best practices, see [docs/PWA.md](./docs/PWA.md)**

### Offline Persistence & Reliability (Recent Improvements)
- **Unified IndexedDB (v4)**: Single schema ensures `forms` (background sync queue) and `notes` (offline edits) stores + indexes created atomically.
- **Bounded Retry Backoff**: Transient `InvalidStateError` / `TransactionInactiveError` during rapid reloads auto-retry with tiny exponential backoff (configurable in `IDB_RETRY_CONFIG`).
- **Immediate Note Persistence**: Edits are saved locally first for resilient offline UX while server sync debounces.
- **Tunable Constants**: Adjust retry parameters in `app/utils/constants/pwa.ts` without touching helper logic.

---

## Features

- **Folder-based Content** – Create study folders with metadata (e.g., chosen LLM model).
- **Flashcards & Quizzes** – Generate from pasted or uploaded content.
- **Spaced Repetition System** – SM-2 algorithm for optimal memory retention.
- **Push Notifications** – Intelligent card due reminders with user preferences.
- **Progressive Web App** – Full offline functionality and installable experience.
- **Offline-First Notes** – Local persistence with unified IndexedDB + conflict-friendly timestamps.
- **Multiple LLM Backends** – Strategy Pattern for GPT-3.5, GPT-4o, Claude, etc.
- **Clean Architecture** – Service layer, composables, and shared contracts for type safety.
- **Rate Limiting** – Centralized Redis-backed limiter with in-memory fallback.
- **Nuxt 3 + TypeScript** – Strong typing, runtimeConfig, and modular API routes.

---

## 📚 Documentation

Cognilo features comprehensive documentation organized by domain:

### 🎯 **Core Documentation**
- **[📖 Main README](./README.md)** - This file, project overview and setup
- **[🏗️ Architecture](./ARCHITECTURE.md)** - System architecture and design decisions
- **[🎨 Style Guide](./STYLEGUIDE.md)** - UI/UX guidelines and theming

### 🚀 **Feature Documentation**
- **[📱 PWA System](./docs/PWA.md)** - Progressive Web App implementation, service worker, caching
- **[📚 Spaced Repetition](./docs/SPACED_REPETITION.md)** - SM-2 algorithm, debug controls, analytics
- **[🔔 Notifications](./docs/NOTIFICATIONS.md)** - Push notifications, user preferences, MongoDB integration
- **[⏰ Cron & Timing](./docs/CRON_TIMING.md)** - Timezone-aware cron system, scheduling, testing

### 🛠️ **Development**
- **[🔧 Development Guide](./docs/DEVELOPMENT.md)** - Testing strategies, debug tools, workflows

### 📂 **Archive**
- **[📦 Documentation Archive](./docs-archive/README.md)** - Historical documentation (consolidated)

---

## Architecture Overview

### Frontend
- **Nuxt Pages & Components**:
  - `Flashcards.vue` / `Questions.vue` handle display and user actions.
  - `FolderCard.vue` for folder list/grid.
- **Composables**:
  - `useFolders`, `useGenerateQuiz`, etc. encapsulate API calls and state.
- **Shared Contracts**:
  - `~/shared/*.contract.ts` contains `zod` schemas and TypeScript types for validation.

### Backend
- **API Routes** (`/server/api/*`):
  - `folders` CRUD endpoints.
  - `llm.generate.post.ts` calls the right LLM strategy.
- **Services** (`/server/services/*`):
  - LLM Strategy implementations (OpenAI, Anthropic, etc.).
- **Utils**:
  - `~/server/utils/llm/rateLimit.ts` centralizes rate limit logic.

---

## Rate Limiting

The `/api/llm.generate` endpoint is protected by a **minimal rate limiter** to control API costs.

- **User Limit**: 5 requests per minute (based on `user.id`).
- **IP Limit**: 20 requests per minute (based on client IP).
- **Storage**:
  - **Primary**: Redis (via Upstash or other provider).
  - **Fallback**: In-memory `Map` (per server instance).

**Response Headers**:
- `X-RateLimit-Remaining` – Minimum remaining between user/IP limits.
- `X-RateLimit-Remaining-User` – Remaining for the current user.
- `X-RateLimit-Remaining-IP` – Remaining for the current IP.
- `X-RateLimit-Reset` – Seconds until the limit resets.
- `Retry-After` – Present only when limit exceeded, matches reset time.

> Limiter keys can optionally include `{ model }` to enforce stricter limits for expensive models.

---

## Development Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Set environment variables** in `.env`:
   ```env
   # Database
   DATABASE_URL=mongodb://username:password@host:port/dbname

   # Redis for rate limiting
   REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT

   # LLM API Keys
   OPENAI_API_KEY=your_openai_key
   GEMINI_API_KEY=your_gemini_key
   ```
3. **Run the dev server**:
   ```bash
   pnpm dev
   ```
4. **Initialize database**:
   ```bash
   pnpm prisma db push
   pnpm prisma db seed
   ```
5. **Build for production**:
   ```bash
   pnpm build
   pnpm start
   ```

> Note: MongoDB schema uses `@map("_id")` for IDs and replaces `Decimal` with `BigInt`. Use `pnpm prisma db push` instead of migrations (`migrate`) as Mongo ignores migrations. The LLM pricing data needs to be seeded to track usage costs.

---

## Redis Configuration (Upstash Example)

1. Sign up at [Upstash](https://upstash.com/), create a Redis database.
2. Copy the **Redis connection URL** (format: `rediss://default:password@host:port`).
3. Add it to `.env` as `REDIS_URL`.
4. Deploy environment variable to your hosting platform (e.g., Vercel).

---

## Patterns Used

- **Strategy Pattern** – Select LLM backend dynamically.
- **Zod Validation** – Schema validation for API payloads.
- **Centralized Rate Limiting** – Single Redis client via Nuxt plugin, utils for reuse.
- **Clean Imports** – `~/` aliases for shared and server-only modules.

---

## Composable Architecture

Cognilo uses Vue 3 composables as reactive interfaces to services, creating a clean separation between UI components and business logic:

### Core Composable Patterns

1. **Resource Access Composables**:
   ```ts
   // e.g., useFolders()
   const { folders, loading, error, refresh } = useFolders()
   ```

2. **Single Resource Composables**:
   ```ts
   // e.g., useFolder(id)
   const { folder, loading, error } = useFolder(folderId)
   ```

3. **Action Composables**:
   ```ts
   // e.g., useCreateFolder()
   const { createFolder, creating, error } = useCreateFolder()
   ```

4. **LLM Generation Composables**:
   ```ts
   // e.g., useGenerateFlashcards()
   const { flashcards, generating, genError, generate, rateLimitRemaining } =
     useGenerateFlashcards(modelRef, textRef, folderIdRef)
   ```

Each composable:
- Returns reactive state (data, loading, error)
- Handles API communication via services
- Manages loading states and error handling
- Provides functions to trigger actions

---

## Service Layer Architecture

Cognilo implements a robust service layer that mediates between UI composables and backend APIs:

### Frontend Service Structure

1. **ServiceFactory**: Creates service instances with dependency injection
   ```ts
   // Create folder service
   const folderService = serviceFactory.create('folders')
   ```

2. **FetchFactory**: Base class for API services with standardized error handling
   ```ts
   // All services extend this with specialized methods
   class FolderService extends FetchFactory { /*...*/ }
   ```

3. **ErrorFactory**: Standardized error creation for consistent handling
   ```ts
   throw ErrorFactory.create(ErrorType.NotFound, 'Folder')
   ```

### Backend Service Architecture

1. **LLM Strategy Pattern**:
   - **Interface**: `LLMStrategy` defines consistent methods across providers
   - **Implementations**:
     - `GPT35Strategy` - Fully implemented for OpenAI GPT-3.5
     - `GeminiStrategy` - Fully implemented for Google Gemini 1.5
     - (Planned: GPT-4o, Claude, Mixtral)
   - **Factory**: `getLLMStrategy()` creates appropriate strategy based on model

2. **Prompts**: Centralized in `prompts.ts` for consistency and reuse
   ```ts
   export const flashcardPrompt = (text: string) => `...`
   ```

---

## Type Safety & Validation

Cognilo implements end-to-end type safety with multiple validation layers:

1. **Shared Contracts**:
   - Located in `~/shared/*.contract.ts`
   - Define Zod schemas used on both frontend and backend
   - Ensure consistent data structure across the entire app

2. **Type Flow**:
   ```
   Prisma Schema → Database
       ↕
   Zod Schemas ↔ API Validation
       ↕
   TypeScript Interfaces ↔ Frontend Components
   ```

3. **Validation Points**:
   - **API Input**: Request body validation with Zod
   - **API Output**: Response validation in services
   - **LLM Output**: Structured validation of AI-generated content

This multi-layered approach ensures data integrity throughout the application lifecycle.

---

## Architecture & Implementation Details

This section documents **every moving part** you need to understand, extend, and operate Cognilo in production: strategies, factory, endpoints, rate limiting, **usage logging**, and **exact pricing math**.

---

### 1) LLM Backends & Strategy Pattern
We use a clean Strategy interface so each provider (OpenAI, Gemini, etc.) plugs in without leaking SDK details.

**Contract** (simplified):
```ts
export interface LLMStrategy {
  generateFlashcards(input: string): Promise<FlashcardDTO[]>
  generateQuiz(input: string): Promise<QuizQuestionDTO[]>
}
```

**Implemented Strategies:**
- **OpenAI GPT‑3.5** (`server/utils/llm/GPT35Strategy.ts`)
  - Uses Chat Completions API.
  - Extracts **API-reported tokens** from `res.usage.prompt_tokens` & `completion_tokens`.
  - Computes **character counts** and **pre/post token estimates** using `tiktoken` for visibility.
- **Gemini 1.5 (Flash/Pro)** (`server/utils/llm/GeminiStrategy.ts`)
  - Uses `@google/generative-ai` `generateContent`.
  - Reads **usageMetadata** from `resp.response.usageMetadata` or from `resp.response.candidates?.[0]?.usageMetadata` depending on whether `generateContent` or `streamGenerateContent` was called; this can differ by API method.
  - Computes **character counts** and **pre/post token estimates** via `countTokens()`.

> Both strategies support an optional `onMeasure(LlmMeasured)` callback fired **after** we have output text, so we can log accurate usage + calculated cost.

> Meta logging happens inside each Strategy’s `onMeasure` callback right before calling `logLlmUsage()`, ensuring consistent diagnostics capture.

`LlmMeasured` shape (shared):
```ts
export type LlmMeasured = {
  provider: 'openai' | 'google'
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestId?: string
  rawUsage?: unknown
  meta?: {         // extra diagnostics persisted in DB
    inputChars?: number
    outputChars?: number
    inputTokensEstimate?: number
    outputTokensEstimate?: number
    [k: string]: any
  }
}
```

---

### 2) Factory & Context Injection
`server/utils/llm/LLMFactory.ts` centralizes model selection **and** wires `onMeasure` → usage logging.

```ts
const strategy = getLLMStrategy(model, {
  userId,            // for per-user analytics
  folderId,          // feature scope (SmartStudy folder)
  feature: task,     // 'flashcards' | 'quiz' | 'chat'
})
```

The factory is the single integration point for token counting, pricing snapshot lookup (`LlmPrice`), and error-safe logging.

Internally the factory instantiates the chosen strategy and injects:
```ts
(m: LlmMeasured) => logLlmUsage(m, { userId, folderId, feature })
```
So **every call** is logged consistently without endpoint-specific code.

---

### 3) API Endpoints
- `POST /api/llm.generate` → routes to the proper strategy via factory.
  - Accepts `{ model, task, folderId, ... }`.
  - On success: returns generated DTOs.
  - On error: returns normalized 4xx/5xx and **also logs** a usage row with `status: 'error'` so failures are visible in analytics.

- `GET /api/llm-usage` → Admin analytics (see §7).
  - Query: `start`, `end`, `limit`.
  - Returns totals, monthly breakdown, top features, top users, and token/char ratios.

---

### 4) Rate Limiting (Cost Control)
Already implemented (see section above). Summary:
- User: `5 req/min` (by `user.id`)
- IP: `20 req/min` (by client IP)
- Storage: Redis primary, in-memory fallback
- Emits `X-RateLimit-*` headers and `Retry-After` on exceed.

> You can extend this with **per-model** thresholds (e.g., stricter for expensive models) by checking the `model` in the limiter key.

---

### 5) Usage Logging & Exact Pricing
All usage is persisted in MongoDB via Prisma with **exact integer money math** (micro‑dollars).

**Schema (core fields)**
```prisma
model LlmPrice {
  id                  String  @id @default(auto()) @map("_id") @db.ObjectId
  provider            String
  model               String
  inputPer1kMicros    BigInt  // USD * 1_000_000 per 1k input tokens
  outputPer1kMicros   BigInt  // USD * 1_000_000 per 1k output tokens
  isActive            Boolean @default(true)

  @@unique([provider, model], map: "provider_model")
}

model LlmUsage {
  id                          String   @id @default(auto()) @map("_id") @db.ObjectId
  provider                    String
  model                       String
  inputPer1kMicrosSnapshot    BigInt?
  outputPer1kMicrosSnapshot   BigInt?

  promptTokens                Int
  completionTokens            Int
  totalTokens                 Int

  inputUsdMicros              BigInt
  outputUsdMicros             BigInt
  totalUsdMicros              BigInt

  requestId                   String?
  status                      String   @default("success")
  errorCode                   String?
  errorMessage                String?

  userId                      String?
  folderId                    String?
  feature                     String?

  createdAt                   DateTime @default(now())
  rawUsageJson                Json?
  meta                        Json?

  @@index([provider, model, createdAt])
  @@index([userId, createdAt])
  @@index([folderId, createdAt])
}
```

**Cost math (micro‑dollars):**
```ts
inputCostMicros  = (promptTokens     * inputPer1kMicros)  / 1000n
outputCostMicros = (completionTokens * outputPer1kMicros) / 1000n
totalUsdMicros   = inputCostMicros + outputCostMicros
```

> Pricing snapshots are stored in `inputPer1kMicrosSnapshot` and `outputPer1kMicrosSnapshot` on each usage row so historical costs aren’t affected by future price changes.

**Where costs come from:**
- **OpenAI**: `res.usage.prompt_tokens`, `completion_tokens`
- **Gemini**: `resp.response.usageMetadata.promptTokenCount`, `candidatesTokenCount` (and `totalTokenCount`)

**Diagnostics captured in `meta`:**
- `inputChars`, `outputChars`
- `inputTokensEstimate`, `outputTokensEstimate` (pre/post via tokenizer)

> The `seed.ts` script uses a USD → micros conversion helper and inserts multiple rows per provider/model to populate pricing data.

---

### 6) Tokenizers & Estimates
- **OpenAI**: we use `tiktoken`’s `encoding_for_model()` to estimate tokens before/after sending, which helps predict cost and trim context.
- **Gemini**: we call `model.countTokens()` before and after.
- Billing still uses **API-reported** tokens (source of truth), but estimates are logged for analysis.

---

### 7) Admin Analytics Endpoint
`GET /api/llm-usage` aggregates:
- **Totals**: calls, tokens, USD, chars, tokens/1k chars
- **By Month**: USD/calls/tokens per month (UTC)
- **Top Features/Users**: most expensive slices

Parameters:
- `start`: ISO date (default: now − 30 days)
- `end`: ISO date (default: now)
- `limit`: result size for top lists (default: 10)

> Uses in-memory aggregation (not Mongo pipelines) and sorts top lists by descending cost for accurate ranking.

---

### 8) Error Logging & Resilience
- On strategy errors, the endpoint logs a usage row with `status: 'error'` and `errorCode`/`errorMessage` while keeping tokens at `0`. This makes failures visible in cost reports.
- Logging failures are swallowed so they never mask the original error response.

> If partial metadata or usage info is available before an error, `rawUsageJson` is still stored to aid debugging.

---

### 9) Budget Guardrails (Optional)
Add a pre-call check to cap spend:
1. Sum this month’s `totalUsdMicros` per `userId` (or globally).
2. If above your threshold, return a 402-style app error.
3. (Optional) Add per-feature or per-model budgets.

---

### 10) Extending to New Models
To add a new provider/model:
1. **Price**: upsert a row in `LlmPrice` with `inputPer1kMicros` & `outputPer1kMicros`.
2. **Strategy**: implement `LLMStrategy` with an `onMeasure` callback that fills `LlmMeasured`.
3. **Factory**: add a `case` to `getLLMStrategy` and wire `onMeasure` → `logLlmUsage`.
4. **Prompts**: define prompt builders in `server/utils/llm/prompts`.
5. (Optional) **Limits**: add per-model rate-limit keys.

---

### 11) Setup & Operations
- **Install deps**: `pnpm install` (make sure `tiktoken` and provider SDKs are installed)
- **Environment**:
  - `OPENAI_API_KEY`, `GEMINI_API_KEY`
  - `REDIS_URL` if using Redis rate limiting
  - Prisma MongoDB `DATABASE_URL`
- **Prisma (Mongo)**: `pnpm prisma db push` (Mongo ignores migrations; `db push` is correct)
- **Seed prices**: `pnpm prisma db seed`
- **Run**: `pnpm dev`

**Verifying logs**
- Call `/api/llm.generate` a few times
- Hit `/api/llm-usage?limit=5`
- Confirm `totals.usd` > 0 and lists are populated

---

### 12) Notes on Tokens vs Characters
- Tokens are the billing unit; characters are for rough size. English averages ~3–4 chars/token, but it varies.
- We store both for analysis. Reports expose `tokensPer1kChars` to watch prompt efficiency.

> `tokensPer1kChars` is used in analytics to catch anomalies like excessive token counts for short prompts, helping monitor prompt efficiency and detect issues.

---

## Future Improvements
- Per-model and per-feature **budget ceilings** with alerts.
- Export usage to **CSV** or a data warehouse for BI.
- Background jobs for chunked/long-running generation.
- Prompt library with **versioning** and A/B testing hooks.
- UI dashboard for `/api/llm-usage` (charts + filters).
