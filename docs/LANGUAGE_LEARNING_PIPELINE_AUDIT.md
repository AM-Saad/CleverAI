# Language Learning Pipeline Audit and Repair

Date: 2026-07-19

## Outcome

Language capture, save, word-bank, preferences, enrollment, review, and stats
now have one frontend state owner: `LanguageLearningRuntime`. Both the global
capture sheet and `/language` use `useLanguageCapture` for capture and story
commands. Capture now means adding the lexical entry to the word bank.
Translation is an explicit option whose default is stored in
`translateOnCapture`.

This removes the most expensive failure mode: pressing Save no longer calls
translation a second time.

## What introduced the split

- `a22a9e0` introduced `LanguageLearningRuntime` and moved the feature toward
  application services and shared frontend state.
- `d761d83` introduced the redesigned mobile `/language` page and another
  workspace quick-capture modal.
- The new page implemented its own preferences, word list, stats, translate,
  save, story, enroll, and delete calls instead of consuming the runtime.
- Its Save action called `/api/language/translate` again with
  `translateOnly: false`. The second request could generate again, consume
  quota again, race the first translation, and create a second saved
  projection.
- The global capture sheet and workspace quick-capture control remained
  separate UI owners, so the same user intent could enter two state machines.

The architecture was understandable in isolation, but the active route did not
follow it. That is why reviewing only the runtime made the flow look correct
while the product behaved differently.

## Correct online capture flow

### Global capture

1. `CaptureSheet` opens the Word mode.
2. `QuickWordCapture` calls `useLanguageCapture.captureWord`.
3. The composable loads account-scoped preferences through
   `LanguageLearningRuntime`.
4. The translation checkbox initializes from `translateOnCapture`; changing it
   for the current capture does not change the saved default.
5. Capture calls `POST /api/language/translate` with `translateOnly: false`.
6. The server:
   - validates the command;
   - reuses only a source-language/context/translation-intent-safe lexical
     entry;
   - otherwise runs one lexical analysis and finalizes one quota event;
   - includes native-language translation fields only when checked;
   - saves the analyzed entry to the user's word bank in the same command.
7. Definition-only and translated cache identities are separate, preventing an
   unchecked capture from overwriting a translated lexical entry.
8. Capturing a translated version of an existing definition-only word enriches
   the existing bank row instead of creating a duplicate.
9. New word IDs remain deterministic. Concurrent
   clicks and retried requests converge on the same Mongo ObjectId.
10. If auto-enroll is enabled, the server upserts one language review and marks
    the word enrolled.
11. The runtime invalidates the word bank; the visible page refreshes through
    the same runtime.

### `/language` capture

The route now performs the same steps through `useLanguageCapture`. It no
longer owns a second API pipeline. It always passes the configured learned
language as the source and the native language as the optional translation
language.

### Story generation

1. Clicking a bank card opens the canonical word-detail `UiModal`; it never
   generates content.
2. The dialog shows the word, definitions, translation, examples, existing
   story, capture context, and learner-facing metadata.
3. Story generation occurs only after the user presses Generate story or
   Regenerate story.
4. It calls `POST /api/language/generate-story`.
5. The prompt requires all story fields to use the learned language, forbids a
   native-language copy, and confines the native language to glossary
   translations.
6. The server writes the story, updates the word, and advances offline revision
   state for both the word and its review when applicable.

## Correct offline flow

AI translation and story generation are deliberately unavailable offline. They
cannot be replayed safely as opaque HTTP requests because model availability,
quota, and rate-limit decisions must happen online.

The non-AI Language flows work from the downloaded account pack:

- Preferences load from `languagePreference` and updates queue a
  `languagePreference.update` mutation.
- Word-bank filters, story-only filtering, category counts, status counts, and
  stats are calculated from account-scoped IndexedDB records.
- Enrollment optimistically writes the complete word snapshot with
  `status: enrolled`, queues `languageWord.enroll`, and creates a provisional
  review projection.
- The provisional review ID is included in the enrollment command. The server
  returns an ID map to the canonical review ID and a complete related review.
- If that provisional review is graded before enrollment syncs, the grade
  explicitly depends on the enrollment mutation and uses the post-enrollment
  base revision. The server remaps the review ID before applying the grade.
- A grade is a sequenced audit mutation. Its local projection merges the full
  review record instead of replacing IndexedDB with scheduling fields only.
- Delete removes the word projection immediately. Server replay deletes the
  word and returns a related review tombstone.
- Enrollment and grade acknowledgements contain complete canonical records.
  Language-word snapshots include stories, preventing partial-response
  replacement.

## HTTP method map

The feature does not use POST for every action:

