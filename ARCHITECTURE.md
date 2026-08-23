# Cognilo Architecture

Cognilo is a Nuxt modular monolith. Vue client code lives in `app/`, APIs and application modules in `server/`, contracts in `shared/`, and MongoDB models in `prisma/schema.prisma`.

Key boundaries:

- UI calls typed services; services call authenticated API routes.
- Server application modules own use cases; ports isolate stateful dependencies where substitution matters.
- Prisma is the durable source for user content and audit records.
- IndexedDB plus the service worker provide local-first projections and mutation queues.
- Every model call uses the single OpenRouter adapter and shared quota/rate/audit pipeline.

See:

- `docs/ARCHITECTURE.md` for the broader system
- `docs/AI_AUDIT.md` for the complete AI audit and SOLID assessment
- `docs/LLM_GENERATION_FLOW.md` for the complete AI path
- `docs/DEVELOPMENT.md` for setup and verification
- `docs/FEATURES.md` for product behavior
