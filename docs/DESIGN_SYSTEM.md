# CleverAI Design System

## Summary

CleverAI uses a code-first token system. Raw visual values belong in `app/design-system/tokens/index.cjs`; generated CSS and TypeScript outputs are consumed by Tailwind v4, Nuxt UI, Vue components, and future tooling.

The first migration slice keeps the current visual language stable. It makes the token source strict, preserves old aliases for compatibility, and starts enforcement on migrated shared primitives.

## Token Layers

- **Primitive tokens** are raw values: brand colors, spacing, radius, typography, shadows, motion, and z-index.
- **Semantic tokens** describe product meaning: background, surface, content, border, primary, success, warning, error, and info.
- **Component tokens** describe reusable UI decisions: card radius, drawer shadow, toast shadow, input radius, editor surface, menu surface, and modal elevation.

Application code should prefer semantic or component tokens. Primitive tokens should only be referenced inside token definitions.

## Generated Outputs

- `app/design-system/tokens.generated.css` is generated for Tailwind v4 `@theme static` and global CSS variables.
- `app/design-system/tokens.generated.ts` is generated for TypeScript consumers and documentation tooling.
- Run `yarn design:tokens` after changing token source files.
- Run `yarn design:check` before opening a pull request.

Do not edit generated files manually.

## Usage Rules

- Use classes such as `bg-surface`, `text-content-on-surface`, `border-secondary`, and `text-error-text` in templates.
- Use vivid status fills/borders (`bg-error`, `border-warning`) for UI accents; use semantic status text tokens (`text-success-text`, `text-warning-text`, `text-error-text`, `text-info-text`) for readable text and icons.
- Use CSS variables such as `var(--radius-lg)`, `var(--shadow-dropdown)`, and `var(--space-4)` in style blocks.
- Do not add raw hex, `rgb(...)`, Tailwind palette classes, built-in shadow utilities, or built-in radius utilities to migrated files.
- `rounded-full` is reserved for avatars, status dots, and true pills.
- Legacy aliases such as `--spacing-md` remain during migration only.

## Component Checklist

Every shared component should define:

- default, hover, focus, active, disabled, loading, and error states.
- color usage through semantic tokens.
- radius through component or radius tokens.
- elevation only for hover/open/active states.
- keyboard focus styling through tokenized focus rings.
- text roles through existing typography primitives where practical.

## Interactive State Convention

Use the shared helpers from [app/components/ui/variants.ts](../app/components/ui/variants.ts) for primitive or raw-control work: `focusRing`, `inputFocusRing`, `interactiveTransition`, `pressedScale`, `disabledState`, and `neutralHover`.

| State | Convention |
|---|---|
| Default | Semantic surface/content/border tokens only. No raw palette classes. |
| Hover | Neutral secondary actions use `hover:bg-surface-subtle hover:text-content-on-surface`; primary/destructive actions use their semantic hover intent. Hover should clarify affordance without competing with selected/focus states. |
| Focus | Use one visible indicator per control. Fields replace their normal inset ring with `focus:ring-2 focus:ring-inset focus:ring-[var(--ds-focus-outline-color)]`. Buttons and button-like controls suppress framework rings and use a separated 2px tokenized outline. A global outline applies only to native controls without an explicit focus treatment. |
| Pressed | Button-like controls use `active:scale-[0.98]` with tokenized fast motion. Drag handles use cursor feedback (`active:cursor-grabbing`) instead of scale. |
| Selected / active | Use state semantics first: `aria-selected` for tabs, `aria-pressed` for toggles/tool buttons, `aria-current` for navigation. Soft selected visuals may use primary emphasis (`bg-primary/10`, `text-primary`, soft primary ring/border) but must not replace the focus ring. |
| Disabled | Native disabled/custom aria-disabled controls use `disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60` and the aria-disabled equivalents. Computed disabled-looking branches also use `opacity-60`. |
| Loading / busy | Buttons use their `loading` prop. Loading collections expose `aria-busy` and skeleton/empty/error states where practical. |

## Surface Taxonomy

| Surface | Use for | Avoid |
|---|---|---|
| `UiCard` | Discrete content objects: workspace cards, note cards, review cards, stat cards. | Structural app regions or large workspace panes. |
| `UiPanel` | Structural regions: settings groups, side panels, filter regions, workspace/board panes. | Clickable/selectable cards. |
| `UiInteractiveCard` | A single clickable/selectable content object with native keyboard behavior. | Nesting buttons/links inside; use row actions outside or an action menu pattern. |
| `UiOverlaySurface` | Visual shell for modal/drawer/popover/menu/toast/tooltip surfaces. | Creating overlay behavior; pair it with `UiModal`, `UiPopover`, `UiActionMenu`, drawer, or toast primitives. |

