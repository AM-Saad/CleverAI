# Cognilo

Cognilo is an AI-powered learning platform built with **Nuxt 4 + TypeScript**. It generates flashcards and quizzes from study materials using multiple LLM backends, and reinforces retention with spaced repetition (SM-2). The app runs as a PWA with full offline support.

---

## Features

| Area | Description |
|------|-------------|
| **Flashcards & Quizzes** | AI-generated from pasted text, uploaded PDFs, or URLs |
| **Spaced Repetition (SM-2)** | Optimal review scheduling for flashcards, materials, and questions |
| **XP & Gamification** | Experience points, achievements, streaks, daily targets |
| **Notes** | Rich-text local-first notes with IndexedDB persistence and background sync |
| **Materials Management** | Upload PDFs, paste URLs or text; auto-extract content for generation |
| **Kanban Board** | Drag-and-drop columns and items for task organization |
| **User Tags** | Color-coded tags for organizing board items |
| **On-Device AI** | Local math recognition, speech-to-text, text-to-speech, text summarization via web workers |
| **MyScript Integration** | Stroke-based handwriting math recognition (server-proxied API) |
| **Push Notifications** | Scheduled review reminders with quiet hours and snooze |
| **PWA & Offline** | Installable, full offline access via Workbox service worker |
| **Subscription & Quota** | FREE / PRO / ENTERPRISE tiers with generation limits |
| **Multiple LLM Backends** | OpenAI, Google Gemini, DeepSeek, Groq — smart routing by cost/latency/health |
| **Sharing & Public Links** | Share folders/files with other users or via public URL |
| **Passkey Authentication** | WebAuthn/passkey login alongside credentials |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | Nuxt 4, Vue 3 (Composition API), TypeScript 5 |
| **Styling** | TailwindCSS v4, shadcn-vue / Nuxt UI |
| **State** | Pinia, IndexedDB (offline) |
| **Editor** | Tiptap v3 (rich text), KaTeX (math rendering), mathjs |
| **Server** | Nitro (H3), Prisma 4.8, MongoDB |
| **Auth** | @sidebase/nuxt-auth (NextAuth.js), bcrypt, SimpleWebAuthn (passkeys) |
| **Caching** | Redis (rate limiting, semantic caching) — in-memory fallback |
| **Validation** | Zod 4 (shared contracts client + server) |
| **AI Providers** | OpenAI SDK, @google/generative-ai, DeepSeek API, Groq API |
| **On-Device AI** | @huggingface/transformers (web worker) |
| **PWA** | Workbox 7, web-push, Background Sync |
| **Testing** | Playwright |

---

## LLM Providers

Four provider strategies are implemented via the Strategy pattern:

| Provider | Strategy File | Models |
|----------|--------------|--------|
| **OpenAI** | `GPT35Strategy.ts` | gpt-3.5-turbo, gpt-4o-mini, gpt-4o |
| **Google** | `GeminiStrategy.ts` | gemini-2.0-flash-lite, gemini-1.5-flash-8b |
| **DeepSeek** | `DeepSeekStrategy.ts` | deepseek-chat, deepseek-reasoner |
| **Groq** | `GroqStrategy.ts` | llama-3.1-8b-instant, qwen-qwq-32b, llama-4-scout-17b |

Models are managed via the `LlmModelRegistry` database table. The gateway (`/api/llm.gateway`) selects the best model automatically using a scoring algorithm that weighs cost, latency, health, and capability.

---

## Development Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```
2. **Set environment variables** in `.env`:
   ```env
   DATABASE_URL=mongodb://username:password@host:port/dbname
   REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT
   OPENAI_API_KEY=your_openai_key
   GOOGLE_AI_API_KEY=your_google_ai_key
   DEEPSEEK_API_KEY=your_deepseek_key    # optional
   ```
3. **Sync database schema**:
   ```bash
   yarn db:sync     # prisma generate + db push
   yarn db:seed     # seed LLM pricing data
   ```
4. **Run the dev server**:
   ```bash
   yarn dev
   ```
5. **Build for production**:
   ```bash
   yarn build
   yarn start
   ```

### Key Scripts

| Script | Purpose |
|--------|---------|
| `yarn dev` | Build AI worker + start dev server on port 8080 |
| `yarn build:inject` | Build SW + AI worker + Nuxt production bundle |
| `yarn db:sync` | Generate Prisma client + push schema to MongoDB |
| `yarn db:seed` | Seed LLM pricing data |
| `yarn db:studio` | Open Prisma Studio GUI |
| `yarn typecheck` | Run TypeScript type checking |
| `yarn lint` | ESLint + Prettier check |
| `yarn test:pwa-offline` | Playwright PWA offline test |

> **Note**: MongoDB uses `@map("_id")` for IDs and `BigInt` for micro-dollar pricing fields. Use `yarn db:sync` instead of migrations — MongoDB ignores Prisma migrations.

---

## Rate Limiting

The `/api/llm.gateway` endpoint is protected by a rate limiter:

- **User**: 5 requests/minute (by `user.id`)
- **IP**: 20 requests/minute (by client IP)
- **Storage**: Redis primary, in-memory `Map` fallback
- **Headers**: `X-RateLimit-Remaining`, `X-RateLimit-Remaining-User`, `X-RateLimit-Remaining-IP`, `X-RateLimit-Reset`, `Retry-After`

---

## Documentation

Detailed documentation in `docs/`:

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, data model, module architecture |
| [FEATURES.md](./docs/FEATURES.md) | Detailed feature documentation |
| [LLM_GENERATION_FLOW.md](./docs/LLM_GENERATION_FLOW.md) | End-to-end LLM generation trace |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Testing, debugging, developer workflows |
| [MAINTENANCE.md](./docs/MAINTENANCE.md) | Known issues, tech debt, roadmap |
| [PWA.md](./docs/PWA.md) | PWA implementation and caching strategy |
| [SPACED_REPETITION.md](./docs/SPACED_REPETITION.md) | SM-2 algorithm details |
| [NOTIFICATIONS.md](./docs/NOTIFICATIONS.md) | Push notification system |
| [CRON_TIMING.md](./docs/CRON_TIMING.md) | Timezone-aware cron scheduling |

---

## Mock Mode

For testing without API costs:

```bash
# .env
OPENAI_MOCK=1
GEMINI_MOCK=1
DEEPSEEK_MOCK=1
```
