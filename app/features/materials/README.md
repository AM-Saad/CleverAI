# Materials Feature

Owns material generation workflow state and generated-content presentation for
a specific material. Upload and listing UI live directly in the page layer.

## Boundaries

- `composables/useGenerateFromMaterial.ts` owns material generation workflow
  state (flashcards/quiz generation, existing-content check, and the
  replace/append regeneration confirmation flow). Used directly by
  `app/pages/materials/[id].vue`.
- `components/MaterialStudyContent.vue` previews material-scoped flashcards and
  quiz questions, shows generated source evidence, and routes `Study now` into
  a material-filtered tracked review session. Flashcards reuse the restored
  `app/components/ui/CardStack.vue` swipe/swap interaction and
  `app/components/ui/flip-card/FlipCard.vue` primitive; quiz choices reveal
  immediate answer feedback.
- `app/pages/materials/index.vue` implements upload (native file input) and
  library UI inline — no dedicated feature component. Library rows use the
  lightweight `/api/materials/library` response with server search, type
  filtering, sorting, and cursor pagination. Full material content remains in
  the detail and offline-pack flows. There is no speech/mic capture in the
  upload flow (that claim in the old README was stale).
- `app/composables/materials/useGenerateFromMaterial.ts` remains a
  compatibility wrapper.

## Manual QA

1. Upload a text or PDF material from `/materials` and confirm it appears in
   the materials list, then navigates to `/materials/[id]`.
2. Search by title, filter each file type, sort by name, reset the view, and
   load another page when the workspace has more than 20 matching materials.
3. Open a row and its adjacent action menu using both pointer and keyboard;
   confirm Rename/Delete never navigate the row.
4. Generate flashcards and questions from a material's detail page.
5. Start `Study now` and confirm only that material's due items enter tracked review.
6. Regenerate existing content and confirm unchanged items retain review progress
   while removed items leave the active set.
