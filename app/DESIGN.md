# CleverAI Design System

> Source of truth: raw token values now live in `app/design-system/tokens/index.cjs`.
> `app/design-system/tokens.generated.css` and `app/design-system/tokens.generated.ts` are generated outputs. Do not edit generated token files by hand.

## Overview

A focused, intelligent interface for an AI-powered learning platform. The aesthetic is calm and trustworthy — clear information hierarchy, generous whitespace, and purposeful use of the brand navy. The mood is academic confidence: precise without being cold, engaging without being playful. Every surface and spacing decision reinforces the product's core promise — structured thinking and effortless review.

---

## Colors

### Brand
- **Primary** (`#384998`): CTA buttons, active states, focus rings, selected items, links — deep navy/indigo. Use only for interactive elements.
- **On-Primary** (`#ffffff`): Text and icons placed directly on primary-filled backgrounds.

### Semantic Feedback
- **Success** (`#10b981`): Enrolled status, completed reviews, streak achievements, positive confirmations — emerald.
- **Warning** (`#f59e0b`): Cards due soon, caution banners, partial completion states — amber.
- **Error** (`#ef4444`): Wrong answers, destructive confirmations, validation failures — red.
- **Info** (`#00c7e4`): New cards, informational callouts, neutral data highlights — cyan.

### Surfaces
- **Background** (`#fafafa`): Viewport/page background — near-white, warm.
- **Surface** (`#f2f2f2`): Raised surfaces — cards, panels, drawers. One level above Background.
- **Surface Subtle** (`#F1F3F5`): Hover state background for list rows and interactive surfaces.
- **Surface Strong** (`#e0e0e0`): Active/selected surface state and pressed backgrounds.

### Structure
- **Secondary** (`#e7e9ec`): Borders, dividers, input rings, chip backgrounds. Never use as a CTA color or text color.

### Text Hierarchy
- **Content On Background** (`#333333`): Primary text directly on page background — page headings and body copy.
- **Content On Surface** (`#575252`): Body text inside cards and panels — slightly warmer to read on off-white surfaces.
- **Content On Surface Strong** (`#333333`): Subheadings and emphasized text inside card surfaces.
- **Content Secondary** (`#6B7280`): Metadata, timestamps, supporting descriptions, captions.
- **Content Disabled** (`#9CA3AF`): Placeholder text, disabled UI copy.

---

## Typography

### Fonts
- **UI Font**: `"Saira", sans-serif` — loaded from Google Fonts. All UI text: headings, body, labels, captions.
- **Mono**: System mono stack — used for code blocks, card IDs, API keys, CLI output. Apply with `font-mono`.

> A distinct display font may be introduced later. Until then, Saira at varying weights (semibold for headings, normal/medium for body) provides the hierarchy contrast.

### Type Scale and Roles

Every text element in the product has exactly one role. Use the component and props that correspond to that role:

| Role | Tag | Size | Weight | Line Height | Letter Spacing | Color Token | Component |
|---|---|---|---|---|---|---|---|
| Page Hero | `h1` | `text-4xl` (36px) | bold | 1.1 | −0.04em | content-on-background | `<UiTitle size="4xl" weight="bold">` |
| Page Title | `h1` | `text-3xl` (30px) | semibold | 1.2 | −0.03em | content-on-background | `<UiTitle size="3xl">` |
| Section Heading | `h2` | `text-2xl` (24px) | semibold | 1.25 | −0.025em | content-on-background | `<UiTitle>` (default) |
| Card / Panel Heading | `h3` | `text-lg` (18px) | semibold | 1.375 | −0.01em | content-on-surface-strong | `<UiSubtitle weight="semibold">` |
| Subhead / Panel Label | `h4` | `text-base` (16px) | medium | 1.375 | 0 | content-on-surface | `<UiSubtitle size="base">` |
| Body Text | `p` | `text-sm` (14px) | normal | 1.625 | 0 | content-on-surface | `<UiParagraph>` (default) |
| Caption / Metadata | `p` | `text-xs` (12px) | normal | 1.5 | 0 | content-secondary | `<UiParagraph size="xs" color="content-secondary">` |
| Form Label | `label` | `text-sm` (14px) | medium | 1.5 | 0 | content-on-surface | `<UiLabel>` (default) |
| Overline / Tag | `span` | `text-xs` (12px) | medium | 1 | +0.08em | content-secondary | `<UiLabel size="sm">` + `class="uppercase tracking-widest"` |

### Typography Rules
- Headings at `2xl` and above automatically apply negative letter spacing (enforced by `UiTitle` component).
- Body text always uses `leading-relaxed` (1.625) — enforced by `UiParagraph` component.
- Never use `text-sm` responsively for body text. `text-sm` is body; `text-xs` is caption. Pick one per element.
- Never use more than two visual weight levels on a single screen section.
- Never render repeat-pattern headings as raw `<h1>`–`<h6>` — always use `<UiTitle>` or `<UiSubtitle>`.
- Never render body copy in a repeatable component as a raw `<p>` — always use `<UiParagraph>`.
- Code, IDs, and CLI text use `font-mono` class directly — no component wrapper needed.

