# Copilot instructions for Cognilo

Be concise. When coding, prefer small, incremental changes with tests or smoke checks. Always reference the files mentioned below.

- Project type: Nuxt 4 (`compatibilityVersion: 4`, app source in `app/`), TypeScript, Vue 3.5, Pinia, Tailwind CSS v4 + Nuxt UI v4. Server code lives under `server/` and shared types/validation live in `shared/`.
- Common commands (see `package.json`):
  - Dev: `yarn dev` (runs `ai-worker:build` then `nuxt dev` on :8080)
  - Build: `yarn build` or `yarn build:inject` (runs service-worker build + checks)
  - Preview prod locally: `yarn preview`
  - Tests: Playwright PWA tests `yarn test:pwa-offline`
  - Prisma: `yarn db:sync`, `yarn db:studio`, `yarn db:seed`
  - Lint/format: `yarn lint`, `yarn lintfix`, `yarn format`

- Key files to consult for feature changes:
  - `nuxt.config.ts` — srcDir = `app/`, runtimeConfig keys, and modules. See the `hooks.ready` list for required dev env vars.
  - `package.json` — scripts and dependencies.
  - `docs/DEVELOPMENT.md` — developer workflows, service worker, cron, notification testing.
  - `ARCHITECTURE.md` — high-level architecture and design decisions.
  - `server/utils/llm/*` and `server/services/*` — LLM strategy implementations, token and cost accounting.
  - `shared/utils/*.contract.ts` — Zod schemas used across client/server; add/modify here for shared types.

- Important patterns & conventions (do not change without considering impact):
  - Strategy pattern for LLMs (`server/utils/llm/`). Current providers: OpenAI, Gemini, DeepSeek, Groq, OpenRouter (`*Strategy.ts`). Add a new provider via a new `LLMStrategy` implementation registered in `LLMFactory.ts` (`getLLMStrategy()` / `getLLMStrategyFromRegistry()`). Log usage through the `onMeasure` callback so cost accounting (`llmCost.ts` + `gatewayLogger.ts`) stays consistent.
  - Rate limiting: implemented centrally (Redis primary, in-memory fallback). Keys sometimes include `{ model }` to enforce per-model limits.
  - Validation: Zod schemas in `shared/` are authoritative for request/response shapes.
  - Service layer: frontend `serviceFactory` + `FetchFactory` stdizes API calls; prefer adding or extending services rather than scattering fetches across components.
  - PWA: SW built from `sw-src/` via `yarn sw:build`; `build:inject` wires SW into production build.
  - Design system (enforced): tokens are the single source of truth (`app/design-system/tokens/index.cjs` → `yarn design:tokens`); no raw hex / Tailwind palette / built-in `rounded-*`/`shadow-*` (gated by `yarn design:check`). Feature/page UI uses `Ui*` wrappers (`app/components/ui/`), not Nuxt UI `U*` directly (gated by `yarn design:boundaries`). See `CLAUDE.md` + `app/DESIGN.md`.

- Testing & debugging expectations:
  - When adding or changing API behavior, update or add unit/integration tests where possible and run `yarn db:sync` + `yarn dev` for local verification.
  - For PWA or SW changes, run `yarn sw:build` and validate via the debug pages in `debug-archive/` or the `/debug` route in dev.
  - For cron/notifications, `docs/DEVELOPMENT.md` contains curl examples and debug UIs; use `ENABLE_CRON` and `CRON_SECRET_TOKEN` in `.env` for local testing.

- Examples to reference in PRs or edits:
  - Adding an LLM provider: follow `server/utils/llm/OpenAIStrategy.ts` (or any `*Strategy.ts`) + register in `LLMFactory.ts`.
  - Persisting LLM usage: follow the `LlmUsage` shape and `logLlmUsage()` call sites (`server/utils/llmCost.ts`).
  - New API route: place under `server/api/` and use shared `Zod` contracts for request validation.

- Safety & environment notes:
  - Many dev tools require env vars listed in `nuxt.config.ts` hooks.ready. Incomplete envs print warnings but do not always fail.
  - Prisma + Mongo uses `prisma db push` (not migrations). Use `yarn db:sync`.
  - Rate-limiter uses `REDIS_URL` when provided; otherwise falls back to in-process memory (not for production).

- Commit & style guidance:
  - Project uses Husky + lint-staged; the pre-commit hook runs `yarn design:check` + `yarn design:boundaries`. Conventional commits enforced via commitlint.
  - Keep changes small and reversible; prefer adding tests and updating `docs/` when behavior changes.

If anything above is unclear, ask for the specific area (build, LLM, rate-limiter, SW) and I will expand with concrete examples or make the change directly.