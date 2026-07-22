# Cognilo Visual Contract

This is the human-facing visual contract. Authored tokens live in the layered files under `app/design-system/tokens/`; `tokens.generated.css` and `tokens.generated.ts` are generated, read-only artifacts.

## Product direction

- Daily's current light and dark rendering is frozen. Refactors must preserve its spacing, typography, states, sheets, note editor, and interaction feedback.
- Learning, the launcher, and account use a minimal navy/neutral language: flat surfaces, compact cards, restrained borders, and no decorative gradients or static elevation.
- The application remains mobile-first in the shared 580px frame with the bottom app switcher.
- Workspace colors are identity accents only: small dots, icon foregrounds, or narrow markers.
- Success, warning, error, and info are reserved for meaningful feedback and state.

## Foundations

- UI font: `Saira`, with the system mono stack for code and identifiers.
- Light primary: `#051a39`.
- Dark primary: `#e8e9f2`.
- Primary text on a soft surface uses `--color-primary-soft`; never restore the retired `--color-primary-50` alias.
- Spacing uses the authored 4px grid through `--space-*` tokens.
- Card-family surfaces use `--component-card-radius`, which resolves to `--radius-lg`.
- Buttons and fields use `--radius-lg`.
- Sheets retain their dedicated top radius where required by Daily's visual contract.
- Static cards and panels are flat. Shadows communicate hover, open, floating, or modal state only.

## Color and emphasis

Page hierarchy is built from `--color-background`, `--color-surface`, `--color-surface-subtle`, `--color-secondary`, and `--color-primary`.

- One solid primary action is allowed per section.
- Neutral actions use the neutral tone; destructive actions use error.
- Status presentation uses semantic tones: primary, neutral, success, warning, error, or info.
- Large workspace/reward gradients and decorative accent cards are not part of Learning or account.
- Accent colors remain available for workspace identity, editor/canvas tools, and retained legacy features.

## Typography

Use `UiTitle`, `UiSubtitle`, `UiParagraph`, and `UiLabel` for reusable typography. Use token-backed `text-*`, `leading-*`, and `tracking-*` utilities when a small local text role does not warrant a component. Do not add raw palette colors or arbitrary font scales.

## Shared UI contracts

- `UiButton`: `ActionTone` (`primary | neutral | error`), variants `solid | soft | ghost | link`, sizes `xs | sm | md | lg`.
- Feedback components: `SemanticTone` (`primary | neutral | success | warning | error | info`).
- Fields have one outlined appearance; error styling is derived from the `error` state.
- `UiSegmentedControl` is the canonical controlled choice group and must expose radio semantics plus arrow/Home/End keyboard behavior.
- `UiPill` is reserved for real status, identity, and filter pills. Buttons are not pill-shaped.
- `AppPageHeader` is the shared Learning/account header. Daily keeps its specialized date header.

## State and accessibility rules

Interactive controls must provide visible keyboard focus, disabled and loading states, semantic labels, and at least the authored touch target. Modal/sheet focus is trapped, Escape dismisses when allowed, and reduced-motion preferences are respected. Do not nest independent controls inside a clickable row or card.

## Enforcement

Run:

```sh
yarn design:tokens:check
yarn design:check
yarn design:states
yarn design:primitives
yarn design:primitives:unused
yarn design:boundaries
yarn design:contrast
```

The internal `/design-system` route documents only supported production APIs and states.
