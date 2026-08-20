# AI System Audit and OpenRouter-Only Migration

Audit date: 2026-08-21

## Verdict

The previous AI subsystem was not acceptably engineered for a single-provider product. It mixed direct provider strategies, a model registry, local price calculation, semantic caching, browser inference, duplicate gateway logs, and feature-specific shortcuts. Several failure paths could mischarge quota, hide provider failures, return invalid output, or generate twice while saving once.

The migrated system is materially smaller and safer:

- OpenRouter is the only model-inference boundary.
- Public callers cannot select providers or models.
- MongoDB contains usage/provenance, not routing or pricing configuration.
- Every inference path uses one authentication, rate-limit, quota, validation, audit, and settlement lifecycle.
- Browser model downloads, direct-provider SDKs, local model workers, and MyScript are removed.
- Provider-reported model, tokens, cache state, and native cost are retained as audit facts.
- Reviewed previews are committed exactly; they are never regenerated during save.

The architecture is now fit for the stated OpenRouter-only policy. Remaining risks are operational, listed below; none requires restoring provider factories, a model registry, or local prices.

## Scope and method

The audit traced live code in both directions and searched the entire non-archived repository for old providers, model workers, model registries, pricing, routing, public model selection, direct inference SDKs, and stale operational instructions.

Bottom-up trace:

1. dependencies and build scripts
2. runtime configuration and secrets
3. Prisma schema and cleanup tooling
4. OpenRouter transport and response validation
5. rate limit, quota reservation/refund, and usage audit
6. application modules and persistence
7. API routes and contracts
8. client services, composables, and UI callers
9. tests, build, service worker, and documentation

Top-down trace:

1. user action
2. typed client service/composable
3. authenticated server endpoint
4. shared lifecycle
5. OpenRouter request
6. strict output parsing
7. feature persistence
8. quota/audit settlement
9. response and UI state

Archived incident documents remain historical records. Living source and documentation were updated.

## Before: principal findings

| Severity | Finding                                                                    | Consequence                                    | Disposition                                                 |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Critical | Multiple direct providers plus registry/factory/routing policy             | OpenRouter-only policy could not be guaranteed | Deleted; one native HTTP adapter remains                    |
| Critical | Admin OpenRouter test endpoint outside the normal lifecycle                | Extra secret-backed generation surface         | Deleted                                                     |
| High     | Quota check and increment were separate; some storage failures failed open | Race conditions or unpaid generations          | Atomic reservation, fail-closed checks, compensating refund |
| High     | Redis limiter could catch its own 429 and silently fall back               | Rate-limit bypass                              | Real limiter errors are rethrown                            |
| High     | Invalid, empty, or truncated output could be hidden or normalized          | False success and corrupt content              | JSON Schema plus Zod validation; 502 on invalid output      |
| High     | Persistence failures could be swallowed after inference                    | Quota charged without saved result             | Persist before success settlement; failure refunds quota    |
| High     | Preview-save flows could call the model a second time                      | Duplicate cost and content drift               | Exact reviewed-item commit endpoints                        |
| High     | Local/browser inference and vendor speech recognition bypassed OpenRouter  | Policy violation and inconsistent behavior     | Removed; recorded speech uses authenticated OpenRouter API  |
| Medium   | Local pricing and duplicate gateway logs diverged from provider billing    | Incorrect analytics and redundant data         | OpenRouter-native cost in one `LlmUsage` record             |
| Medium   | Public/model fields existed in contracts and content models                | Hidden model-selection state                   | Removed from contracts, Workspace, and Material             |
| Medium   | Provider SDK and worker dependency graph was large                         | Larger supply-chain/build surface              | Removed SDKs/workers and lockfile graph                     |
| Medium   | AI documentation described deleted paths as current                        | Unsafe maintenance decisions                   | Living documentation rewritten                              |

## Current architecture, bottom up

### Dependencies and configuration

No model vendor SDK is required. OpenRouter uses native `fetch`. Removed direct AI dependencies include the Google, OpenAI, OpenRouter SDK, Gradio, Hugging Face Transformers, MyScript iink, and tokenizer packages.

