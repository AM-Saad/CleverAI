# Handoff: Cognilo Mobile (PWA) — Hi-Fi Redesign

## Overview
Cognilo (a.k.a. CleverAI) is an AI-powered learning app: rich-text notes, SM-2 spaced-repetition review, language learning, materials + AI generation, a kanban board, push notifications, and collaborative workspaces. This package is a **systematic high-fidelity redesign of the mobile PWA**, covering 9 modules end-to-end as left→right flows.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, layout, copy, and behavior. They are **not production code to copy directly**. The HTML uses a small in-house "Design Component" runtime (`support.js`) purely so the prototype renders; ignore that runtime.

Your task is to **recreate these designs in the target codebase's existing environment** (the real app is **Nuxt/Vue 3** with composables — see "Codebase context" below) using its established components, patterns, and libraries. If a styling system already exists, map the tokens below onto it rather than hard-coding. If no environment exists yet, pick the most appropriate framework and implement there.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and shadows are final and pulled from Cognilo's real design tokens (`tokens.generated.css`, included). Recreate the UI pixel-faithfully using the codebase's existing libraries. Treat the exact hex values, font weights, and pixel sizes in this README as authoritative.

> Note on scale: the prototype renders each screen inside a 278×600 device frame at the phone's native scale. Use the **relative** proportions and the token values; the device frame chrome (bezel, notch, status bar) is prototype scaffolding, not part of the app UI.

---

## Codebase context (from the real app)
- **Framework:** Nuxt 3 / Vue 3, composable-driven (`useNotesStore`, `useCardReview`, `useBoardItemsStore`, etc.).
- **Editor:** Tiptap v3 (headings, images, lists, text style).
- **Local-first:** IndexedDB (`cognilo-ai-db`) + Workbox service worker; background sync tags `notes-sync` / `form-sync`. Optimistic UI everywhere.
- **Math:** KaTeX (render) + mathjs (eval); handwriting/OCR via on-device HF transformers worker with MyScript fallback.
- **AI generation:** LLM gateway (`POST /api/llm.gateway`) with smart routing, semantic caching, per-user rate limit 5 req/min, FREE-tier quota of 10 generations.
- **Collab:** live presence via Yjs in shared workspaces.
- **Auth:** NextAuth (credentials + WebAuthn passkeys).

Implement against these real composables/endpoints — the screens below are the UI layer over them.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| primary | `#384998` | CTAs, active states, focus, accents |
| primary-hover | `color-mix(in srgb, black 10%, #384998)` | hover |
| primary-active | `color-mix(in srgb, black 18%, #384998)` | pressed |
| success | `#10b981` (text on light: `#047857`) | saved / correct / done |
| warning | `#f59e0b` (text: `#92400e`) | due-soon, quota |
| error | `#ef4444` (text: `#b91c1c`) | destructive, "Again" |
| info | `#00c7e4` (text: `#0369a1`) | informational, math badge |
| **brand gradient** | `linear-gradient(90deg, rgb(49 165 217) 0%, rgb(248 54 145) 46%, rgb(255 184 0) 100%)` | **reward/celebration ONLY** (session summary, translation reveal, AI streaming, achievements) |

**Accent palette** (stable per-entity colors — note spines, saved words, tags): blue `#3b82f6`, indigo `#6366f1`, purple `#8b5cf6`, pink `#ec4899`, rose `#f43f5e`, teal `#06b6d4`, cyan `#00e2ff`, orange `#f97316`.

**Neutrals:** page bg `#fafafa`; canvas/overlay bg `#e4e5ea`; raised surface `#f0f0f2`; subtle `#f4f5f7`; pressed `#dddfe5`. Text: primary `#1b1c24` / `#22232b`, on-surface `#575257` (`#606771` secondary), muted `#8a8f99`, disabled `#6b7280`. Borders `#e7e9ec`, strong `#c7cbd2`. Device frame body `#15161b`.

**Translucent tints:** always `color-mix(in srgb, <token> N%, #fff)` — never raw hex. E.g. a success chip bg = `color-mix(in srgb, #10b981 12%, #fff)`.

A full **dark theme** exists in `tokens.generated.css` (`.dark` scope) — these mocks are light-mode; honor the existing dark tokens when implementing.

