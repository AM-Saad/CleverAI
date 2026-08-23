# Cognilo

Cognilo is a Nuxt 4 learning platform with notes, materials, flashcards, quizzes, language learning, SM-2 review, and local-first PWA behavior.

## AI policy

All model inference goes through OpenRouter. There are no direct provider SDKs, browser model downloads, model registry, or local pricing catalog.

- Server adapter: `server/utils/llm/openRouter.ts`
- Request lifecycle: `server/utils/llm/llmRequestPipeline.ts`
- Usage audit: `server/utils/llm/usageLogger.ts` and Prisma `LlmUsage`
- Full audit and SOLID assessment: `docs/AI_AUDIT.md`
- Full flow and invariants: `docs/LLM_GENERATION_FLOW.md`

OpenRouter chooses the concrete model when `OPENROUTER_MODEL=openrouter/auto`. The returned concrete model and OpenRouter-reported cost are audit data; they are not application configuration.

## Setup

```bash
yarn install
cp .env.example .env
yarn db:sync
yarn dev
```

Required AI configuration:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_TIMEOUT_MS=45000
```

`REDIS_URL` is recommended in production for distributed rate limits. Without it, limits fall back to process memory.

## Commands

| Command                            | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `yarn dev`                         | Build icons and start Nuxt on port 8080               |
| `yarn build`                       | Build service worker, icons, client, and Nitro server |
| `yarn test:unit`                   | Run unit tests                                        |
| `yarn typecheck`                   | Run Nuxt TypeScript checks                            |
| `yarn db:sync`                     | Generate Prisma Client and push Mongo schema          |
| `yarn db:remove-legacy-ai`         | Dry-run legacy AI DB cleanup                          |
| `yarn db:remove-legacy-ai --apply` | Drop old model/pricing/gateway collections and fields |

The cleanup command is intentionally dry-run by default. Back up the database before using `--apply`.

## Main directories

- `app/`: Vue UI, composables, services, local-first client runtime
- `server/`: API routes and server modules
- `shared/`: Zod contracts and shared domain utilities
- `prisma/`: MongoDB schema
- `sw-src/`: service worker source
- `scripts/`: verification and maintenance commands
- `docs/`: detailed architecture and operating notes
