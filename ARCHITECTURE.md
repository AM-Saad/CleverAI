# CleverAI – Architecture & Implementation Notes

This document is the deep-dive for engineers and reviewers. The main `README.md` is kept concise for recruiters; this file explains the **how** and **why**.

---

## 1) System Overview

CleverAI is a Nuxt 3 + TypeScript app that generates **flashcards** and **quizzes** from user-provided content (text, docs, YouTube transcripts). It uses a **pluggable LLM Strategy** to route generation requests to different model providers while enforcing **rate limits**, **budget guardrails**, and **usage tracking**.

**Key goals**
- Deterministic, testable architecture (clear boundaries, typed contracts).
- Cost-aware LLM usage (rate limits, token/cost estimates, logging).
- Easy to extend (new LLMs, new generators).

---

## 2) High-Level Architecture

```
[UI (Nuxt Pages & Components)]
        │
        ▼
[Composables (use* resources)]
        │
        ▼
[Service Layer (FetchFactory, ServiceFactory, ErrorFactory)]
        │
        ▼
[API Routes (/api/*)]
        │
        ▼
[Business Logic (LLM Strategies, Prompts, Validation)]
        │
        ├── Rate Limiter (Redis → in-memory fallback)
        ├── Pricing/Usage Logger
        └── Prisma (MongoDB)
```

- **Nuxt Pages/Components**: Presentational, lean.
- **Composables**: Resource-specific hooks that own local state, request lifecycles, and error display.
- **Service Layer**: Consumes contracts, encapsulates HTTP transport, consistent error handling.
- **API Routes**: Nuxt server routes that validate inputs, enforce limits, call strategies, persist results.
- **Business Logic**: Strategy Pattern for model selection, prompt builders, pricing, and token estimation.
- **Data**: Prisma (MongoDB) for persistence; Redis for rate limiting.

---

## 3) Tech Stack Choices

- **Nuxt 3, Vue 3, TypeScript** – SSR-capable, DX-friendly, type safety.
- **TailwindCSS** – Fast, consistent UI.
- **Prisma + MongoDB** – Schemas with application-level types, simple onboarding.
- **Redis (Upstash-ready)** – Global rate limiting + headers.
- **Zod** – Runtime validation for all external boundaries.
- **Strategy & Factory patterns** – Pluggable LLMs, minimal surface for change.
- **Tokenization utilities** – Estimated cost awareness before/after inference.

---

## 4) Data Model (Prisma / MongoDB)

> Note: Using MongoDB `_id` mapping with Prisma.

- **Folder**
  - `id`, `name`, `model` (e.g., `gpt-4o-mini`), `createdAt`, `updatedAt`
  - Metadata: description, source type(s)
- **Flashcard**
  - `id`, `folderId`, `front`, `back`, `tags[]`
- **Quiz**
  - `id`, `folderId`, `questions[]` (MCQ / short answer), `difficulty`
- **LLMUsage**
  - `id`, `userId`, `provider`, `model`, `inputTokens`, `outputTokens`, `inputCostMicroUsd`, `outputCostMicroUsd`, `timestamp`
- **ErrorLog**
  - `id`, `context`, `message`, `stack?`, `requestId`, `meta`

**Implementation Notes**
- Mongo `_id` → Prisma: `@map("_id")`.
- Use `Decimal` (or numeric micro-units) for cost to avoid floating errors.
- Seed table for **pricing snapshots** per provider/model to ensure **historical cost correctness**.

---

## 5) Contracts & Validation (Zod)

All external boundaries validated with Zod:

- **Request DTOs**:
  - `GenerateInput` (`folderId`, `content`, `target: "flashcards" | "quiz"`, `model`)
- **Response DTOs**:
  - `Flashcards[]` with `front`, `back`, `tags?`
  - `Quiz` with `questions[]` each `{ prompt, choices?, answer, explanation? }`

Validation flow:
1. Client validates before submit (optional).
2. API validates body (mandatory).
3. Strategy validates provider-specific options (e.g., max tokens).

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
