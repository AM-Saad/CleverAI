# Learning Paths — Specification & Architecture Decision Record

> Status: **Draft / Proposed** · Owner: Bodda · Last updated: 2026-06-20
>
> This document is the source of truth for the Learning Paths feature: what it is,
> why it exists, how it is built, and — critically — the constraints that keep it
> **extractable into a standalone application** at any time. Treat the extraction
> constraint (§4) as a hard requirement, not an aspiration.

---

## 1. Summary

Learning Paths turns "what does it mean to know X" into a **diagnostic skill graph**:
a domain (e.g. JavaScript, marketing, system design) is modelled as a set of
**skill atoms** connected by **directional, acyclic prerequisites**, each carrying an
editorial **importance** score and searchable **tags**.

The graph is not a course outline. It is the substrate for:

- **Diagnosis** — infer where a learner sits on the map from a handful of questions.
- **Personalized ordering** — never teach an atom before its prerequisites.
- **A retention surface** — a visible "constellation" with an explored core and an
  unexplored frontier.

The flagship domain (JavaScript) is **hand-curated** as code. Additional domains are
**AI-drafted, machine-validated, and human-light-reviewed**, then cached and shared.

---

## 2. Why this feature (business rationale)

The defensible asset is the **graph structure**, not the content. Flat course apps
store "Module 1, Module 2." A prerequisite DAG lets us diagnose, route, and visualize
in ways a flat list cannot. The product's edge is *"a mentor that knows what you don't
know yet,"* not *"AI can generate a course on any topic"* (a crowded 2026 claim).

Consequences that this spec deliberately encodes:

- **Depth beats breadth.** Curated quality is the bar; breadth is an expansion vector,
  never a substitute for the diagnostic + mentor loop.
- **The taxonomy is ~10% of the work.** The hard, valuable work is the questions per
  atom and the mentor feedback loop on top of the graph. Architecture must not let
  "we can generate any domain" masquerade as "the product is done."

---

## 3. Domain model

### 3.1 Skill Atom

An atom is **one teachable concept that fits in one question**.

| Field           | Type                          | Notes                                                            |
| --------------- | ----------------------------- | ---------------------------------------------------------------- |
| `slug`          | `string` (kebab-case, unique) | Stable identifier; referenced by prerequisites.                  |
| `name`          | `string`                      | Display name.                                                    |
| `category`      | `string`                      | Domain-defined grouping (e.g. fundamentals/logic/async).         |
| `importance`    | `int` 1–10                    | Editorial. See §5 importance scale.                              |
| `prerequisites` | `string[]` (slugs)            | Directional, acyclic. Must reference existing slugs.             |
| `tags`          | `string[]` (≥ 1)              | Searchable categories, not identity.                             |

### 3.2 Taxonomy

A taxonomy is a named set of atoms for one domain, plus lifecycle metadata:

- `domain` — the subject (e.g. `"javascript"`, `"marketing"`).
- `provenance` — `curated | ai-reviewed | ai-draft`.
- `status` — `draft | validated | published`.
- `version` — integer; taxonomies are versioned, never edited in place once published.

### 3.3 Learner progress

Per-user overlay on a taxonomy: which atoms are explored / mastered / unseen. Stored
keyed by `userId` (string) and `atomId` — **no hard relation into host-app tables**
(see §4.3).

---

## 4. Architecture Decision: extraction-first, hexagonal

### 4.1 Decision

Learning Paths is built as a **self-contained hexagonal module** under
`server/modules/learning-paths/`, following the existing `domain / application /
infrastructure / ports` convention already used by `ai-generation`. The module depends
only on **abstractions it owns** (ports). The host app depends on the module; the module
never depends on host-app concretes.

**Invariant:** the arrow of dependency points *into* the module, never out. `domain/`
and `application/` import from `ports/` only — never from `infrastructure/`, never from
frontend (`~/`, `@/`), never from a host concrete (Prisma client, `getLLMStrategy()`,
auth utilities, Pinia).

### 4.2 Why

We expect to one day lift this feature into its own standalone application. Designing
for that from commit #1 is nearly free if the seam is respected, and prohibitively
expensive to retrofit later. With the seam in place, extraction is:

> copy `domain/` + `application/` + `ports/` + the Zod contract + seeds **unchanged**,
> rewrite ~4 small adapter files and one composition root, paste the Prisma schema slice.

