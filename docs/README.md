# CleverAI Documentation

Comprehensive documentation for the CleverAI learning platform.

---

## 📚 Core Documentation

| Document | Description |
|----------|-------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, data model, module architecture, design patterns |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | Setup, commands, debugging, testing, contribution guide |
| **[FEATURES.md](./FEATURES.md)** | Detailed feature documentation (Notes, SR, LLM, PWA, Auth) |
| **[MAINTENANCE.md](./MAINTENANCE.md)** | Known issues, tech debt, security, operations, roadmap |

---

## 🚀 Quick Start

1. **New Developers**: Start with [DEVELOPMENT.md](./DEVELOPMENT.md)
2. **System Overview**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Feature Details**: Consult [FEATURES.md](./FEATURES.md)
4. **Known Issues**: Check [MAINTENANCE.md](./MAINTENANCE.md)

---

## 📂 Legacy Documentation (Archive)

Previous documentation has been consolidated. Historical docs are preserved in subdirectories:

### [notifications/](./notifications/)
Push notifications, cron jobs, timing logic.
- Main content → [FEATURES.md#push-notifications](./FEATURES.md#push-notifications)

### [pwa/](./pwa/)
Progressive Web App, service workers, offline support.
- Main content → [FEATURES.md#pwa--offline-support](./FEATURES.md#pwa--offline-support)

### [spaced-repetition/](./spaced-repetition/)
SM-2 algorithm, card review system.
- Main content → [FEATURES.md#spaced-repetition-sm-2](./FEATURES.md#spaced-repetition-sm-2)

### [error-handling/](./error-handling/)
Centralized error handling patterns.
- Main content → [ARCHITECTURE.md#service-architecture](./ARCHITECTURE.md#service-architecture)

### [development/](./development/)
Developer workflows, debugging.
- Main content → [DEVELOPMENT.md](./DEVELOPMENT.md)

### [architecture/](./architecture/)
System design details.
- Main content → [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 📋 Document Changelog

| Date | Change |
|------|--------|
| Current | Consolidated all docs into 4 main files |
| Previous | Separate docs per feature area |

---

## 🔗 Related Files

- **[../README.md](../README.md)** - Project overview
- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Redirect to docs/ARCHITECTURE.md
- **[../.github/copilot-instructions.md](../.github/copilot-instructions.md)** - AI assistant guidelines
- `ARCHITECTURE-API-REFactor.md` - API refactoring documentation
- `archive/` - Historical architecture documentation

### 📂 [development/](./development/)
Development guides, setup instructions, and developer workflows.
- `DEVELOPMENT.md` - Main development guide
- `database-error-examples.ts` - Database error handling examples
- `archive/` - Historical development documentation

## Documentation Status

Each category contains:
- **Current docs** - Active, maintained documentation
- **archive/** - Historical documentation kept for reference

## Contributing

When updating documentation:
1. Update the relevant file in its category folder
2. If superseding old documentation, move the old version to `archive/`
3. Keep file paths and code examples accurate with the current codebase
4. Cross-reference related documentation when applicable
