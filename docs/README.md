# Cognilo Documentation

> Documentation index for the Cognilo learning platform.

---

## 📚 Documentation

### Core
| Document | Description |
|----------|-------------|
| **[📖 Project README](../README.md)** | Project overview, setup, tech stack, features |
| **[🏗️ ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, data model, module architecture, design patterns |
| **[🧭 architecture/app-surfaces.md](./architecture/app-surfaces.md)** | Platform/Daily/Learning deployable-surface split |
| **[🎯 FEATURES.md](./FEATURES.md)** | Detailed feature docs (Notes, Daily, Spaced Repetition, LLM, Board, AI, PWA, Auth, Notifications) |
| **[🔧 DEVELOPMENT.md](./DEVELOPMENT.md)** | Setup, commands, debugging, testing |
| **[🔧 MAINTENANCE.md](./MAINTENANCE.md)** | Known issues, tech debt, operations, roadmap |
| **[📱 PWA.md](./PWA.md)** | PWA implementation and caching strategy |

### Design system
| Document | Description |
|----------|-------------|
| **[🎨 DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** | Code-first design tokens, generation pipeline, enforcement |
| **[🧩 COMPONENT_SYSTEM.md](./COMPONENT_SYSTEM.md)** | Component taxonomy, `Ui*` wrapper policy, contracts |
| **[📐 app/DESIGN.md](../app/DESIGN.md)** | Visual language spec — breakpoints, typography, component checklist |
| **[component-audit/](./component-audit/components.md)** | Generated (`yarn design:components`): component inventory, duplication clusters, cross-surface reachability |
| **[design-audit/](./design-audit/summary.md)** | Generated (`yarn design:audit`): raw design-value/style violation scan |

### LLM & AI worker
| Document | Description |
|----------|-------------|
| **[🔄 LLM_GENERATION_FLOW.md](./LLM_GENERATION_FLOW.md)** | End-to-end LLM generation trace |
| **[🤖 AI_WORKER_ARCHITECTURE.md](./AI_WORKER_ARCHITECTURE.md)** | On-device AI web worker — design, message flow, build |
| **[⬇️ AI_MODEL_DOWNLOADS.md](./AI_MODEL_DOWNLOADS.md)** | Model-download Pinia store — API, usage, troubleshooting |
| **[⚡ SW_AI_WORKER_QUICK_REFERENCE.md](./SW_AI_WORKER_QUICK_REFERENCE.md)** | Service-worker / AI-worker cheat-sheet — message flows, file org, patterns |
| **[🧭 MODULE_SYSTEM_DIAGRAMS.md](./MODULE_SYSTEM_DIAGRAMS.md)** | Server module-system diagrams |

> **Operations history** (point-in-time incident/audit reports — not living docs, left as-written): [DEPLOYMENT_BUGS_FIXES.md](./DEPLOYMENT_BUGS_FIXES.md) (Railway/auth deployment issues), [BOARD_ITEMS_OFFLINE_V2_INCIDENT.md](./BOARD_ITEMS_OFFLINE_V2_INCIDENT.md), [BOARD_LOCAL_FIRST_PIPELINE_AUDIT.md](./BOARD_LOCAL_FIRST_PIPELINE_AUDIT.md), [NOTES_BOARD_OFFLINE_V2_FINAL_FLOW.md](./NOTES_BOARD_OFFLINE_V2_FINAL_FLOW.md), [NOTES_CREATION_OFFLINE_V2_INCIDENT.md](./NOTES_CREATION_OFFLINE_V2_INCIDENT.md), [NOTES_V1_RESTORATION_INCIDENT.md](./NOTES_V1_RESTORATION_INCIDENT.md), [OFFLINE_SYNC_AND_DEBOUNCE_INCIDENT.md](./OFFLINE_SYNC_AND_DEBOUNCE_INCIDENT.md), [FLASHCARD_REVIEW_SESSION_AUDIT.md](./FLASHCARD_REVIEW_SESSION_AUDIT.md), [LANGUAGE_LEARNING_PIPELINE_AUDIT.md](./LANGUAGE_LEARNING_PIPELINE_AUDIT.md).

---

## Quick Start

1. **New developers** → Start with the [Project README](../README.md), then [DEVELOPMENT.md](./DEVELOPMENT.md)
2. **System overview** → [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Feature details** → [FEATURES.md](./FEATURES.md)
4. **Known issues** → [MAINTENANCE.md](./MAINTENANCE.md)