### 4.3 Hard rules (enforced, not aspirational)

1. **DB isolation.** Taxonomy / atom / progress models are a self-contained schema
   slice. They reference users/workspaces **by id (string) only** — no Prisma relations
   into unrelated host tables. A hard relation turns extraction into a data migration.
2. **No leakage through the contract.** The HTTP contract must not embed host-app types
   (no host `User`/`Workspace` objects). Pass `userId: string`.
3. **Ports own all I/O.** Every outside-world touchpoint (LLM, persistence, identity,
   events, cache) is a port interface defined inside the module.
4. **`arch:check` rule.** Add a boundary rule so the build fails if
   `learning-paths/{domain,application,ports}` imports `infrastructure/`, frontend
   aliases, or host concretes. The gate is what keeps the seam intact over time.

### 4.4 Module layout

```
server/modules/learning-paths/
├── domain/            # pure, portable: SkillAtom types, taxonomyGraph (DAG ops), validateTaxonomy
├── application/       # portable orchestration: requestTaxonomy, draftTaxonomyWithAI, promoteTaxonomy, getLearnerMap
├── ports/            # the seam: LLMPort, TaxonomyRepositoryPort, IdentityPort, EventBusPort, CachePort
├── infrastructure/    # adapters (the only throwaway code) + wire.ts composition root
├── taxonomies/
│   ├── seeds/         # curated taxonomies as code (e.g. javascript.ts)
│   └── validate.ts    # thin re-export of domain/validateTaxonomy for the seed pipeline
└── SPEC.md            # this file
```

### 4.5 Portability ledger

| Layer                              | On extraction day | Why                              |
| ---------------------------------- | ----------------- | -------------------------------- |
| `domain/`                          | Copy as-is        | Pure logic, no host imports      |
| `application/`                     | Copy as-is        | Calls ports only                 |
| `ports/`                           | Copy as-is        | Interfaces owned by the module   |
| `shared/.../learning-path.contract`| Copy as-is        | Self-contained Zod               |
| `taxonomies/seeds/*`               | Copy as-is        | Plain data                       |
| `app/features/learning-paths/` (UI)| Copy as-is        | Talks only to the HTTP contract  |
| `infrastructure/` adapters         | Rewrite (small)   | Re-point at new app's infra      |
| `wire.ts`                          | Rewrite (tiny)    | New composition root             |
| Prisma model slice                 | Copy the slice    | Per §4.3 it has no foreign reach |

---

## 5. Authoring principles

These govern both hand-curated seeds and AI-drafted taxonomies. They are the rules a
taxonomy file is judged against.

1. **Atom = one teachable concept that fits in one question.** If it needs two
   questions, it is two atoms; if it is "a question, not a concept," it is not an atom.
2. **Prerequisites are directional and acyclic.** The graph is a DAG rooted at the
   domain's entry-point atom(s).
3. **Importance is editorial** — *"how dangerous is it if you don't know this"* — **not
   statistical.** It encodes taste, the thing AI cannot yet do well and humans must own.
4. **Tags are searchable categories, not identity.** An atom is defined by its place in
   the graph, not its tags.

**Importance scale:**

```
10 — you cannot write the language/domain without this
 9 — you will produce buggy work without this
 8 — you will look junior without this
 7 — necessary for any real project
 6 — necessary for intermediate work
 5 — necessary for some real projects
 4 — useful, less common
 3 — specialist or edge-case
 2 — rarely needed, but distinctive when known
 1 — trivia
```

**Editorial flags in seed comments:** `[LOCKED]` (strong, defended decision — change only
with reasoning) · `[EDITORIAL]` (author should sanity-check).

---

## 6. The taxonomy contract (linchpin)

A single Zod contract at `shared/utils/learning-path.contract.ts` is **simultaneously**:

1. the **AI output schema** (what a drafting LLM must produce),
2. the **validation target**, and
3. the **HTTP API shape**.

One source of truth that travels with the feature on extraction. The contract must stay
free of host-app types (§4.3 rule 2).

---

## 7. Validation (the trust gate)

`domain/validateTaxonomy.ts` is a **pure function** `(seed) -> Result<Taxonomy, Issue[]>`.
Hand-curated seeds and AI drafts pass through the **same** gate — this is how generated
domains inherit the curated quality bar. Invariants checked:

