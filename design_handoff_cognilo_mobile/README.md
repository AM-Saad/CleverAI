# Cognilo mobile design handoff

This directory is historical visual reference material. It is not a production implementation and is not authoritative for current tokens, component APIs, navigation, or product scope.

The canonical authored token source is [`../app/design-system/tokens/index.cjs`](../app/design-system/tokens/index.cjs), which composes the adjacent `foundations.cjs`, `semantic.cjs`, `components.cjs`, and `editor.cjs` layers. Generated production artifacts live under `app/design-system/` and must be regenerated with `yarn design:tokens`.

Retained reference files:

- `Cognilo Mobile - Hi-Fi.dc.html`: historical multi-module prototype.
- `support.js`: prototype runtime only; do not port it into the application.
- `screenshots/`: historical renders for visual comparison.

When the handoff conflicts with the live application contract, [`../app/DESIGN.md`](../app/DESIGN.md) and Daily's current rendered result take precedence.
