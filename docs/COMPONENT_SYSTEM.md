# Component system

Tokens define visual decisions; components define ownership and behavior. The inventory, duplication, and reachability reports are generated with `yarn design:components` under `docs/component-audit/`.

## Layers

| Layer                 | Location                                  | Responsibility                                                                                       |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Primitive             | `app/components/ui/`                      | Standalone, feature-agnostic controls and surfaces. May wrap Nuxt UI and lower-level utilities only. |
| Pattern               | `app/components/patterns/`                | Reusable compositions of multiple primitives, such as `AppPageHeader`.                               |
| Feature presentation  | `app/features/*/components/`              | Controlled rendering for one feature; receives display-ready data and emits user intent.             |
| Feature orchestration | `app/features/*/containers/`, composables | Stores, repositories, mutations, optimistic state, synchronization, and workflows.                   |
| Page/layout           | `app/pages/`, `app/layouts/`              | Routing, validation, and high-level composition.                                                     |

A primitive never imports from shared components, patterns, pages, or features. Feature presentation does not own repositories or mutations.

## Canonical vocabularies

- `ActionTone = primary | neutral | error` for buttons and confirmation actions.
- `SemanticTone = primary | neutral | success | warning | error | info` for badges, alerts, progress, and status.
- `ControlSize = xs | sm | md | lg`.

Deprecated wrapper `color` props, the secondary action tone, pill buttons, field appearance variants, and arbitrary field/control tones are not supported.

## Surface selection

- `UiCard`: discrete, non-interactive content object.
- `UiPanel`: structural region.
- `UiInteractiveCard`: one clickable/selectable object with no nested independent controls.
- `UiItemCard`: repeated item with leading/kicker/title/badge/action anatomy.
- `UiListCard`: compact leading/title/description/trailing row.
- `UiModal`, `UiConfirmDialog`, `UiSheet`, `UiDrawer`: behavior-owning overlays built on the shared overlay surface.
- `UiSegmentedControl`: controlled, accessible mutually exclusive choice group.

Do not style arbitrary child buttons to create a segmented group, and do not create feature-specific modal scaffolds.

## Enforcement and reports

- `yarn design:boundaries` rejects new raw controls, direct Nuxt UI usage outside primitives, ad-hoc overlays, and hand-rolled card chrome beyond the audited baseline.
- `yarn design:primitives:unused` rejects standalone primitives without a live application consumer.
- `yarn design:components` regenerates component inventory, duplication candidates, cross-surface reachability, and orphan feature reports. Orphans are reported, not automatically deleted.
- `/design-system` renders only supported production variants and interaction states.

Native file inputs, range controls, editors, and canvases may use documented `design-allow` exceptions when a primitive would remove required browser or domain behavior.