---

## Elevation

Shadows are reserved for interactive state changes (hover, focus, open/active). Never apply shadows to static, non-interactive elements.

| Level | CSS Variable | Value | Use for |
|---|---|---|---|
| Flat | — | `none` | Static cards, panels, list rows |
| Hover Lift | `--shadow-card-hover` | `0 8px 30px rgba(0,0,0,0.08)` | Card hover — combine with `hover:-translate-y-0.5` |
| Dropdown | `--shadow-dropdown` | `0 4px 16px rgba(0,0,0,0.12)` | Menus, popovers, tooltips |
| Modal | `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.15)` | Modal dialogs, full-screen drawers |
| Primary Glow | `--shadow-primary-glow` | `0 4px 12px rgba(56,73,152,0.25)` | Primary button hover state only |

**Focus rings:** `ring-2 ring-primary/20` — 2px ring at 20% primary opacity. Never use `box-shadow` for focus.

**Navigation bar:** `backdrop-blur-sm border-b border-secondary` — blur conveys elevation; no shadow needed.

---

## Components

### `<UiTitle>` — Page and section headings
**Props:** `tag` (h1–h6, div), `size` (xs / sm / base / lg / xl / 2xl / 3xl / 4xl / 5xl), `weight` (light / normal / medium / semibold / bold), `color`, `center`.
**Defaults:** `tag="h2"`, `size="2xl"`, `weight="semibold"`, `color="content-on-background"`.
**Automatic behavior:** Applies `tracking-tight` for sizes `2xl`→`3xl`; `tracking-tighter` for `4xl`→`5xl`.

### `<UiSubtitle>` — Card and panel headings
**Props:** same color/size/weight system.
**Defaults:** `tag="h3"`, `size="lg"`, `weight="medium"`, `color="content-on-surface"`.
**Use for:** card titles, section sub-labels, collapsible panel headers.
**Do NOT use** for body descriptions — use `<UiParagraph>`.

### `<UiParagraph>` — Body text, descriptions, metadata
**Props:** `size` (xs / sm / base / lg), `color`, `weight`, `center`, `className`.
**Defaults:** `size="sm"`, `color="content-on-surface"`, `weight="normal"`.
**Automatic behavior:** Applies `leading-relaxed` for sizes `sm`, `base`, `lg`.
`size="xs"` is for captions and metadata — typically paired with `color="content-secondary"`.

### `<UiLabel>` — Form labels, small UI labels, overlines
**Props:** `tag` (span / label / p / div), `size` (sm / base / lg), `weight`, `color`.
**Defaults:** `tag="span"`, `size="base"` (text-sm), `weight="medium"`, `color="content-on-surface"`.
Use `tag="label"` in forms. Never use raw `<label class="...">` — always use `<UiLabel>`.

### `<UiCard>` — Content panels, cards, sections
**Props:** `variant` (default / outline / ghost), `size` (xs / sm / md / lg / xl), `shadow`, `hover` (none / lift / glow / scale), `tag`.
**Defaults:** `variant="outline"`, `size="md"`, `shadow="none"`, `hover="none"`.
Border: `1px solid var(--color-secondary)`. Radius: `var(--radius-2xl)` (12px).
Use `#header` slot for card titles. Header slot auto-applies bottom border divider.
Card content area background is **transparent** — the card's own surface color comes from its `variant`.

### `<UiButton>` — All interactive buttons (wraps Nuxt UI `UButton`)
A **4-variant emphasis ladder** — one style per importance tier, so a button's weight is always unambiguous:

| Variant | Emphasis | Use for |
|---------|----------|---------|
| `solid` | High | The one primary action / CTA in a section |
| `soft` | Medium | Secondary actions (tonal fill) |
| `ghost` | Low | Tertiary, toolbar, and icon actions |
| `link` | Inline | A text action inside prose |

> `outline` and `subtle` are **deprecated** — they now render as `soft`. Prefer `soft`.

**Tones — buttons are *actions*, so 4:** `primary` (default brand action), `neutral` (utility/cancel), `error` (destructive), `success` (positive confirm — sparingly). `warning`/`info` are **status** colors → use on `UiBadge`/`UiAlert`, not buttons. Set via the **`tone`** prop (canonical); `color` is a legacy bridge.

**Sizes:** `xs / sm / md / lg / xl`. **Defaults:** `tone="primary"`, `variant="solid"`, `size="md"`.

**States:** hover/active shift the fill (or `underline` for `link`); press adds `active:scale-[0.98]`; focus is a keyboard-only inset 2px outline (`--ds-focus-outline-color`), so it remains visible within scrolling and clipped containers; `disabled`/`loading` dim to 60% and block pointer events. Radius `var(--radius-lg)` (6px), set globally in `app.config.ts` — the single source for the matrix (rendered live at `/design-system`).

