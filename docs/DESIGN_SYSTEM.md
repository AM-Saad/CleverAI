# Design-system architecture and enforcement

The visual rules are documented in [`app/DESIGN.md`](../app/DESIGN.md). This document describes how tokens are authored, generated, and verified.

## Authored token layers

`app/design-system/tokens/index.cjs` validates and composes four authored layers:

1. `foundations.cjs`: font, spacing, radius, typography, elevation, motion, targets, and z-index.
2. `semantic.cjs`: light semantic colors, dark overrides, status colors, and retained accents.
3. `components.cjs`: Nuxt UI bridges and genuinely shared component decisions.
4. `editor.cjs`: editor and syntax tokens.

Token names must be unique across layers. Dark entries may only override an existing light token. Generated files are never authored directly:

- `app/design-system/tokens.generated.css`
- `app/design-system/tokens.generated.ts`

Change an authored layer, run `yarn design:tokens`, and commit both generated outputs.

## Token reachability contract

`yarn design:tokens:check` renders generated output in memory and then verifies:

- committed generated artifacts are current;
- authored names do not collide;
- governed `var(--*)` references resolve;
- each authored token is reachable from product code, a supported Tailwind utility, TypeScript runtime access, another live token, or the external-contract allowlist;
- documentation and catalog-only references do not keep a dead token alive.

The checker understands token dependencies and mapped utilities such as `text-primary`, `tracking-tight`, and `leading-relaxed`. Nuxt UI `--ui-*` bridges and editor syntax variables are explicit external contracts.

## Usage rules

- Product code uses semantic/component tokens, not raw palette values.
- CSS uses `var(--space-*)`, `var(--radius-*)`, and tokenized shadows.
- Templates may use supported token-backed Tailwind utilities.
- A local custom property assigned and consumed in one component is a valid local contract.
- Generated files are excluded from formatting rewrites.

## Automated gates

- `design:tokens:check`: generation freshness and token contracts.
- `design:check`: raw design-value/style violations.
- `design:states`: interactive state conventions.
- `design:primitives`: supported primitive matrices and catalog coverage.
- `design:primitives:unused`: zero-consumer primitive rejection.
- `design:boundaries`: primitive/layer boundary drift.
- `design:contrast`: light/dark contrast.
- `arch:check`: application architecture boundaries.

These run in CI; the fast design gates also run in pre-commit.
