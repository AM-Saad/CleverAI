# CleverAI Architecture

> **This file has been consolidated. See the comprehensive documentation in `docs/`.**

---

## Documentation Structure

All technical documentation has been consolidated into 4 comprehensive documents:

| Document | Purpose |
|----------|---------|
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design, data model, module architecture |
| **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** | Setup, commands, debugging, contribution guide |
| **[docs/FEATURES.md](./docs/FEATURES.md)** | Detailed feature documentation (Notes, SR, LLM, PWA) |
| **[docs/MAINTENANCE.md](./docs/MAINTENANCE.md)** | Known issues, tech debt, security, roadmap |

---

## Quick Links

### For New Developers
1. Start with [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for setup
2. Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system overview
3. Consult [FEATURES.md](./docs/FEATURES.md) for specific features

### For Code Review
1. Check [MAINTENANCE.md](./docs/MAINTENANCE.md) for known issues
2. Review [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design patterns

### For Operations
1. See [MAINTENANCE.md](./docs/MAINTENANCE.md) for operations guide
2. Check [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for commands

---

## High-Level Overview

CleverAI is a **Nuxt 3** application providing AI-powered flashcard generation and spaced repetition learning.

### Tech Stack
- **Frontend**: Nuxt 3, Vue 3, TypeScript, TailwindCSS, Pinia
- **Backend**: Nitro, Prisma, MongoDB, Redis (optional)
- **AI**: OpenAI GPT-3.5, Google Gemini
- **PWA**: Workbox, IndexedDB, Web Push

### Key Architecture Patterns
- **Strategy Pattern**: Pluggable LLM providers
- **Local-First**: IndexedDB + background sync for notes
- **Domain-Driven Design**: SR business logic isolation
- **Result Pattern**: FetchFactory error handling

### Project Structure
```
app/           # Nuxt frontend (srcDir)
server/        # Nitro API server
shared/        # Contracts (Zod schemas)
sw-src/        # Service worker source
docs/          # Consolidated documentation
```

For detailed information, see the documentation files linked above.

---

## 6) Service Layer (Frontend)

- **FetchFactory** – Creates typed clients with:
  - `baseURL`, `headers`, auth if present.
  - Standardized error mapping (HTTP → domain errors).
- **ServiceFactory** – Wraps endpoint groups (folders, flashcards, quizzes, generation).
- **ErrorFactory** – Converts low-level errors into user-friendly messages with codes.

**Composables**
- `useFolders()` – CRUD + attach model metadata.
- `useFlashcards(folderId)` – List/create from content.
- `useQuizzes(folderId)` – List/create from content.
- `useLLMGenerate()` – One-shot generation action with status, error, retry.

Each composable maintains:
- `state`: loading, data, error.
- `actions`: call services, handle retries/backoff.
- `contracts`: consume Zod types for typed results.

---

## 7) API Endpoints (Nuxt Server Routes)

### `POST /api/llm.generate`
Input:
```ts
{
  folderId: string;
  content: string;           // raw text (files preprocessed client-side)
  target: "flashcards" | "quiz";
  model: string;             // e.g., "gpt-3.5-turbo", "gpt-4o-mini", "gemini-1.5"
}
```

Flow:
1. **Rate limit** (user+IP; headers returned).
2. **Validate** input with Zod.
3. **Resolve strategy** by model → provider.
4. **Build prompt** (versioned).
5. **Call provider** with safety/token limits.
6. **Parse output** into domain DTOs (cards or quiz).
7. **Persist** results under `folderId` (optional, or return only).
8. **Log usage** with pricing snapshot (costs in micro-USD).
9. Return typed response.

### `GET /api/llm-usage?window=7d`
- Returns aggregated usage and cost for dashboards.

**Headers returned on rate-limited endpoints**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on 429

---

## 8) LLM Strategy Pattern

**Why**: Avoid `if (provider === ...)` branches everywhere and make adding models a single-responsibility change.

**Interfaces**
```ts
interface LLMStrategy {
  name: string;
  supports: (model: string) => boolean;
  estimateTokens: (input: string) => Promise<{ prompt: number }>;
  generate: (args: GenerateArgs) => Promise<GenerateResult>;
  priceSnapshot: (model: string) => Price; // micro-USD per token
}
```

**Factory**
```ts
function selectStrategy(model: string): LLMStrategy {
  if (openAIStrategy.supports(model)) return openAIStrategy;
  if (geminiStrategy.supports(model)) return geminiStrategy;
  // future: claudeStrategy, mixtralStrategy
  throw new Error(`No strategy for model ${model}`);
}
```

**Extending**
1. Implement `LLMStrategy` for provider.
2. Register strategy in the factory.
3. Add provider/model pricing to seed script.
4. (Optional) add provider-specific tokenizer.

---

## 9) Prompts & Output Parsing

- Prompts are **versioned** (e.g., `flashcards@v1`, `quiz@v1`).
- Outputs must be **JSON-constrained** where possible to reduce parsing errors.
- Post-processors:
  - Trim hallucinated fields
  - Normalize tags/choices
  - Validate with Zod before persistence

---

## 10) Rate Limiting & Guardrails

- **Redis-first**, **in-memory fallback**.
- Default policy (tunable):
  - per-user: `5 req/min`
  - per-IP: `20 req/min`
- Expose headers for clients to implement retry UX.
- **Budget guardrails** (optional feature flag):
  - Block requests if monthly/project ceiling exceeded.
  - Return `429` with `Retry-After` + friendly message.

---

## 11) Cost & Usage Accounting

- Costs stored as **micro-USD** to avoid FP errors.
- **Pricing snapshot** chosen at request time (don’t rely on mutable live prices).
- Logged per call: `{ provider, model, inputTokens, outputTokens, inputCostMicroUsd, outputCostMicroUsd, timestamp }`.
- Aggregates power:
  - Per-user dashboards
  - Model comparison
  - Budget planning

---

## 12) Error Handling & Observability

- **ErrorFactory** maps provider/HTTP errors → domain errors with codes:
  - `RATE_LIMITED`, `BUDGET_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `INVALID_INPUT`, `PARSE_ERROR`, `UNAUTHORIZED`.
- **ErrorLog** captures stack + context (requestId, model, input size).
- Console logs in dev; pluggable reporter in prod (e.g., Sentry).

---

## 13) Frontend State & UX

- All composables expose: `isLoading`, `data`, `error`, `retry()`.
- Toasts for success/errors; inline messages for validation failures.
- Pending states avoid duplicate submissions; cancelation supported via `AbortController`.

---

## 14) Tokenization & Limits

- Simple estimators for models lacking official tokenizers.
- Hard caps on `max_tokens` / `temperature` per provider.
- Preflight estimates help show **cost previews** before generation.

---

## 15) Security Considerations

- Input size limits (server & reverse proxy).
- Sanitization for HTML-rendered content.
- Private API keys only server-side; never ship to client.
- Minimal PII in logs; redact content samples in ErrorLog.

---

## 16) Extensibility

- **New Targets**: e.g., `notes`, `summaries` → add prompt, parser, DTO.
- **New Providers**: add strategy + pricing + tokenizer.
- **New UI Surfaces**: Keep composables generic so components can mix/match.

---

## 17) Local Dev & Ops

- **Env**: `.env` for Mongo, Redis, provider keys.
- **Prisma**:
  - `prisma generate`
  - `prisma db push` (Mongo)
  - Seed pricing snapshots.
- **Scripts**:
  - `dev`: run Nuxt
  - `lint`, `typecheck`, `test` (if configured)
- **Monitoring**: enable reporter (SaaS) in production.

---

## 18) Testing Strategy (Outline)

- **Unit**: strategies, prompt builders, parsers.
- **Integration**: API routes with mocked providers & Redis.
- **E2E**: happy path – create folder → generate flashcards/quiz → display.

---

## 19) Appendix – Example Payloads

### Flashcards (response)
```json
[
  { "front": "What is a closure?", "back": "A function with access to its outer scope.", "tags": ["js"] },
  { "front": "Define SSR", "back": "Server-Side Rendering.", "tags": ["web"] }
]
```

### Quiz (response)
```json
{
  "questions": [
    { "prompt": "What does SOLID stand for?", "choices": ["...", "...", "...", "..."], "answer": 2, "explanation": "..." }
  ]
}
```

---

*End of document.*

---

## 20) Offline Persistence & IndexedDB Strategy

### Unified Database (Version 4 Migration)
The client and service worker share a single IndexedDB database defined by `DB_CONFIG`:

```ts
export const DB_CONFIG = {
  NAME: 'recwide_db',
  VERSION: 4,
  STORES: { FORMS: 'forms', NOTES: 'notes' }
}
```

Prior to version 4, stores were created lazily which risked partial schema creation if only one store was requested first. Version 4 performs a consolidated upgrade (`onupgradeneeded`) ensuring both stores and required indexes are present exactly once.

### Subsequent Versions (Current VERSION: 7)

| Version | Change | Purpose |
|---------|--------|---------|
| 5 | Added `PENDING_NOTES` store | Queue offline note edits separately from form submissions for batched background sync |
| 6 | Post-open schema verification + auto-repair (temp version bump if any required store missing) | Self-heal scenarios where a user skipped an earlier migration or a partial upgrade occurred |
| 7 | Reconciliation bump + `VersionError` fallback logic | Ensure clients that previously opened a repair-bumped DB (now at 7) don't throw `VersionError` when still using constant 6; fallback reopens with existing DB version |

Implementation notes:
- Auto-repair logic: after a successful open, we verify all required stores (`forms`, `notes`, `pendingNotes`). If any are missing we perform a one-time temporary version increment and recreate them additively, then reopen at the canonical version.
- `VersionError` handling: if the live database has a higher numeric version than our bundled constant, the open call may fail. We catch this and perform a second open without an explicit version to attach to the existing schema safely.
- All migrations remain additive and non-destructive—no store deletions.

Current `DB_CONFIG` excerpt:
```ts
export const DB_CONFIG = {
  NAME: 'recwide_db',
  VERSION: 7,
  STORES: { FORMS: 'forms', NOTES: 'notes', PENDING_NOTES: 'pendingNotes' }
}
```

### Stores
- `forms` – Queues offline form submissions for Background Sync (`syncForm` tag).
- `notes` – Local-first note content for folders, enabling offline editing and conflict mitigation.

### Indexes (Notes)
- `folderId` – Efficient folder-level retrieval.
- `updatedAt` – Supports future conflict detection (compare client vs server timestamps).

### Retry & Resilience
Concurrent transactions during tab reloads or SW restarts can surface transient `InvalidStateError` / `TransactionInactiveError`. To smooth these, a tiny exponential backoff is applied inside generic helpers (`putRecord`, `deleteRecord`). Configuration lives in `IDB_RETRY_CONFIG`:

```ts
export const IDB_RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 40,
  FACTOR: 2,
  MAX_DELAY_MS: 400,
  JITTER_PCT: 0.2
}
```

Characteristics:
1. **Bounded** – Never exceeds 400ms per attempt; worst-case total delay < ~1s.
2. **Targeted** – Only retries transient state errors; other failures bubble immediately.
3. **Non-blocking UX** – Keeps note edits & form queues snappy.

### Helper Design (`app/utils/idb.ts`)
- `openUnifiedDB()` – Singleton promise preventing race conditions.
- `putRecord` / `deleteRecord` – Sanitization + bounded backoff + unified reopen on retry.
- `sanitizeForIDB` – Strips non-cloneable values to prevent DataClone exceptions.

### Future Enhancements (P3+)
| Area | Improvement | Notes |
|------|-------------|-------|
| Conflict Detection | Use `updatedAt` to reject stale overwrites | Requires server compare API path |
| Partial Sync | Per-record acknowledgements in form sync responses | Service endpoint change |
| Storage Health | Early capability + quota check; surface banner if blocked | Detect Safari private mode / quota exceeded |
| Metrics | Lightweight counters for retry occurrences | Feed debug panel / telemetry |

### Operational Considerations
- **Do not close the shared DB** arbitrarily; connections persist across helpers.
- **Schema changes** require version bump + additive migration only (non-destructive).
- **Backoff tuning**: Increase `MAX_ATTEMPTS` or `BASE_DELAY_MS` only if observing frequent transient failures.