Server-owned configuration is limited to:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`, default `openrouter/auto`
- `OPENROUTER_TIMEOUT_MS`, default 45000

`REDIS_URL` controls distributed rate limiting, not inference. No public runtime configuration exposes the key or accepts a provider/model choice.

### Data model

`LlmUsage` is an audit table. It stores the requested OpenRouter router/model slug, actual model returned by OpenRouter, provider/app request IDs, tokens, native total cost, status, feature, latency, and cache metadata.

Removed configuration/duplicate models:

- `LlmPrice`
- `LlmModelRegistry`
- `LlmGatewayLog`

Removed content fields:

- `Workspace.llmModel`
- `Material.llmModel`
- `Material.llmPrompt`

Language content can retain the actual producing model as immutable provenance. It cannot be selected or used for routing.

The cleanup script is dry-run by default. It preserves historical `LlmUsage` while dropping legacy collections and unsetting retired fields when `--apply` is supplied.

### OpenRouter boundary

`server/utils/llm/openRouter.ts` owns the external protocol:

- bearer authentication and attribution headers
- timeout and one bounded retry for network/408/5xx failures
- no retry on 429
- provider fallback inside OpenRouter only
- provider sorting by price and data-collection denial
- native response caching and usage inclusion
- text, image, and audio input payloads
- structured-output schemas
- actual model, request ID, tokens, cost, reasoning, and cache measurement
- rejection of empty and length-truncated output

Feature methods expose meaningful operations: flashcards, quiz, summary, math recognition, transcription, and generic validated JSON text generation. Application code never constructs direct vendor requests.

### Shared lifecycle

`server/utils/llm/llmRequestPipeline.ts` owns request policy:

1. authenticate
2. enforce user/IP rate limits
3. construct OpenRouter client, failing before quota use if key is absent
4. check quota without creating state
5. reserve quota atomically
6. expose the sole OpenRouter client
7. settle exactly once

Success settlement writes usage after application persistence. Failure settlement refunds the reservation once and writes an error audit. If inference succeeded but persistence failed, the error audit still records real OpenRouter usage and cost.

### Quota

Free-quota and credit reservations occur inside a Prisma transaction. Paid tiers use an explicit unlimited reservation. Credit spends and refunds produce ledger entries. Storage errors fail closed.

This is reservation/compensation, not a distributed transaction with OpenRouter. Remote inference cannot share a MongoDB transaction.

### Validation and persistence

Flashcard and quiz output must match both OpenRouter JSON Schema and local Zod schemas: exact requested counts, non-empty text, four choices, and valid answer index. Summary and math output are schema validated. Language parsers reject incomplete lexical/story JSON.

Feature modules own persistence and persist before success finalization. Preview generation returns unsaved DTOs; exact commit APIs save reviewed DTOs without another inference call.

### Client

All model-backed client functions call authenticated server routes:

- flashcards/quizzes: gateway service
- summaries: `/api/ai/summarize`
- math images: `/api/ai/math-recognize`
- recorded speech: `/api/ai/transcribe`
- lexical content/story: `/api/language/*`

Native browser speech synthesis remains output-only and performs no model inference. Browser/vendor speech recognition was removed.

## Current architecture, top down

### Flashcard and quiz generation

UI → `GatewayService` → `/api/llm.gateway` → request preparation/ownership → shared lifecycle → OpenRouter structured output → exact Zod validation → optional persistence → usage settlement → DTO response.

If the UI reviews a preview, it posts those exact items to the material/workspace generated endpoint. Save does not call OpenRouter.

### Summary

Editor selection → summary composable → authenticated endpoint → shared lifecycle → OpenRouter JSON schema → validation → audit settlement → insert returned summary.

### Math recognition

Canvas image → math composable → authenticated endpoint → shared lifecycle → OpenRouter image input → LaTeX schema → validation → audit settlement → editor update.

### Transcription

Microphone recording → WAV encoding → authenticated endpoint → shared lifecycle → OpenRouter audio input → non-empty transcript → audit settlement → caller update.

### Language capture and stories

Language endpoint/application module → ownership/preferences → shared lifecycle → OpenRouter → strict parser → persistence → optional review enrollment → success settlement. Reused application data performs no inference; its quota reservation is refunded if saving fails.

## SOLID assessment

| Principle             | Result                         | Evidence and limit                                                                                                                                                                                                               |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single Responsibility | Pass with one caveat           | Transport/payload/measurement live in the OpenRouter boundary; lifecycle, quota, audit, and persistence are separate. `openRouter.ts` also contains task schemas; split only if task count grows materially.                     |
| Open/Closed           | Deliberately constrained       | New OpenRouter task methods can be added without changing persistence. Alternate provider extension is intentionally unsupported because it contradicts product policy.                                                          |
| Liskov Substitution   | Pass/not materially applicable | Unsafe provider strategy hierarchy removed. Quota ports have compatible implementations/fakes tested through one contract.                                                                                                       |
| Interface Segregation | Pass                           | Quota, persistence, and feature modules use narrow contracts. OpenRouter client is a cohesive facade, not a universal provider abstraction.                                                                                      |
| Dependency Inversion  | Mostly pass                    | Application modules depend on ports and shared boundary. Remaining coupling: lifecycle receives `H3Event` for auth, headers, Prisma context, and limiting. An HTTP-neutral request context is the main future SOLID improvement. |

Overall: good engineering for a modular monolith and single-provider policy. It avoids speculative provider abstractions while retaining boundaries protecting money, data, and correctness.

## Behavioral and failure guarantees

- Missing key: 503 before quota reservation.
- Upstream 4xx/5xx: status preserved where possible.
- OpenRouter 429: returned immediately; never retried or swallowed.
- Network failure: one retry, then 502.
- Timeout: bounded policy, then 504.
- Invalid/empty/truncated output: 502; never empty success.
- Persistence failure: request fails; quota refunded.
- Usage-log failure: saved result is not reversed; audit-write error is logged.
- Rate-limit storage unavailable: process-local memory fallback; production should configure Redis.
- App quota is charged per successful user generation, including native OpenRouter cache hits. Product quota is separate from provider cost.

## Verification evidence

- 226 unit tests passed.
- Prisma schema validation passed.
- ESLint passed.
- Nuxt typecheck passed.
- Architecture check passed for 64 server-module and 68 frontend-feature files.
- Production build and injected service-worker verification passed.
- Repository scan found no live direct-provider SDK/import/key, browser inference worker, MyScript, registry, price table, gateway-log model, or public model-selection path outside intentional cleanup/history references.

OpenRouter unit tests use fake transport to verify request policy, actual model/native cost/cache measurement, strict-output rejection, and upstream status preservation. They do not spend credits or require a live key.

## Remaining improvements, ranked

1. Add a staging smoke test using a low-cost OpenRouter account: one structured text, image, and audio request, then inspect `LlmUsage`. Keep it outside PR tests.
2. Add a durable audit outbox if usage records become contractual billing records. Current audit writes are best-effort after successful persistence.
3. Move auth, headers, and Prisma access out of `llmRequestPipeline.ts` if the application layer must become framework-neutral.
4. Add reservation IDs if refunds must survive process crashes or asynchronous jobs. Current settlement is idempotent within one request process.
5. Alert on missing provider cost, refund failure, invalid output, repeated 429, and OpenRouter 5xx rates.
6. Pin `OPENROUTER_MODEL` server-side for deterministic capability/cost; retain `openrouter/auto` when flexibility is preferred.
7. If task schemas materially grow, move them to task files while retaining one transport. Do not recreate provider strategies or a registry.
8. Consider self-hosting UI fonts. Model builds no longer download fonts, but the browser stylesheet remains a runtime dependency unrelated to AI.

## Deployment checklist

1. Back up MongoDB.
2. Set OpenRouter configuration and production Redis.
3. Run `yarn db:remove-legacy-ai` and inspect dry-run output.
4. Run `yarn db:remove-legacy-ai --apply` against the intended database.
5. Run `yarn db:sync`.
6. Deploy and exercise each AI feature in staging.
7. Confirm one `LlmUsage` row per inference with provider, actual model, tokens, native cost, status, and latency.
8. Confirm legacy collections and retired fields are absent.

## Protocol references

- OpenRouter provider routing: <https://openrouter.ai/docs/guides/routing/provider-selection>
- Multimodal inputs: <https://openrouter.ai/docs/guides/overview/multimodal/overview>
- Image input: <https://openrouter.ai/docs/guides/overview/multimodal/image-understanding>
- Audio input: <https://openrouter.ai/docs/guides/overview/multimodal/audio>
- Speech-to-text: <https://openrouter.ai/docs/guides/overview/multimodal/stt>