This distinction keeps hierarchy predictable: cards compete for content attention, panels structure the application, interactive cards are the one focus target, and overlays sit above the page in a z-index layer.

## Migration Order

1. Token source and generated outputs.
2. Nuxt UI theme configuration and shared primitives.
3. Notes surfaces.
4. Language Learning surfaces.
5. Board, Notifications, Subscription, and Materials.
6. Remove legacy aliases after usage is gone.

## Audit Tooling

- `yarn design:audit` scans every product `.vue` file ([scripts/audit-design-usage.cjs](../scripts/audit-design-usage.cjs)) and writes `docs/design-audit/{audit.json,audit.md,summary.md}`.
  - `audit.md` — full component → value map (one section per file, every color/spacing/radius/shadow/typography value tagged ✅ ok / ❌ violation / ⚠️ review / 🕒 legacy).
  - `summary.md` — rollups by category + top offenders + a distinct raw-value histogram with suggested target tokens.
- `yarn design:states` enforces high-risk interactive-state drift: tokenized focus rings, `active:scale-[0.98]` pressed feedback, and `opacity-60` disabled treatment.
- `yarn design:primitives` verifies the complete interactive contract: 36 button tone/variant combinations, five field variants, wrapper state APIs, and the living catalog matrices.
- Excluded from the audit: `*.old.vue`, `*.refactored.vue`, `pages/demo/**`, `pages/debug*`, `components/{debug,examples,landing}/**`.
- The scanner masks token references (`var(--…)`, token utility classes, `--token` identifiers in JS like `designTokenValues["--color-accent-blue"]`) before scanning for raw values, and does not flag `rounded-full` / `rounded-[var(…)]`. Code that needs literal color values at runtime (canvas swatches, `<input type=color>`) should read them from `designTokenValues` (generated TS), not hardcode hex.
- True baseline (220 files): **~324 violations**; after the proof-slice migration below, **226 across 67 files**.

### Migration progress

- **Complete — all product `.vue` files at 0 violations** (220 scanned, 20 excluded). Migrated across `ui/`, `shared/`, and every feature (Notes, Board, Review, Language-Learning, Materials, Workspace, Notifications), all pages, layout, and shared components. TiptapEditor's code-syntax theme uses the `--syntax-*` group; canvas/note swatches read literal values from `designTokenValues` (generated TS).
- **Remaining is review-only (~246 items):** off-grid spacing (`p-5`, `py-1.5`), `rounded-full` (valid for pills/avatars/dots), and decorative `rgba()` / inline glass effects. These are not enforced — address opportunistically.
- Legacy `--margin-*/--padding-*/--spacing-*` aliases have been **retired** (all usage moved to `--space-*`).

## Workflow & Enforcement

**Changing a token:** edit only [app/design-system/tokens/index.cjs](../app/design-system/tokens/index.cjs), then run `yarn design:tokens` to regenerate `tokens.generated.{css,ts}`. Never hand-edit the generated files. `themeTokens` entries become Tailwind utilities (`bg-…`, `text-…`, gradient `from-/to-…`) **and** `var(--…)`; `rootTokens` are plain `:root` CSS vars (e.g. `--syntax-*`, `--ds-*`, `--component-*`).

