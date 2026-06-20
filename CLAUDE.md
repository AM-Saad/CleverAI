# CLAUDE.md

Guidance for working in this repo. Be concise; make small, verifiable changes.

## What this is

**Cognilo** (a.k.a. CleverAI) — an AI-powered learning assistant (notes, flashcards/spaced-repetition review, language learning, materials, workspaces, real-time collab).

Stack: **Nuxt 4** (`compatibilityVersion: 4`, `srcDir: app/`), Vue 3.5, TypeScript, **Tailwind CSS v4** + **Nuxt UI v4**, Pinia, Prisma (MongoDB, `db push` — no migrations), PWA (service worker from `sw-src/`), Hocuspocus/Yjs collaboration. (Older docs say "Nuxt 3" — it's Nuxt 4.)

## Layout

- `app/` — frontend (Nuxt srcDir). `components/`, `pages/`, `layouts/`, `composables/`, `services/`, `features/`, `design-system/`.
- `app/features/<feature>/` — **the canonical place for feature code**: `components/`, `containers/` (data/logic, imported by pages), `composables/`, `services/`. Features are: `board, integrations, language-learning, materials, notes, notifications, review`.
- `server/` — Nitro API routes + server services (LLM strategies, cron, notifications).
- `shared/` — **Zod contracts** in `shared/utils/*.contract.ts` (e.g. `note.contract.ts`, `workspace.contract.ts`), authoritative for request/response shapes across client+server.
- Aliases: `~`/`@` → `app/`; `@server` → `server/`; `~/shared`,`#shared`,`@shared` → `shared/`.

## Commands

- Dev: `yarn dev` (builds AI worker, `nuxt dev` on :8080). Build: `yarn build` (frontend+nitro) / `yarn build:inject` (with SW).
- Lint: `yarn lint` / `yarn lintfix`. Unit tests: `yarn test:unit`. PWA e2e: `yarn test:pwa-offline`.
- Prisma: `yarn db:sync`, `yarn db:studio`, `yarn db:seed`.
- **Design system:** `yarn design:tokens` (regenerate), `yarn design:check` (token gate), `yarn design:boundaries` (component gate), `yarn design:contrast` (WCAG AA), `yarn design:audit` / `yarn design:components` (reports).
- Boundaries: `yarn arch:check` (layer import rules).

## Design system (read before touching any UI)

Full specs: [app/DESIGN.md](app/DESIGN.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/COMPONENT_SYSTEM.md](docs/COMPONENT_SYSTEM.md).

**Tokens** — single source of truth is [app/design-system/tokens/index.cjs](app/design-system/tokens/index.cjs). Edit there, then `yarn design:tokens` to regenerate `tokens.generated.{css,ts}` (**never hand-edit the generated files**). `themeTokens` → Tailwind utilities (`bg-surface`, `text-content-secondary`, gradient `from-/to-…`) **and** `var(--…)`. `darkTokens` → `.dark` overrides. `rootTokens` → `:root` vars (`--syntax-*`, `--ds-*`, `--component-*`). JS that needs a literal color reads `designTokenValues` from the generated TS (don't hardcode hex).

**Styling rules (enforced by `yarn design:check`, in pre-commit + CI):**
- No raw hex, no Tailwind palette classes (`text-gray-500`), no built-in `rounded-*`/`shadow-*`. Use token utilities (`bg-surface`, `rounded-[var(--radius-lg)]`, `shadow-[var(--shadow-dropdown)]`). Translucency via `color-mix(in srgb, var(--token) N%, transparent)`.
- Escape hatch: `design-allow` comment on the line, or `design-allow-file` in the file. Use sparingly.

**Components** — primitives live in `app/components/ui/` as **`Ui*`** wrappers, mostly thin wrappers over the already-themed Nuxt UI (`UiButton`→`UButton`, `UiModal`→`DialogModal`, etc.), built with **`tailwind-variants` `tv()`** from [app/components/ui/variants.ts](app/components/ui/variants.ts) (shared `SIZES`/`TONES`). Reference impl: [UiCard.vue](app/components/ui/UiCard.vue).
- **Policy (enforced by `yarn design:boundaries`):** feature/page code uses `Ui*`, **not** Nuxt UI `U*` directly, and no raw `<button>`/`<input>`/`<dialog>`/ad-hoc modal overlays. The gate is a *regression* gate against the `docs/component-audit/components.json` baseline (no new drift; existing backlog is being migrated incrementally).
- Prop vocabulary: `tone` (primary/neutral/success/warning/error/info), `size` (xs–xl), `variant`, boolean `loading`/`disabled`. Wrappers forward all slots + `$attrs`.
- **Dark mode:** light by default; `UiColorModeToggle` (light/dark/system) sets `.dark` on `<html>`, which flips the token-based UI automatically.
- **Catalog:** `/design-system` (dev-only route) renders every primitive × states + token palettes. Keep it updated when adding a primitive.

## Backend conventions

- **LLM:** strategy pattern in `server/utils/llm/` — `getLLMStrategy()`/`getLLMStrategyFromRegistry()` in `LLMFactory.ts`; current providers are OpenAI/Gemini/DeepSeek/Groq/OpenRouter (`*Strategy.ts`). Cost/usage accounting via `llmCost.ts` + `gatewayLogger.ts`.
- **API:** routes under `server/api/`, validate with the `shared/utils/*.contract.ts` Zod schemas.
- **Frontend data:** use the `serviceFactory` + `FetchFactory` service layer (`app/services/`); don't scatter `fetch` in components.
- `yarn arch:check` enforces layer boundaries (e.g. server must not import frontend/app or API-route adapters).

## Gotchas (learned the hard way)

- **Nuxt auto-import names are path-derived.** `components/<dir>/<File>.vue` registers as `<DirFile>` (e.g. `components/workspace/NotesSection.vue` → `<WorkspaceNotesSection>`), and the dir prefix is **deduped only when the filename already starts with it** (`board/BoardItemCard` → `<BoardItemCard>`). Before renaming/deleting any component, search for its **real registered name AND kebab form** (`<WorkspaceNotesSection>`, `<workspace-notes-section>`), not just the bare filename — Vue renders unresolved tags as nothing, so `nuxt build` will NOT catch a missed consumer.
- `app/features/` is **not** auto-imported; import feature components/containers explicitly (`~/features/<f>/...`). `app/components/**` is auto-imported.
- Verify UI changes with: `yarn design:check` + `yarn design:boundaries` + `yarn build` (build catches compile/resolution, not unresolved-component-tags or visual regressions).

## Conventions

- Husky pre-commit runs `yarn design:check` + `yarn design:boundaries`. Conventional commits (commitlint).
- Excluded from design audits/gates: `*.old.vue`, `*.refactored.vue`, `pages/demo/**`, `pages/debug*`, `components/{debug,examples,landing}/**`.
- Keep changes small and reversible; prefer extending services/contracts over ad-hoc code.
