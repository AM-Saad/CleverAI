---
name: design-tokens-audit
description: "Enforce design token usage — find and replace raw hex colors, hardcoded px values, and inline styles that bypass the design system. Use when: auditing colors for raw hex violations, replacing #rrggbb or rgb() values with CSS variables, checking a component or page for hardcoded styles, enforcing token usage before a release, fixing color inconsistency, replacing hardcoded shadows or border radius with token values, design system compliance check."
argument-hint: "File or directory to audit (e.g. app/components/ui/UpgradeToPro.vue or app/components/)"
---

# Design Tokens Audit

Finds and replaces raw hex colors, hardcoded pixel values, and inline styles that bypass the design system. Enforces consistent use of CSS variables defined in `app/assets/css/main.css`.

## When to Use

- Before merging a feature — check for raw hex violations
- Auditing a specific component or the entire `app/` directory
- Fixing color inconsistencies noticed in visual review
- After adding a new page or component from a design tool (Figma copy-paste often introduces raw hex)

## Design Token Reference

**Source of truth:** [app/assets/css/main.css](../../app/assets/css/main.css) and [app/DESIGN.md](../../app/DESIGN.md)

### Color Tokens

| CSS Variable | Value | Usage |
|---|---|---|
| `--color-primary` | `#384998` | CTAs, active states, links |
| `--color-primary-light` | `#4a5db8` | Hover on primary |
| `--color-success` | `#10b981` | Positive feedback, completed states |
| `--color-warning` | `#f59e0b` | Caution states |
| `--color-error` | `#ef4444` | Errors, destructive actions |
| `--color-info` | `#00c7e4` | Informational states |
| `--color-background` | — | Page background |
| `--color-surface` | — | Card / panel background |
| `--color-surface-subtle` | — | Muted surface (e.g. code block bg) |
| `--color-surface-strong` | — | Elevated surface |
| `--color-content-on-background` | — | Primary text on page bg |
| `--color-content-on-surface` | — | Primary text on card/panel |
| `--color-content-secondary` | — | helper/subtitle text |
| `--color-content-disabled` | — | Disabled text |

**In Tailwind classes:** use `bg-[var(--color-surface)]`, `text-[var(--color-content-secondary)]`, `border-[var(--color-primary)]`

### Spacing Tokens (4px grid)

| CSS Variable | px value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |

Prefer Tailwind units (`p-4`, `gap-6`) over raw CSS variables for spacing — they map to the same 4px grid.

### Radius Tokens

| CSS Variable | Value | Usage |
|---|---|---|
| `--radius-sm` | 2px | Badges, tags |
| `--radius-md` | 4px | Inputs, small elements |
| `--radius-lg` | 6px | **Buttons, inputs** |
| `--radius-xl` | 8px | Larger elements |
| `--radius-2xl` | 12px | **Cards, modals, panels** |

In Tailwind: `rounded-[var(--radius-lg)]`, `rounded-[var(--radius-2xl)]`

### Shadow Tokens

| CSS Variable | Usage |
|---|---|
| `--shadow-card-hover` | Card on hover |
| `--shadow-dropdown` | Dropdown menus |
| `--shadow-modal` | Modals / dialogs |
| `--shadow-primary-glow` | Primary CTA glow effect |

Shadows are **only for interactive/elevated elements** — never apply to static surfaces.

## Procedure

### 1. Scan for Violations

Run the audit commands for the target file or directory:

```bash
# Raw hex colors in Tailwind class strings
grep -rn '#[0-9a-fA-F]\{3,8\}' app/components/ app/pages/ --include="*.vue" -l

# Detailed matches with line numbers
grep -rn '#[0-9a-fA-F]\{3,8\}' app/components/ app/pages/ --include="*.vue"

# rgb() / rgba() raw values
grep -rn 'rgb(' app/components/ app/pages/ --include="*.vue"

# Inline style with hardcoded colors
grep -rn ':style.*color.*#' app/components/ app/pages/ --include="*.vue"

# Hardcoded border-radius (not using var())
grep -rn 'border-radius:[^v]' app/assets/css/ app/components/ app/pages/ --include="*.vue" --include="*.css"
```