- ✓ Atom count within the domain's declared bounds.
- ✓ Category distribution matches the declared shape (if declared).
- ✓ No cycles in prerequisites (valid DAG).
- ✓ Every prerequisite references an existing slug.
- ✓ No duplicate slugs.
- ✓ Importance ∈ [1, 10].
- ✓ Every atom has ≥ 1 tag.

> The curated JavaScript seed (50 atoms; 15/10/8/10/7 distribution) is the reference
> fixture for this validator.

---

## 8. Generation pipeline (draft → validate → promote → cache)

```
requestTaxonomy(domain)
  ├─ TaxonomyRepositoryPort.findPublished(domain) ── hit ──▶ return (shared, cached)
  └─ miss ─▶ draftTaxonomyWithAI(domain)
                LLMPort.generate(prompt + contract schema)
                  ▼
                LearningPathContract.parse(raw)        ← gate 1: shape (Zod)
                  ▼
                validateTaxonomy(seed)                 ← gate 2: DAG/slugs/importance/distribution
                  │  fail → repair loop: feed issues back to LLMPort (max N retries)
                  ▼
                persist as DRAFT  ──▶ human light-review ──▶ promoteTaxonomy() → published + cache
```

- **Reuse existing infrastructure.** Drafting is a heavy LLM call (a 50-atom DAG with
  sane prerequisites). Run it through the existing `ai-generation` async pattern and
  `GenerationCachePort`, so cost flows through `llmCost.ts` / `gatewayLogger.ts` and the
  user never blocks on a 30s spinner.
- **Tiered rollout, encoded in data** via `provenance` × `status`:
  - *Curated* — hand-authored seeds (flagship/wedge domains).
  - *AI-reviewed* — AI draft, validated, human-approved, cached. The deliberate long tail.
  - *AI-draft* — generated on demand for anything a user types; clearly labelled "beta";
    promotes to AI-reviewed if it gains traction.

---

## 9. Ports (the seam, enumerated)

| Port                      | Responsibility                              | Host adapter wraps              |
| ------------------------- | ------------------------------------------- | ------------------------------- |
| `LLMPort`                 | `generate(prompt) -> json`                  | `getLLMStrategy()` / LLMFactory |
| `TaxonomyRepositoryPort`  | load/save taxonomies, atoms, learner progress | Prisma                        |
| `IdentityPort`            | `currentUserId()`                           | host auth                       |
| `EventBusPort`            | `emit(domainEvent)`                         | `shared-kernel` DomainEventBus  |
| `CachePort`               | published-taxonomy + generation caching     | `GenerationCachePort` pattern   |

Adapters live in `infrastructure/`; `wire.ts` is the single composition root that builds
the application services from concrete adapters.

---

## 10. Frontend

The map/constellation UI lives in `app/features/learning-paths/` and consumes **only**
the HTTP contract via the existing `serviceFactory` + `FetchFactory` service layer. It
holds no host-app coupling beyond the contract, so it is portable as-is (§4.5). UI built
with `Ui*` primitives per the design system; no direct Nuxt UI `U*` usage.

---

## 11. Open decisions (product/ops, not architecture)

These can change later **without** a schema change, thanks to the `provenance`/`status`
fields:

1. **AI-drafting placement** — confirmed direction: async/background via the
   `ai-generation` pattern (not a blocking request).
2. **Who reviews drafts before `published`** — Bodda only at first? Expert per domain? A
   trust threshold (N learners + good outcomes auto-promote)? Unresolved; pick later.

---

## 12. Non-goals (v1)

- Not a flat course/LMS. The graph is the product, not a lesson sequence.
- Not runtime-regenerated per user. Published taxonomies are shared and cached.
- Not "infinite topics" as the headline. Breadth is expansion; depth + mentor is the pitch.

---

## 13. Invariants checklist (CI / review)

- [ ] `domain/`, `application/`, `ports/` import no `infrastructure/`, frontend alias, or
      host concrete (`arch:check`).
- [ ] Prisma taxonomy slice has no relations into unrelated host tables.
- [ ] The contract embeds no host-app types.
- [ ] Curated JS seed passes `validateTaxonomy` (reference fixture).
- [ ] Every taxonomy carries `provenance` + `status` + `version`.