### Typography — **Saira** (Google Font, weights 300–800)
| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Display / hero number | 27–64px | 800 | -0.5 to -2px | 1.0–1.05 |
| Screen title (h1) | 24–26px | 800 | -0.6px | 1.1 |
| Section title | 16–19px | 700 | -0.3px | 1.2 |
| Body | 14–17px | 400 | 0 | 1.5–1.75 |
| Label / meta | 11–13px | 500–600 | 0–0.5px | 1.4 |
| Eyebrow (uppercase) | 10–12px | 600–700 | 1.5–3px | — |

### Radius
card `12px` · sheet/large `16–24px` · small `8px` · field/segment `10–12px` · pill/avatar `9999px`.

### Shadow
- card (resting): `0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)`
- elevated / hover: `0 8px 30px rgb(0 0 0 / 0.08)`
- modal/sheet: `0 -10px 40px rgba(0,0,0,0.2)` (bottom sheets) / `0 20px 60px rgb(0 0 0 / 0.15)`
- primary glow (on primary buttons): `0 4px 12px rgb(56 73 152 / 0.25)`
- device frame: `0 24px 50px rgba(20,22,40,0.26)` (prototype only)

### Spacing
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px. Screen gutters typically 16–20px; cards padded 12–18px.

### Motion
durations: fast `120ms`, normal `200ms`, slow `320ms`. Easing standard `cubic-bezier(0.2,0,0,1)`, emphasized `cubic-bezier(0.2,0,0,1.2)`. Touch targets ≥ 44px.

---

## Screens / Views

> Order matches the prototype; numbered chips `01`–`09`. Each module is one horizontal flow of phone screens.

### 01 · Shell & Home
- **Tab bar:** fixed bottom, 74px tall, white, top border `#e7e9ec`. Five items (Home / Notes / [center] / Review / Board), active = primary `#384998`, inactive = muted `#8a8f99`, 10px labels. **Center capture FAB**: 56px circle, primary gradient `linear-gradient(135deg,#384998,#5566c4)`, white `+`, raised −14px above the bar with a 4px `#fafafa` ring and glow shadow.
- **Home / Today hub:** greeting header (date in muted, "Evening, Maya" 27px/800) + streak badge (46px circle, `linear-gradient(135deg,#f59e0b,#f97316)`, white number).
  - **Due-now hero card:** 16px radius, bg `linear-gradient(150deg,#384998,#2c3a7d)`, decorative translucent circle top-right. Eyebrow "DUE NOW", big "12 cards" (30px/800 white), subtitle, white pill CTA "Start review ▸" (primary text).
  - **Stat row:** two white cards (Today +XP, Mastered count).
  - **Jump back in:** white rows, 38px rounded accent-tinted icon tile, title + meta, green "Local" pill.
- **Capture sheet:** bottom sheet over dimmed Home (`rgb(2 6 23 / 0.45)` scrim). Grab handle, "Capture" title, 2×2 grid of options (New note / Capture word / Upload / Ask AI) each with accent-tinted icon tile + title + subtitle, then a full-width pill "Hold to dictate a quick note…".

### 02 · Notes
- **List:** "Notes ▾" title + search circle. Persistent **sync bar** (green-tinted pill: dot + "All changes saved locally" + "2 syncing"). Grouped by workspace (collapsible "BIOLOGY 4"). Note rows = white card with a **5px colored left spine encoding type** (text=`#6366f1`, math=`#10b981`/info, canvas=`#f97316`), title, snippet, meta chips ("12 cards", "∑ math", "✎ canvas"), per-row "Local"/"synced" badge. Bottom-right 54px primary-gradient FAB.
- **Editor:** back-to-workspace, "● Local" + share + overflow. Title (26px/800), tag chips. Body 14.5px/1.75. **Selection → AI bubble**: dark `#1b1c24` rounded pill anchored at selection, segments "✦ Explain | Rewrite | → Cards". Selected text highlighted with primary tint + `inset 0 -2px 0 #384998` underline. Bottom format bar (B / I / U / ∑ / ≣ / ✎ / ✦).
- **AI result sheet:** bottom sheet, header chip (gradient ✦ tile) "AI · Generated cards", "From your selected passage · 3 cards", card list (Q / divider / A), footer "Edit" + primary "Add 3 to review".