**Adding a swatch/data color in `<script>`:** import `{ designTokenValues }` (and `type DesignTokenName`) from `~/design-system/tokens.generated` and index it — e.g. `designTokenValues['--color-accent-blue']`. Do not hardcode hex or compose it from channels, and never reference a locally-declared `const` inside `defineProps`/`withDefaults` (it won't compile — reference the import directly).

**Enforcement (`yarn design:check`):** fails on hard violations — raw hex, Tailwind palette classes (`text-gray-500`), raw `black`/`white` classes, and built-in `rounded-*`/`shadow-*` — across every product `.vue` plus `app.config.ts` and `main.css`. It shares its detection with the audit ([scripts/audit-design-usage.cjs](../scripts/audit-design-usage.cjs)), so the two never drift. Runs in the `design-check` CI job (PRs to `main`, which also fails if `tokens.generated.*` is stale) and as a Husky `pre-commit` hook.

**Interactive-state enforcement (`yarn design:states`):** fails on old translucent focus rings (`focus:ring-primary/30`, `focus:ring-error/30`, etc.), positive focus-ring offsets that make controls look over-framed, non-canonical pressed scales (`active:scale-95`, `active:scale-90`, etc.), and disabled opacity values other than `60`. It intentionally does not ban soft selected/hover primary rings, because those are not keyboard focus indicators. This runs in the Husky pre-commit hook alongside `design:check` and `design:boundaries`.

**Primitive coverage (`yarn design:primitives`):** fails if a supported Button tone/variant combination loses its explicit theme entry, a form primitive drops a required state prop, or the `/design-system` catalog loses a state matrix. This keeps “wrapped by Ui*” from being mistaken for fully governed behavior.

**Escape hatch:** for a justified exception (a brand logo's exact hex, a third-party widget), add a `design-allow` comment on the offending line, or `design-allow-file` anywhere in the file to exempt it. Use sparingly, with a reason.

## Token Reconciliation Decisions

Decisions taken from the `summary.md` histogram. Most raw values map to existing tokens; two new token groups were added.

### Direct maps to existing tokens

| Raw value(s) | Token | Notes |
|---|---|---|
| `#10b981`, `#22c55e`, `#34d399`, `#059669`, `#42b983` | `success` | Snap greens to the single success token |
| `#ef4444`, `#dc2626`, `#eb4034`, `#F43434` | `error` | Snap reds to error |
| `#f59e0b`, `#fbbf24`, `#eab308` | `warning` | Snap ambers/yellows to warning |
| `#06b6d4` cyan-as-info contexts | `info` | Only when used for informational status (else accent-teal) |
| `#333333` | `content-on-background` / `content-on-surface-strong` | Per context (page vs surface) |
| `#6b7280`, `#64748b`, `#94a3b8`, `#999`, `#8b92a8` (UI) | `content-secondary` | Mid-grays → metadata text |
| `#9ca3af`, `#ccc`, `#cbd5e1` | `content-disabled` | Placeholder/disabled |
| `#e2e8f0`, `#e5e7eb` | `secondary` | Borders/dividers (≈ `#e7e9ec`) |
| `#f8fafc`, `#f1f5f9`, `#f8f9fa`, `#f3f3f3`, `#f0f9ff`, `#F1F1F1`, `#ededed` | `surface-subtle` / `surface` | Light fills → off-white surfaces |
| `#1e293b`, `#334155` | `content-on-background` | Dark slate text → primary text |
| `#fff`, `#ffffff` | `on-primary` / `white` | On-primary fills vs raw white containers (prefer a surface token) |
| `text-gray-*`, `text-slate-*` | `text-content-*` | Palette text → content tokens |
| `bg-gray-*`, `bg-neutral-*`, `bg-slate-*` | `bg-surface*` | Palette surfaces → surface tokens |
| `border-gray-*` | `border-secondary` | |
| built-in `rounded-{sm,md,lg,xl,2xl,3xl}` | `rounded-[var(--radius-*)]` | sm→sm, md→md, lg→lg, xl→xl, 2xl/3xl→2xl |
| built-in `shadow-{sm,md,lg,xl,2xl,inner}` | `shadow-[var(--shadow-*)]` | sm/md→dropdown, lg/xl/2xl→modal/card-hover by context |

### New token group: accent palette (added to `index.cjs`)

Decorative gradient/hero colors and user-pickable note/board swatches — **not** interactive-state colors.

| Token | Value | Snaps in |
|---|---|---|
| `--color-accent-blue` | `#3b82f6` | `#60a5fa`, `#93c5fd`, `#93bbfd`, `#4285F4`, `#82aaff`(UI) |
| `--color-accent-indigo` | `#6366f1` | `#384998`-adjacent decorative only |
| `--color-accent-purple` | `#8b5cf6` | `#a78bfa`, `#9154E7`, `#c792ea`(UI) |
| `--color-accent-pink` | `#ec4899` | |
| `--color-accent-rose` | `#f43f5e` | `#ff5370`(UI) |
| `--color-accent-teal` | `#06b6d4` | `#40D9C6` |
| `--color-accent-cyan` | `#00e2ff` | `#0cdcf7` |
| `--color-accent-orange` | `#f97316` | `#fe9548` |

Usage: `bg-accent-blue`, `text-accent-purple`, or `var(--color-accent-*)` in gradients. The brand gradient stays in `--ds-brand-gradient`.

### New token group: code-editor syntax theme (added to `index.cjs`)

Material-Palenight family, scoped to the rich-text/code editor only. Referenced as `var(--syntax-*)` in component `<style>` blocks (not Tailwind utilities).

`--syntax-bg`, `--syntax-bg-inline`, `--syntax-text`, `--syntax-muted`, `--syntax-comment`, `--syntax-keyword`, `--syntax-string`, `--syntax-number`, `--syntax-function`, `--syntax-type`, `--syntax-tag`, `--syntax-deletion`, `--syntax-invalid`.

### Review-only (not auto-migrated)

- Off-grid spacing (`p-5`, `py-1.5`, `gap-5`) and arbitrary `[..px]` — fix case-by-case toward the 4px grid during migration.
- `rounded-full` — keep only on avatars, tier pills, and status dots.
- Raw `rgba()` in editor/glass effects — convert to `color-mix()` over a token, or whitelist with `// design-allow`.
- `bg-[var(--color-white)]` slots in [app/app.config.ts](../app/app.config.ts) — replaced with surface tokens.
