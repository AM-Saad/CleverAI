# Copilot instructions for Cognilo

Be concise. When coding, prefer small, incremental changes with tests or smoke checks. Always reference the files mentioned below.

- Project type: Nuxt 3 (app source in `app/`), TypeScript, Vue 3, Pinia. Server code lives under `server/` and shared types/validation live in `shared/`.
- Common commands (see `package.json`):
  - Dev: `yarn dev` (runs `sw:build` then `nuxt dev`)
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
  - `shared/*.contract.ts` — Zod schemas used across client/server; add/modify here for shared types.

- Important patterns & conventions (do not change without considering impact):
  - Strategy pattern for LLMs. Add new provider via `getLLMStrategy()` and a new `LLMStrategy` implementation. Log usage through the `onMeasure` callback so cost accounting is consistent.
  - Rate limiting: implemented centrally (Redis primary, in-memory fallback). Keys sometimes include `{ model }` to enforce per-model limits.
  - Validation: Zod schemas in `shared/` are authoritative for request/response shapes.
  - Service layer: frontend `serviceFactory` + `FetchFactory` stdizes API calls; prefer adding or extending services rather than scattering fetches across components.
  - PWA: SW built from `sw-src/` via `yarn sw:build`; `build:inject` wires SW into production build.

- Testing & debugging expectations:
  - When adding or changing API behavior, update or add unit/integration tests where possible and run `yarn db:sync` + `yarn dev` for local verification.
  - For PWA or SW changes, run `yarn sw:build` and validate via the debug pages in `debug-archive/` or the `/debug` route in dev.
  - For cron/notifications, `docs/DEVELOPMENT.md` contains curl examples and debug UIs; use `ENABLE_CRON` and `CRON_SECRET_TOKEN` in `.env` for local testing.

- Examples to reference in PRs or edits:
  - Adding an LLM provider: follow `server/utils/llm/GPT35Strategy.ts` + update the factory.
  - Persisting LLM usage: follow the `LlmUsage` shape and `logLlmUsage()` call sites in the strategies.
  - New API route: place under `server/api/` and use shared `Zod` contracts for request validation.

- Safety & environment notes:
  - Many dev tools require env vars listed in `nuxt.config.ts` hooks.ready. Incomplete envs print warnings but do not always fail.
  - Prisma + Mongo uses `prisma db push` (not migrations). Use `yarn db:sync`.
  - Rate-limiter uses `REDIS_URL` when provided; otherwise falls back to in-process memory (not for production).

- Commit & style guidance:
  - Project uses Husky + lint-staged. Run `yarn pre-commit` locally to ensure hooks are installed.
  - Keep changes small and reversible; prefer adding tests and updating `docs/` when behavior changes.

If anything above is unclear, ask for the specific area (build, LLM, rate-limiter, SW) and I will expand with concrete examples or make the change directly.