### 03 · Review
- **Card front:** top progress row (✕ / progress bar primary fill / "4 / 12"). Centered card (18px radius, elevated shadow), eyebrow "FLASHCARD · BIOLOGY", question 25px/700 centered, bottom "Tap to reveal answer" pill.
- **Reveal + grade:** card shows QUESTION (muted) + divider + ANSWER (primary eyebrow, 21px/700). **SM-2 grade bar**: 4 equal tinted cards — Again (`#ef4444`, "<1m") / Hard (`#f59e0b`, "10m") / Good (`#10b981`, "1d") / Easy (`#384998`, "4d"). Intervals are real SM-2 outputs; wire to `useCardReview` grading.
- **Session summary** (only full-brand screen): bg `linear-gradient(165deg,#384998,#222a55)`, "SESSION COMPLETE" eyebrow, "+85" XP (64px/800), stat ribbon (Streak / Accuracy in glass cards), achievement ribbon with brand-gradient-tinted bg + medal tile, white "Done" button.

### 04 · Language
- **Capture/translate card:** search field pill ("aprender", "ES→EN"). Result card: word (28px/800) + part-of-speech chip, IPA + "◉ play", then a **brand-gradient band** with "ENGLISH / to learn" (the reward reveal), then EXAMPLE (source sentence with the word in primary + translation in muted). Save bar: star outline + primary "Save to word bank".
- **Story reader:** warm paper bg `#fbf8f3`, centered title/level/saved-word count. Story body 17px/2.0 with **saved words highlighted in their stable accent tints**. Tapping a word opens a dark **inline popover** (word, translation + IPA, "＋ Save" / "◉ Hear", caret). Bottom dark **read-aloud bar** (play, gradient progress, "0.9×" / time).
- **Word bank:** title + due count, primary due-strip CTA, rows with accent left-bar, word + gloss, due/interval/"mastered" badge. Feeds the same SM-2 queue as cards.

### 05 · Materials
- **Detail:** source meta (red "PDF" tile, filename, "14 pages · uploaded today"). "SOURCE PREVIEW" card with extracted text + skeleton lines. Stat row (Flashcards 18 / Quiz 6). **Persistent primary "✦ Generate from this"** button pinned bottom.
- **Generate sheet:** type toggle (Flashcards | Quiz, selected = primary), count slider ("12 cards", primary track + knob), difficulty segmented (Recall / **Balanced** / Exam), **inline quota** warning (amber-tinted, "1 of 8 free generations left" + "Go Pro"), primary "✦ Generate 12 cards".
- **Result:** "12 cards generated · Review before adding". First card shows **AI streaming shimmer** (brand-gradient bars animating) then settled Q/A cards with ✓. Footer "Discard" + primary "Add all to review". Never auto-adds — human review gate before entering review queue.

### 06 · Board
- **Column pager:** "Board" + "● Local". Tab strip (To do / Doing / Done with counts, active underlined primary). Cards = white, **color-coded tag pills** (reuse UserTag colors), title, meta. A card mid-drag shown rotated −2° with elevated shadow. Dashed "＋ Add a card". Bottom 3-segment position indicator.
- **Mini overview:** three mini columns side-by-side (tinted bg per column), compact cards with a color tag bar; Done cards struck-through + dimmed. Pinch-to-zoom mental model: pager for working a list, overview for moving cards between columns. Primary "＋ New card".

### 07 · Notifications
- **Lock-screen push:** dark gradient "lock screen" with large clock, then a frosted-glass notification: Cognilo "C" tile + "COGNILO" + "now", title "12 cards are due 🧠", body naming the **exact due count, streak at stake, and expected minutes**, actions "Review now" (white/primary) + "Snooze 1h". Deep-links into review.
- **Reminder prefs:** grouped setting cards. "Cards due" (toggle ON = primary, "Daily at 9:00"), "Notify when ≥ 5 cards due", "Time 09:00". "Quiet hours 22:00–08:00" (toggle). Timezone info chip ("Times follow your device timezone · Europe/Madrid"). Primary "Save preferences". Maps to `UserNotificationPreferences` (cardDueEnabled, cardDueTime, cardDueThreshold, quietHours*, timezone).