| Intent                             | Method and route                      |
| ---------------------------------- | ------------------------------------- |
| Capture and optionally translate   | `POST /api/language/translate`        |
| Save translated word               | `POST /api/language/words`            |
| Generate story                     | `POST /api/language/generate-story`   |
| Enroll word                        | `POST /api/language/words/:id/enroll` |
| Grade review                       | `POST /api/language/grade`            |
| List words/preferences/queue/stats | `GET`                                 |
| Update preferences                 | `PUT /api/language/preferences`       |
| Delete word                        | `DELETE /api/language/words/:id`      |
| Replay typed offline commands      | `POST /api/offline/sync`              |

`POST /api/offline/sync` is a transport for typed domain mutations. The
contained operation still distinguishes enroll, grade, update, and delete.

## Bugs and root causes repaired

### Save translated twice

Root cause: the active page implemented Save as another translate request.

Fix: `SaveLanguageWordDTO` and `POST /api/language/words` persist an existing
translation identity. No generation pipeline is reachable from this command.

Why correct: translation and persistence are different side effects with
different idempotency and billing rules.

### Concurrent saves could duplicate

Root cause: find-then-create alone has a race. Adding a nullable compound unique
index would break legacy users who have several words with no `translationId`.

Fix: new saved words use a deterministic 24-character Mongo ObjectId derived
from user and translation IDs. Duplicate creates converge without imposing an
unsafe nullable unique index on legacy data.

### Cache could cross the wrong source language or context

Root cause: an `auto` source lookup did not know the detected language, and
context was absent from translation identity.

Fix: automatic-source requests bypass pre-generation shared-cache selection.
Explicit-source cache identity includes a normalized context hash.

Why correct: cache reuse is allowed only when every semantic input in the
translation key is known.

### Missing translations silently became the source word

Root cause: the lexical parser substituted the input word for an absent
translation, making the caller's required-field check ineffective.

Fix: the parser returns an empty translation and the application service rejects
the incomplete LLM result before treating it as valid.

### Offline enroll and grade corrupted local projections

Root cause: enroll had no `localData`; grade wrote only scheduling fields; and
server acknowledgements returned partial canonical objects.

Fix: optimistic writes and acknowledgements now carry complete entities, with
related word/review updates and ID remapping.

### Offline grades were rejected by validation

Root cause: the client sent `requestId`, while the strict replay schema did not
accept it.

Fix: replay validation accepts the optional request identity. The durable
offline mutation ID remains the server idempotency key.

### Runtime leaked across accounts

Root cause: one module-global runtime retained preferences and captured results.

Fix: runtime instances are scoped to the Nuxt application and reset when the
verified account ID changes.

### Multiple quick-capture owners

Root cause: workspace mobile layout mounted its own Language FAB and modal in
addition to the global capture sheet.

Fix: the workspace-specific control was removed. The preference now controls
whether Word appears in the global capture menu.

### Word bank response failed Zod validation

Root cause: `GET /api/language/words` returned raw Prisma rows. Mongo optional
fields such as `sourceContext`, `meanings`, `examples`, and `partOfSpeech` are
represented as `null`, while the public response contract represents context
as optional and lexical collections as arrays. A normal context-free manual
capture therefore invalidated the complete bank response. The client also read
the obsolete Zod `errors` property instead of Zod 4's `issues`, hiding the
failing field path behind a generic error.

Fix: the list application service now normalizes nullable persistence fields at
the server boundary before returning the response. The fetch validator reports
the first issue path and message, and a realistic nullable Prisma-row regression
test validates the complete bank response contract.

### Review chrome and story audio were misleading

Root cause: `/language/review` was not classified as immersive, and StoryReader
displayed a fixed fake duration/progress value.

Fix: Language review hides global bottom chrome. The bespoke StoryReader was
replaced with the canonical word-detail `UiModal`, which uses the shared TTS
worker/fallback and exposes story generation only as a deliberate action.

## Why this boundary is the correct one

- One user intent has one command owner.
- Generation and persistence cannot accidentally bill each other.
- Online REST handlers and Offline V2 replay call the same application services
  for enroll and grade.
- Every server mutation advances the same offline revision space, including
  related word/review changes.
- IndexedDB receives full canonical records or tombstones, never ad-hoc partial
  response objects.
- Runtime state and durable records are account-scoped.
- Debouncing is used only for word-bank search. Capture, save, enroll, delete,
  and grade use single-flight/idempotency instead of timers.

## Deployment note

`LanguageTranslation.contextKey` changes the shared translation unique key.
Because this project uses Prisma with MongoDB, deploy the schema/index change
with the project's normal `db:sync` procedure before relying on contextual cache
reuse in production. The same sync adds the nullable, defaulted
`translateOnCapture` preference; serialization falls back to `true` for legacy
documents until they are updated.

## Confidence boundary

The deterministic tests cover parser failure, idempotent save, definition-only
enrichment, learned-language story prompts, account reset, and offline
enrollment projection. Unit, architecture, type, and service-worker checks
should remain required before release. A real authenticated browser test
covering capture → reload and offline enroll → reconnect → grade is
still the strongest remaining integration test.