**Conventions:**
- Never place more than one `solid` button in the same view section.
- Icon-only → `<UiIconButton>`; toolbar → `<UiToolbarButton>`.

### `<Input>` / `<UInput>` — Text inputs
Ring at rest: `border-secondary`. Focus ring: `ring-primary/90`. Radius: `var(--radius-lg)`.
Label always uses `<UiLabel tag="label">`. Error text always `text-xs text-error`.

### Status Chips and Badges
Shape: `rounded-[var(--radius-md)]` (4px). Use `<UBadge>` with `color` set to `success`, `warning`, `error`, `info`, or `neutral`.
Pill shape (`rounded-full`) is reserved for: avatars, tier badge pills, and status indicator dots only.

---

## Spacing

4px base unit. All padding, margin, and gap values must land on the 4px grid.

| Tailwind | px | Use for |
|---|---|---|
| `gap-1 / p-1` | 4px | Icon-to-text gaps, micro spacing between tight elements |
| `gap-2 / p-2` | 8px | Chip padding, icon button hit areas, badge padding |
| `gap-3 / p-3` | 12px | Card padding sm, list-row internal padding |
| `gap-4 / p-4` | 16px | Card padding md (default), section sub-group separation |
| `gap-6 / p-6` | 24px | Card padding lg/xl, section internal padding |
| `gap-8 / p-8` | 32px | Section vertical spacing, between major blocks |
| `gap-12 / p-12` | 48px | Page section spacing |
| `gap-16 / p-16` | 64px | Hero and feature section gaps |

In `<style>` blocks, use the `--space-*` CSS variable tokens. In templates, prefer semantic Tailwind utilities generated from tokens. For migrated shared primitives, raw palette classes, raw hex/rgb values, unmanaged shadows, and unmanaged radius utilities are blocked by `yarn design:check`.

Never use `p-5` (20px), `m-7` (28px), `gap-5`, or other non-grid values unless a specific design requires it.

---

## Border Radius

| Token | Size | Use for |
|---|---|---|
| `--radius-sm` (2px) | Micro | Status indicator dots, progress bar fill |
| `--radius-md` (4px) | Chip | `UBadge`, tags, chips, inline code background |
| `--radius-lg` (6px) | Interactive | Buttons (`UButton`), inputs (`UInput`), selects, textareas |
| `--radius-xl` (8px) | Panel | Dropdown menus, tooltips, small popovers, metadata blocks |
| `--radius-2xl` (12px) | Card | `UiCard`, modals, dialogs, search bar container |
| `rounded-full` | Pill | Avatars, tier badge pills, status dots **only** |

Never use Tailwind's built-in `rounded-lg`, `rounded-xl`, `rounded-md`, `rounded-2xl` etc. directly.
Always reference the CSS variable: `rounded-[var(--radius-lg)]`.
Never apply `rounded-full` to buttons or text inputs.

---

## Do's and Don'ts

**Colors:**
- ✅ Use `--color-primary` only for interactive elements — never decorative text or static icons
- ✅ Use semantic tokens (`success`, `warning`, `error`, `info`) only for meaningful status
- ✅ Use `--color-content-secondary` for all metadata, timestamps, and supporting copy
- ✅ Use `--color-content-on-surface` for body text inside cards
- ✅ Use `--color-content-on-background` for body text directly on the page
- ❌ Never use raw Tailwind colors (`text-gray-500`, `bg-blue-50`, `border-gray-200`)
- ❌ Never use hex literals in class strings or inline styles
- ❌ Never use `--color-secondary` as a text color or CTA background

**Typography:**
- ✅ Use `<UiTitle>` for any repeated-pattern page or section heading
- ✅ Use `<UiParagraph>` for all description body text in repeatable components
- ✅ Use `<UiLabel tag="label">` for all form field labels
- ❌ Never render a repeatable heading as a raw `<h2 class="text-2xl ...">` — use `<UiTitle>`
- ❌ Never size body text responsively (`text-xs md:text-sm`) — body is always `text-sm`, caption is always `text-xs`
- ❌ Never mix more than two font weights in the same screen section

**Radius:**
- ✅ `var(--radius-lg)` (6px) for all buttons and inputs — always
- ✅ `var(--radius-2xl)` (12px) for all cards and modals — always
- ✅ `rounded-full` for avatars, tier badges, and status dots only
- ❌ Never use Tailwind radius utilities directly — always use the token variable
- ❌ Never apply `rounded-full` to buttons or text inputs

**Spacing:**
- ✅ Snap all spacing to the 4px grid
- ❌ Never use `p-5`, `m-7`, `gap-5`, or other off-grid values without justification

**Elevation:**
- ✅ Add shadow only on hover, active, or open states (cards, dropdowns, modals)
- ❌ Never add shadow to static, non-interactive elements
- ❌ Never use box-shadow for focus rings — use `ring-*` utilities