### 08 · Workspaces (flat — no nesting)
- **Switcher sheet:** "Workspaces · 3 of 5". Rows = rounded icon tile (initial on a per-space gradient), name, "128 cards · 12 due". Active row = primary border + tint + ✓. Shared spaces show **overlapping member avatars**. "all caught up" = green ✓ chip. Dashed "＋ New workspace".
- **Collab presence:** space header (gradient tile + name + "Shared · 3 members"). **Live presence card:** overlapping avatars + "Marco is editing now" + pulsing green dot (Yjs). "RECENT ACTIVITY" feed (avatar + action + timestamp). Footer "Invite" + primary "Open space".
- **Create flow:** Cancel / "New workspace" / Create. Large gradient icon preview + **color picker** (accent swatches, selected ringed). NAME field (focused: primary border + focus ring + caret). DESCRIPTION (optional) textarea. Collab info chip. Primary "Create workspace". Maps to `Workspace` model (title, description, color/metadata, order).

### 09 · Signature micro-interactions
Three **animated** hero peaks (live CSS in the prototype) + three **annotated stills**:
- **Swipe-to-grade (animated):** card tilts toward the swipe with a color trail (red AGAIN ← → green GOOD) and a ✓ badge fading in. Recommend: drag follows thumb, card rotates ~7°, bg trail interpolates red→green by direction/distance, release commits the grade.
- **3D card flip (animated):** reveal flips the card on Y axis (`perspective:1100px`, `transform-style:preserve-3d`, `backface-visibility:hidden`, back rotated 180° on the primary gradient). ~360ms emphasized easing.
- **Streak ring (animated):** SVG ring fills (`stroke-dashoffset` animation) on open; center streak number pulses at milestones.
- **Annotated stills:** AI streaming shimmer (gradient sweep instead of spinner — see module 05); capture FAB morph (center + scales and its edges melt into the sheet's rounded top — shared-element transition); save-local pulse (green sync dot ripples once on each IndexedDB persist).

---

## Interactions & Behavior
- **Local-first everywhere:** optimistic writes, IndexedDB persistence, background sync; surface state honestly (persistent "saved locally" bar, per-item Local/synced badges, save-pulse). Never block UI on the network.
- **AI is selection-anchored**, never a detached chat: select text in the editor → AI bubble → output lands as real review cards. Generation always shows quota before committing and is human-reviewed before entering the SM-2 queue.
- **Review grading:** 4 buttons → SM-2 quality grades; show real next intervals; submit via the transactional/idempotent grade endpoint (`requestId` to prevent double-grade).
- **Navigation:** tab bar (5 modules); center + opens capture sheet from any tab; push notifications deep-link into review.
- **Sheets:** bottom sheets over a `rgb(2 6 23 / 0.45)` scrim with a grab handle; dismiss on backdrop tap / swipe down.
- **Reward gating:** the brand gradient appears ONLY at reward/celebration moments (session summary, translation reveal, AI streaming, achievements). Primary `#384998` carries everything else.

## State Management (map to existing composables)
- Notes: `useNotesStore(workspaceId)` — notes, loading, create/update/delete/reorder/sync.
- Review: `useCardReview` (queue + grade), `useSessionSummary`, `useSessionTimer`, `useReviewStats`.
- Board: `useBoardColumnsStore`, `useBoardItemsStore`, `useUserTagsStore`.
- Workspaces: workspace list/active + member presence (Yjs).
- AI: gateway calls with streaming UI; quota from `GET /api/subscription/status`.
- Notifications: `UserNotificationPreferences` GET/PUT.

## Design Tokens file
`tokens.generated.css` is included — it is the **source of truth** (light + dark, including `--ds-brand-gradient`, shadows, radii, spacing, z-index, syntax colors). Prefer wiring these variables over hard-coded hex.

## Assets
- **Font:** Saira (Google Fonts, 300–800).
- **Icons:** the prototype uses Unicode glyph placeholders (⌂ ▤ ◆ ▦ ✎ ✦ ⚯ ⇪ ∑ ≣ ⌕ ★ ◉). **Replace with the codebase's real icon set** — do not ship the glyphs.
- **Imagery:** none required; PDF/source previews are skeleton placeholders.
- No raster assets to extract.

## Files in this bundle
- `Cognilo Mobile - Hi-Fi.dc.html` — the full 9-module hi-fi prototype (open in a browser to inspect live; the three module-09 animations run on load).
- `support.js` — prototype runtime only; **do not port**.
- `tokens.generated.css` — real design tokens (authoritative).
- `screenshots/01–09-module.png` — one render per module (right-most phone may be cropped; the HTML is the full reference).
