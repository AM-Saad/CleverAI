# Cognilo Architecture

> **This file has been consolidated. See the comprehensive documentation in `docs/`.**

---

## Documentation Structure

All technical documentation has been consolidated into `docs/`:

| Document | Purpose |
|----------|---------|
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | System design, data model, module architecture |
| **[docs/architecture/app-surfaces.md](./docs/architecture/app-surfaces.md)** | Platform/Daily/Learning deployable-surface split |
| **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** | Setup, commands, debugging, contribution guide |
| **[docs/FEATURES.md](./docs/FEATURES.md)** | Detailed feature documentation (Notes, SR, LLM, PWA) |
| **[docs/MAINTENANCE.md](./docs/MAINTENANCE.md)** | Known issues, tech debt, security, roadmap |
| **[docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** | Design tokens: authoring, generation, enforcement gates |
| **[docs/COMPONENT_SYSTEM.md](./docs/COMPONENT_SYSTEM.md)** | Component layers, primitives, boundary enforcement |

---

## Quick Links

### For New Developers
1. Start with [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for setup
2. Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system overview
3. Consult [FEATURES.md](./docs/FEATURES.md) for specific features

### For Code Review
1. Check [MAINTENANCE.md](./docs/MAINTENANCE.md) for known issues
2. Review [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design patterns

### For Operations
1. See [MAINTENANCE.md](./docs/MAINTENANCE.md) for operations guide
2. Check [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for commands

---

## High-Level Overview

Cognilo is a **Nuxt 4** application providing AI-powered flashcard generation and spaced repetition learning.

### Tech Stack
- **Frontend**: Nuxt 4 (`compatibilityVersion: 4`, `srcDir: app/`), Vue 3.5, TypeScript, Tailwind CSS v4 + Nuxt UI v4, Pinia
- **Backend**: Nitro, Prisma, MongoDB, Redis (optional)
- **AI**: OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter (pluggable strategy pattern)
- **PWA**: Workbox/custom SW, IndexedDB, Web Push
- **Realtime collab**: Hocuspocus + Yjs (per-note collaboration rooms)
- **Deployment**: single process by default, or split into independently-deployable `platform`/`daily`/`learning` Nitro surfaces via `APP_SURFACE`

### Key Architecture Patterns
- **Strategy Pattern**: Pluggable LLM providers
- **Local-First**: IndexedDB + background sync for notes
- **Domain-Driven Design**: SR business logic isolation
- **Result Pattern**: FetchFactory error handling

### Project Structure
```
app/           # Nuxt frontend (srcDir)
server/        # Nitro API server
shared/        # Contracts (Zod schemas)
sw-src/        # Service worker source
docs/          # Consolidated documentation
```

For detailed information, see the documentation files linked above.