### 2. Triage Violations

For each violation, classify:

| Violation type | Fix strategy |
|---|---|
| Semantic color (primary, success, error, etc.) | Map to exact token variable |
| Surface / background color | Map to `--color-surface`, `--color-background`, etc. |
| Text color | Map to `--color-content-*` hierarchy |
| One-off decorative (gradient, illustration) | Flag — may be intentional; leave with `/* design-token-exempt */` comment |
| Third-party / dynamic color | Leave if generated at runtime; document why |

### 3. Apply Fixes

Replace raw hex with token variables. Common patterns:

```vue
<!-- ❌ Raw hex -->
<div class="bg-[#1e293b] text-[#64748b] border-[#e2e8f0]">

<!-- ✅ Tokens -->
<div class="bg-[var(--color-surface-strong)] text-[var(--color-content-secondary)] border-[var(--color-surface-subtle)]">
```

```vue
<!-- ❌ Inline style -->
<span :style="{ color: '#f59e0b' }">

<!-- ✅ Token -->
<span :style="{ color: 'var(--color-warning)' }">
```

```vue
<!-- ❌ Hardcoded radius -->
<div class="rounded-[8px]">

<!-- ✅ Token -->
<div class="rounded-[var(--radius-xl)]">
```

### 4. Known Violations in This Codebase

Prioritize these files — confirmed violations:

| File | Approximate violations | Notes |
|------|----------------------|-------|
| [app/pages/demo/ai-chat.vue](../../app/pages/demo/ai-chat.vue) | 18+ hex values | Demo page — still fix for consistency |
| [app/components/ui/UpgradeToPro.vue](../../app/components/ui/UpgradeToPro.vue) | 9 hex values | Sales-critical — fix carefully |
| [app/pages/pricing.vue](../../app/pages/pricing.vue) | ~2 hex values | Minor |
| [app/components/landing/GlowBorder.vue](../../app/components/landing/GlowBorder.vue) | 2 (#FFF in masks) | Intentional mask — flag as exempt |

### 5. Exemptions

Some raw values are acceptable. Add an inline comment to suppress future noise:

```vue
<!-- Gradient mask: no token equivalent — design-token-exempt -->
<div style="-webkit-mask: linear-gradient(to right, #FFF, transparent)">
```

Valid exemptions:
- SVG fill/stroke in inline illustrations
- CSS `mask` gradients (white/black are mask-specific, not semantic colors)
- Runtime-computed colors (e.g. user-defined tag colors from DB)

### 6. Verify

After replacing:
```bash
# Confirm no new violations in fixed files
grep -n '#[0-9a-fA-F]\{3,8\}' <file>

# Visual check — run dev and inspect on both light/dark mode if applicable
yarn dev
```

## Anti-Patterns

- Mapping hex to the *closest-looking* token rather than the *semantically correct* one (e.g. using `--color-primary-light` for a success hue just because it looks similar)
- Adding new CSS variables in component `<style>` blocks instead of `main.css`
- Suppressing violations with exemption comments without noting why

## Token Mapping Cheat-Sheet

| Common raw hex found | Likely token |
|---|---|
| `#384998`, `#4a5db8` | `--color-primary`, `--color-primary-light` |
| `#10b981` | `--color-success` |
| `#ef4444` | `--color-error` |
| `#f59e0b` | `--color-warning` |
| `#00c7e4` | `--color-info` |
| `#111827`, `#1e293b`, `#334155` | `--color-surface-strong` or `--color-content-on-background` |
| `#64748b`, `#6b7280` | `--color-content-secondary` |
| `#e2e8f0`, `#f3f4f6`, `#f1f5f9` | `--color-surface-subtle` or `--color-surface` |
| `#fff`, `#ffffff` | `--color-background` (or mask — check context) |
