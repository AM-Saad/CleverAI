# Service Worker & AI Architecture - Quick Reference

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CleverAI PWA Architecture                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICE WORKER SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐      ┌──────────────────────────────────────────┐    │
│  │   Window    │      │      Service Worker (/sw.js)              │    │
│  │  (Main UI)  │◄────►│                                           │    │
│  └─────────────┘      │  • Workbox precaching & routing           │    │
│         │             │  • Background Sync (forms + notes)         │    │
│         │             │  • Periodic Sync                           │    │
│         ▼             │  • Push notifications                      │    │
│  ┌─────────────┐      │  • Offline fallback                        │    │
│  │   Plugins   │      │  • IndexedDB queue management              │    │
│  ├─────────────┤      └──────────────────────────────────────────┘    │
│  │ sw-register │              ▲                                        │
│  │ sw-messages │              │ postMessage                            │
│  │ sw-idb-toasts│             │                                        │
│  │ sw-sync     │──────────────┘                                        │
│  │ idb-health  │                                                        │
│  └─────────────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────┐                                           │
│  │  useServiceWorkerBridge │  (Reactive Bridge Pattern)               │
│  │  ────────────────────── │                                           │
│  │  • registration         │                                           │
│  │  • updateAvailable      │                                           │
│  │  • formSyncStatus       │                                           │
│  │  • notificationUrl      │                                           │
│  │  • postMessage()        │                                           │
│  └─────────────────────────┘                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          AI WORKER SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐      ┌──────────────────────────────────────────┐    │
│  │   Window    │      │      AI Worker (/ai-worker.js)            │    │
│  │  (Main UI)  │◄────►│                                           │    │
│  └─────────────┘      │  • ModelPipeline singleton                │    │
│         │             │  • Transformers.js inference               │    │
│         │             │  • File download tracking                  │    │
│         ▼             │  • ONNX model caching                      │    │
│  ┌─────────────┐      │  • Non-blocking inference                 │    │
│  │   Plugin    │      └──────────────────────────────────────────┘    │
│  ├─────────────┤              ▲                                        │
│  │ ai-worker   │              │ postMessage                            │
│  │   .client   │──────────────┘                                        │
│  └─────────────┘                                                        │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────────┐                                              │
│  │ useTextSummarization │  (Worker Communication)                     │
│  │ ──────────────────── │                                              │
│  │  • isLoading         │  USE CASE: Text Summarization               │
│  │  • isSummarizing     │  REASON: Heavy inference (5-30s)            │
│  │  • currentSummary    │          blocks UI on main thread           │
│  │  • progress          │                                              │
│  │  • loadModel()       │  COMPONENTS: TiptapEditor                   │
│  │  • summarize()       │                                              │
│  └──────────────────────┘                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    MAIN THREAD AI SYSTEM (Store)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐                                              │
│  │ modelDownload Store  │  (Pinia State Management)                   │
│  │ ──────────────────── │                                              │
│  │  • downloads         │  USE CASE: Text-to-Speech, other AI         │
│  │  • loadedModels      │  REASON: Lighter tasks, different patterns  │
│  │  • downloadModel()   │                                              │
│  │  • getModel()        │  COMPONENTS: AI demo page, useAIModel       │
│  └──────────────────────┘                                              │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────────┐                                              │
│  │    useAIModel        │  (Main Thread Loading)                      │
│  │ ──────────────────── │                                              │
│  │  • model             │  NOTE: Could migrate to worker in future    │
│  │  • isLoading         │        if tasks cause UI blocking           │
│  │  • progress          │                                              │
│  │  • loadModel()       │                                              │
│  └──────────────────────┘                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Message Flow Patterns

### Service Worker Messages

```
SW → Window (OutgoingSWMessage):
  • SW_ACTIVATED, SW_UPDATE_AVAILABLE
  • FORM_SYNC_STARTED, FORM_SYNCED, FORM_SYNC_ERROR
  • NOTES_SYNC_STARTED, NOTES_SYNCED, NOTES_SYNC_ERROR
  • NOTIFICATION_CLICK_NAVIGATE
  • ERROR (generic)

Window → SW (IncomingSWMessage):
  • SKIP_WAITING, CLAIM_CONTROL
  • SET_DEBUG
  • SYNC_NOTES
```

