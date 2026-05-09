# Materials Feature

Owns workspace material upload, material listing, speech capture inside material upload, and material-driven generation UI.

## Boundaries

- `components/*` owns material upload/list/generate UI.
- `composables/useGenerateFromMaterial.ts` owns material generation workflow state.
- Existing workspace hub component paths and `app/composables/materials/useGenerateFromMaterial.ts` remain compatibility wrappers.
- Feature internals import feature-local composables explicitly instead of using legacy wrappers.

## Manual QA

1. Upload a text or PDF material and confirm it appears in the workspace hub.
2. Generate flashcards and questions from a material through the existing UI.
3. Regenerate existing content and confirm replace/append behavior still follows the confirmation dialog.
