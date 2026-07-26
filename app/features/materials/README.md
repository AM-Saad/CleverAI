# Materials Feature

Owns material generation workflow state and generated-content presentation for
a specific material. Upload and listing UI live directly in the page layer.

## Boundaries

- `composables/useGenerateFromMaterial.ts` owns material generation workflow
  state (flashcards/quiz generation, existing-content check, and the
  replace/append regeneration confirmation flow). Used directly by
  `app/pages/materials/[id].vue`.
- `components/MaterialStudyContent.vue` presents material-scoped flashcards and
  quiz questions. Flashcards reuse the restored
  `app/components/ui/CardStack.vue` swipe/swap interaction and
  `app/components/ui/flip-card/FlipCard.vue` primitive; quiz choices reveal
  immediate answer feedback.
- `app/pages/materials/index.vue` implements upload (native file input) and
  listing UI inline — no dedicated feature component. There is no speech/mic
  capture in the upload flow (that claim in the old README was stale).
- `app/composables/materials/useGenerateFromMaterial.ts` remains a
  compatibility wrapper.

## Manual QA

1. Upload a text or PDF material from `/materials` and confirm it appears in
   the materials list, then navigates to `/materials/[id]`.
2. Generate flashcards and questions from a material's detail page.
3. Regenerate existing content and confirm replace/append behavior still
   follows the confirmation dialog.