### AI Worker Messages

```
Worker → Window (IncomingAIMessage):
  • WORKER_READY
  • MODEL_LOAD_INITIATE, MODEL_LOAD_PROGRESS, MODEL_LOAD_DONE, MODEL_LOAD_COMPLETE
  • MODEL_LOAD_ERROR
  • INFERENCE_STARTED, INFERENCE_COMPLETE, INFERENCE_ERROR

Window → Worker (OutgoingAIMessage):
  • LOAD_MODEL
  • RUN_INFERENCE
  • UNLOAD_MODEL
  • SET_DEBUG
```

## File Organization

```
sw-src/
  ├── index.ts                    → public/sw.js (Service Worker)
  └── ai-worker.ts                → public/ai-worker.js (AI Worker)

app/plugins/
  ├── sw-register.client.ts       ✅ SW registration
  ├── sw-messages.client.ts       ⚠️  Consolidate with sw-idb-toasts
  ├── sw-idb-toasts.client.ts     ⚠️  Consolidate with sw-messages
  ├── sw-sync.client.ts           ✅ Background/Periodic sync
  ├── sw-notification-navigation  ❌ DELETE (empty stub)
  ├── idb-health.client.ts        ✅ Storage health check
  ├── offline-toasts.client.ts    ✅ Offline form feedback
  └── ai-worker.client.ts         ✅ AI Worker registration

app/composables/
  ├── useServiceWorkerBridge.ts   ✅ SW state (singleton pattern) ⭐
  ├── useOffline.ts               ✅ Form queueing
  ├── useStorageHealth.ts         ✅ Storage flags
  └── ai/
      ├── useTextSummarization.ts ✅ AI Worker summarization
      └── useAIModel.ts           ✅ Main thread AI loading

app/stores/
  └── modelDownload.ts            ✅ Non-worker AI state (TTS, etc.)

shared/types/
  ├── sw-messages.ts              ✅ SW message contracts
  └── ai-messages.ts              ✅ AI Worker message contracts

app/utils/constants/
  └── pwa.ts                      ✅ ALL constants centralized ⭐

scripts/
  ├── check-sw-placeholder.cjs    ✅ Build validation
  ├── check-ai-worker.cjs         ✅ Build validation
  └── inject-sw.cjs               ✅ Workbox manifest injection
```

## Key Patterns

### ✅ Excellent Patterns (Keep Using)

1. **Singleton Reactive Bridge** (`useServiceWorkerBridge`)
   - Single source of truth for SW state
   - Eliminates duplicate message listeners
   - Clean reactive API

2. **Centralized Constants** (`pwa.ts`)
   - No magic strings
   - Single import for all PWA values
   - Easy to update

3. **Typed Message Contracts** (`sw-messages.ts`, `ai-messages.ts`)
   - Discriminated unions
   - Type guards
   - Compile-time safety

4. **Parallel Build Scripts**
   - SW and AI Worker follow same pattern
   - Validation prevents broken builds
   - Consistent targets (ES2019 vs ES2020)

### ⚠️ Patterns to Improve

1. **Duplicate SW Message Listeners**
   - `sw-messages.client.ts` and `sw-idb-toasts.client.ts` both listen
   - Both handle IDB errors
   - Consolidate into single plugin

2. **Dead Code**
   - `sw-notification-navigation.client.ts` is empty
   - Delete it

## Quick Actions (Priority Order)

### 🔴 High Priority (Do First)
1. Delete `sw-notification-navigation.client.ts` (5 minutes)
2. Consolidate SW message listeners (2 hours)

### 🟡 Medium Priority (Nice to Have)
3. Add inline comments explaining two AI systems (30 minutes)
4. Integration tests for SW messages (3 hours)

### 🟢 Low Priority (Future)
5. Split SW into modules (4-8 hours)
6. Migrate other AI tasks to worker if needed

## Grade: A (95/100)

**Excellent architecture** with minor improvements needed.

Core patterns are solid, separation of concerns is clear, and the system is production-ready.
