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

- Use classes such as `bg-surface`, `text-content-on-surface`, `border-secondary`, and `text-error` in templates.
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

## Migration Order

1. Token source and generated outputs.
2. Nuxt UI theme configuration and shared primitives.
3. Notes surfaces.
4. Language Learning surfaces.
5. Board, Notifications, Subscription, and Materials.
6. Remove legacy aliases after usage is gone.
