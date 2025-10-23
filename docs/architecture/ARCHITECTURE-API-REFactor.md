# API & Error Handling Refactor Overview

> Status: In progress (pre-bound client + auth middleware cleanup pending)
> Last Updated: 2025-09-29

## Goals
- Centralize server error handling & response envelopes
- Provide consistent client consumption (plain data on success, thrown APIError on failure)
- Add resilience (network normalization, retries for 429/503, cancellation)
- Improve DX via generated typed API client wrappers

## Server Changes
### Unified Response Contract
All endpoints now return either:
```ts
return success(data) // wraps in { success: true, data }
```
Errors are thrown using the `Errors.*` helpers (server/utils/error.ts), which standardize shape:
```json
{ "success": false, "error": { "message": string, "statusCode": number, "code": string? } }
```
Legacy `createError` / `ErrorFactory` usages removed (except auth middleware still pending cleanup).

### Validation
- Zod used for request body & query validation.
- On validation failure: throw `Errors.badRequest(message, issues?)`.
- Response validation (select endpoints) uses `.parse` before `success()`.

### Auth Middleware (Pending Refactor)
`server/middleware/auth.ts` still references legacy pieces; to switch to `Errors.unauthorized/forbidden` next.

## Client Layer Changes
### FetchFactory (app/services/FetchFactory.ts)
Enhancements:
- Envelope auto-detection & unwrapping
- Overloaded `call` with optional zod validator parameter for response typing
- Network / transport error normalization:
  - AbortError -> status 499 code `ABORTED`
  - Fetch/TypeError -> status 0 code `NETWORK_ERROR`
- Automatic exponential backoff retry for status 429 & 503 (capped ~8s, jitter)
- Central `onError` hook support
- Static `controller()` helper to create AbortController
- Legacy path fallback for endpoints not yet migrated

### APIError
Uniform error surface with `.status` and `.code` for UI logic & toast handling.

### Caller Simplification
Components/composables should now treat resolved promise as success; no need to check `response.success`.
Pending removal of old checks in some components.

## API Client Generator (scripts/codegen/api-client-generator.ts)
Purpose: Automate generation of strongly-typed endpoint wrappers.
Features Implemented:
- Recursive scan of `server/api`
- File-to-route inference (dynamic `[id]`, catch-all `[...slug]`, wildcard arrays)
- Method derivation from filename suffix (`.get.ts`, `.post.ts`, etc.)
- Wildcard param expansion: `:slug*` => `string[]` with join on generation
- Ignore patterns (email templates, debug)
- Output hashing to skip writing unchanged file
- Naive schema detection: finds `*ResponseSchema` & `*RequestSchema`/`RequestBodySchema` and wires validator
- Auto imports detected schemas & generates `ff.call<ResponseType>(method, url, body?, {}, ResponseSchema)`

Generated file: `app/lib/api.generated.ts`
Remaining enhancements (planned):
- Pre-bound client factory `createApiClient(ff)` (Todo)
- More robust AST-based schema detection (current regex heuristic)
- Optionally enforce presence of response schema (build fail if missing)

## Current Gaps / Todos
- Auth middleware refactor to new Errors utilities
- Remove any remaining UI `response.success` guards
- Pre-bound API client factory generation
- Retry behavior test harness

## Retry Behavior
- Status 429 / 503: exponential backoff (1s, 2s, 4s, 8s max + jitter) up to configured retries
- Immediate throw for other status-derived APIError
- Network vs abort differentiated for UX

## Developer Usage
```ts
import FetchFactory from '@/services/FetchFactory'
import { postFolders } from '@/lib/api.generated'

const ff = new FetchFactory($fetch, '', 2) // 2 retries
const folder = await postFolders(ff, undefined, { title: 'New', description: '' })
```
With validator auto-wired (if response schema detected) Typescript will infer the return type.

## Migration Guidelines for New Endpoints
1. Validate input with zod
2. Wrap success payload: `return success(data)`
3. Throw standardized errors via `Errors.*`
4. (Optional) Provide `*ResponseSchema` to enable typed client generation

## Error Handling in UI
Centralize toast logic in `onError` hook passed to FetchFactory. Distinguish via `error.code`:
- `NETWORK_ERROR` => show offline message
- `ABORTED` => ignore or log quietly
- Business codes (e.g., `UNAUTHORIZED`) => redirect/login

## Suggested Next Steps
- Implement pre-bound client & export default instance
- Add jest/playwright style minimal test covering retry & validator failure
- Enforce schema presence for critical domains (review, folders, notifications)
- Refactor auth middleware & delete deprecated ErrorFactory file

## Changelog Summary
- Added unified error utilities & `success()` envelope
- Migrated review, notifications, folders, materials, auth endpoints
- Upgraded FetchFactory (envelopes, retries, network normalization, validators, abort, onError)
- Introduced API client generator with schema detection & hashing
- Generated initial `api.generated.ts`

## Appendix: Naming Conventions
- Endpoint filename: `resource/action.post.ts` => route `/api/resource/action` method POST
- Dynamic: `[id].get.ts` => `/api/resource/:id`
- Catch-all: `[...path].ts` => `/api/resource/:path*` maps to `string[]`
- Schemas: `ThingResponseSchema` & `CreateThingRequestSchema`

---
End of document.
