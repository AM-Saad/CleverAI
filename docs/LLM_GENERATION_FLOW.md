# OpenRouter Generation Architecture

## Non-negotiable boundary

OpenRouter is the only inference integration. Application code must not call a model vendor directly, download a browser model, introduce provider SDKs, or add model/pricing configuration to MongoDB.

The flow is: client feature, authenticated API, shared rate limit, atomic quota reservation, OpenRouter adapter, strict output validation, application persistence, usage audit, response.

## Components

| Component                    | Responsibility                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `openRouter.ts`              | HTTP transport, timeout/retry, structured schemas, multimodal payloads, response measurement  |
| `llmRequestPipeline.ts`      | Authentication, shared rate limit, quota reservation/refund, one request ID, settlement       |
| `usageLogger.ts`             | One `LlmUsage` audit record with requested/actual model, tokens, native cost, status, latency |
| `generationQuota.ts`         | Atomic free-quota or credit reservation and compensating refund                               |
| `runGatewayGeneration.ts`    | Flashcard/quiz use case and optional exact persistence                                        |
| Language application modules | Translation/story parsing and persistence                                                     |

## Entry points

- `POST /api/llm.gateway`: flashcards and quizzes
- `POST /api/ai/summarize`: text summary
- `POST /api/ai/math-recognize`: handwritten image to LaTeX
- `POST /api/ai/transcribe`: audio transcription
- `POST /api/language/translate`: lexical translation/definition
- `POST /api/language/generate-story`: language story

Browser speech synthesis remains native platform output. It performs no model inference.

## Request lifecycle

1. Validate request shape and resource ownership.
2. Authenticate the user.
3. Enforce shared user and IP rate buckets. Redis is authoritative when available; a real 429 is never converted to fallback success.
4. Confirm the OpenRouter key exists.
5. Check quota, then reserve it atomically before the remote request.
6. Call `https://openrouter.ai/api/v1/chat/completions` with timeout, bounded retry, provider fallback, privacy filtering, response caching, and usage inclusion.
7. Reject empty, truncated, malformed, wrong-shape, or wrong-count output.
8. Persist requested artifacts. Reviewed previews use commit endpoints, never a second generation call.
9. Finalize once: write `LlmUsage`, expose actual model and quota headers, return.
10. On failure: refund the app reservation once and write an error audit. If OpenRouter returned usable output before application persistence failed, its tokens and cost remain in the audit.

## Data policy

`LlmUsage` is audit data, not routing configuration. It stores:

- provider (`openrouter`)
- requested router/model slug and actual model reported by OpenRouter
- app and provider request IDs
- input/output/total tokens
- OpenRouter-reported total cost in integer micro-dollars
- status/error, latency, cache status, feature, user/workspace context

There is no `LlmPrice`, `LlmModelRegistry`, or `LlmGatewayLog`. Pricing is never calculated from a local table.

Language word/story rows may retain the actual model string that produced content. This is immutable provenance, not a selectable model registry.

## Configuration

- `OPENROUTER_API_KEY`: required server secret
- `OPENROUTER_MODEL`: optional; defaults to `openrouter/auto`
- `OPENROUTER_TIMEOUT_MS`: optional; defaults to 45000
- `REDIS_URL`: optional distributed limiter; memory fallback is per process

No model selector is accepted from public generation requests.

## Failure semantics

- OpenRouter 4xx/5xx status is preserved.
- 408/5xx and network failures receive at most one retry by default; 429 is not retried.
- Timeout becomes 504; network failure becomes 502; missing key becomes 503.
- Invalid model output becomes 502 and is never silently converted to an empty array.
- Persistence errors are not swallowed.
- Quota storage failures fail closed.

## Tests

`scripts/run-unit-tests.ts` covers actual-model/cost/cache measurement, strict structured-output rejection, upstream status preservation, quota reservation, and refund. Production verification also requires Prisma validation, `yarn typecheck`, and `yarn build`.

## Database cleanup

Run `yarn db:remove-legacy-ai` to preview removal. After backup, run `yarn db:remove-legacy-ai --apply` to drop legacy catalog/gateway collections and unset retired fields. Historical `LlmUsage` remains for audit.
