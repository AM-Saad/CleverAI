# Icon system

How Cognilo's icons are sourced, drawn, built, and given a house style.

## Where icons come from

| Group | Count | Source of truth |
|---|---|---|
| Lucide-derived | 174 | `lucide-vue-next`, copied **verbatim** by `yarn sync:lucide-icons` |
| Hand-authored | 19 | The `.svg` files themselves |
| AI variants | 6 | Composed at build time — no file on disk |

`app/assets/icons/*.svg` is the authored source. Two build steps consume it:

- `yarn generate:icons` → validates every icon, emits `app/utils/icons.generated.ts` (`ICON_NAMES`, `IconName`).
- `yarn build:icon-sprite` → emits `public/icons.svg` and `app/utils/icon-sprite.generated.ts`.

Both run via `yarn build:icons`, which is wired into `dev` and `build:inject`. `yarn icons:check` validates without writing and runs in pre-commit.

## The one rule

> **Never transform path data with a script.** Only presentation attributes, uniform transforms, or hand-authored geometry.

A conversion pass once tried to normalise path syntax and silently destroyed 156 of 161 icons: `chevron-down` went from `m6 9 6 6 6-6` to `M 6 9` (a single point, rendering nothing) and `M5 12h14` became `M 5 12 Q 12 13 19 12` (a bowed line). Browsers drop malformed paths without erroring, `<use>` means Vue never parses them, and neither `nuxt build` nor the design gates read path data.

`generate-icons.ts` now rejects `NaN`/`Infinity`, wrong command arity, and paths that only move the pen. That catches a repeat, but the rule above is the actual protection.

## Grammar

Everything is drawn on a **24×24 grid** with a ~2 unit margin, so the live area is about 20×20.

- **Stroke weight** — never declared on an icon. It comes from `--component-icon-stroke-width` (1.5), which inherits into the sprite's `<use>` shadow tree. Below ~18px `AppIcon` adds `.app-icon--dense`, stepping to `--component-icon-stroke-width-dense` (1.75) so small icons don't go faint.
- **Caps and joins** — always round.
- **Fill** — none. Every icon is a stroke drawing.
- **Colour** — `currentColor` only. Never a hardcoded value; theming works by inheriting `color`.
- **Corner radius** — 2 for containers (cards, documents, panels), 1 for small internal elements.
- **Density** — leave at least 1.5 units between parallel strokes. `grid.svg` was deleted for breaking this: nine 4.2 cells with 1.5 gaps merge into a solid block at any usable weight.

### Overriding the weight

An icon that declares its own `stroke-width` keeps it — a presentation attribute on the `<symbol>` beats the inherited value. Use this only when geometry genuinely demands it, and say why in a comment. Nothing currently needs it.

## The AI variant system

The sparkle is already this app's AI motif: it is among the most-used icons and is literally labelled "AI" in the note editor. `scripts/icon-manifest.ts` turns that habit into a system.

Any base listed in `AI_VARIANT_BASES` gets a generated `<base>-ai` companion: the base mark scaled to 0.72 anchored bottom-left, plus a fixed four-point sparkle in the corner it vacates.

```vue
<UiIcon name="file-text" />     <!-- a document -->
<UiIcon name="file-text-ai" />  <!-- an AI-written document -->
```

Two things make this safe and consistent:

- Composition is a **uniform transform over untouched geometry** — it obeys the one rule.
- The scaled group sets `stroke-width: calc(var(--component-icon-stroke-width) / 0.72)`, so the variant stays on the weight token instead of rendering 28% thinner. `var()` resolves through an external `<use>` shadow tree, which is what makes this work at all.

Add a base to `AI_VARIANT_BASES` and both the registry and the sprite pick it up. Keep the list to concepts where "AI-generated X" is a real product state. Check the result visually: the badge occupies roughly x 15–23, y 1–8, and a base with ink in that corner will crowd it — hand-author a dedicated variant instead.

## Adding an icon

1. Prefer an existing Lucide name — add the `.svg` and let `sync:lucide-icons` own it.
2. If it is genuinely custom, hand-author it to the grammar and add it to `CUSTOM` in `scripts/sync-lucide-icons.ts` so the sync never overwrites it.
3. Run `yarn build:icons`. The registry, the sprite, and the `IconName` type update together.

Use `UiIcon` at call sites — never `<Icon>` (Nuxt Icon) with a bare name like `"cloud"`. Without a collection prefix that resolves to nothing and renders an empty span, which is how seven icons ended up invisible.

## Why a sprite

`public/icons.svg` is one static file of `<symbol>`s referenced via `<use href="/icons.svg#name">`.

- One request for the whole set, versus ~194 lazy chunks or ~74KB of markup inlined into the entry bundle.
- `inject-sw.cjs` globs it into the service worker precache with a content revision, so it is served from Cache Storage with no network and only re-downloads when it actually changes — it survives deploys, which a content-hashed JS chunk does not.
- Nitro serves it `cache-control: public, max-age=0`, so the service worker is doing the caching, not the HTTP cache.

The tradeoff: host CSS cannot reach inside the shadow tree to style individual shapes. Inherited properties (`color`, `stroke-width`, `fill`) still pass through, which covers everything the grammar needs.
