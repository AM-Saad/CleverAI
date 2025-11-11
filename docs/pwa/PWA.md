# 🚀 CleverAI PWA Documentation

> **Complete Progressive Web App Guide**
> Everything you need to know about the PWA system, Service Worker, Caching, Notifications, Updates, and Build Pipeline
>
> ℹ️ Historical note: Earlier revisions referenced `shared/idb.ts`, `shared/constants/pwa.ts`, and a separate `useServiceWorkerUpdates` composable. These have been fully consolidated. The authoritative locations are `app/utils/idb.ts`, `app/utils/constants/pwa.ts`, and the unified bridge `useServiceWorkerBridge`. Message contracts now live in `shared/types/sw-messages.ts`. See `docs/pwa/SW_MESSAGE_LIFECYCLE.md` for the canonical message taxonomy and extension guidance.

---

## 📑 Table of Contents

1. [Quick Start & Overview](#-quick-start--overview)
2. [Architecture & System Design](#-architecture--system-design)
3. [Build Pipeline & Compilation](#-build-pipeline--compilation)
4. [Service Worker Implementation](#-service-worker-implementation)
5. [Caching Strategies](#-caching-strategies)
6. [Update System](#-update-system)
7. [Development Tools](#-development-tools)
8. [Constants & Configuration](#-constants--configuration)
9. [Testing & Validation](#-testing--validation)
10. [Deployment & Production](#-deployment--production)
11. [Troubleshooting](#-troubleshooting)

---

## 🎯 Quick Start & Overview

### What is This PWA System?

CleverAI uses a **comprehensive Progressive Web App (PWA) implementation** built on Nuxt 4 with TypeScript and advanced Workbox integration. This provides:

- ✅ **Offline functionality** - Complete app functionality without internet
- ✅ **Install to home screen** - Native app-like experience with proper manifest
- ✅ **Background sync** - Form data sync when connection returns
- ✅ **Push notifications** - Real-time user engagement with click handling
- ✅ **Smart caching** - Multi-layer caching with asset discovery and prewarming
- ✅ **Auto-updates** - Seamless service worker updates with user control
- ✅ **IndexedDB integration** - Offline data storage with schema migration
<!-- Removed: Chunked file uploads (feature not active) -->
- ✅ **Periodic sync** - Scheduled background content updates

### Key Commands

```bash
# Development with hot reload
yarn dev

# Build service worker only
yarn sw:build

# Full production build with PWA
yarn build:inject

# Test PWA offline functionality
yarn test:pwa-offline

# Debug and development tools
open http://localhost:3000/debug
```

### Critical Files You Need to Know

| File | Purpose | Edit? |
|------|---------|-------|
| `sw-src/index.ts` | Main service worker source (TypeScript) | ✅ |
| `app/utils/idb.ts` | Unified IndexedDB helper (non-destructive, versioned) | ✅ |
| `app/composables/useServiceWorkerBridge.ts` | SW message + lifecycle singleton | ✅ |
| `shared/types/sw-messages.ts` | Type-safe incoming/outgoing message contracts | ✅ |
| `app/composables/useOffline.ts` | Background form & notes queue helpers | ✅ |
| `app/plugins/sw-sync.client.ts` | Registers sync + bridge | ✅ |
| `app/layouts/default.vue` | Hosts update banner & bridge wiring | ✅ |
| `app/utils/constants/pwa.ts` | Centralized PWA + SW config & enums | ✅ |
| `public/sw.js` | Compiled service worker output | ❌ (generated) |
| `public/manifest.webmanifest` | PWA manifest | ✅ |
| `scripts/inject-sw.cjs` | Workbox manifest injection step | ⚠️ Rare |

---

## 🏗️ Architecture & System Design

### PWA Pipeline Overview

```mermaid
graph TD
    A[sw-src/index.ts] -->|TypeScript Compilation| B[public/sw.js]
    B -->|Workbox Injection| C[.output/public/sw.js]
    C -->|Runtime| D[Browser Service Worker]

    E[app/utils/idb.ts] -->|IndexedDB Helper| F[Client & SW]
    G[useServiceWorkerBridge] -->|Singleton Pattern| H[SW Messages]
    I[app/layouts/default.vue] -->|Update UI| J[User Notifications]

    D <-->|Messages| H
    D <-->|IDB Operations| F
    H --> I
```

### Core Technologies

- **Nuxt 4.0.3**: Framework with manual PWA control
- **TypeScript**: Service worker development with full type safety
- **Workbox 7.3.0**: Precaching, routing, and caching strategies
- **Vue 3**: Reactive UI components and composables
- **IndexedDB**: Offline data storage with schema versioning
- **Web Push API**: Notification system with VAPID authentication
- **Background Sync API**: Offline form submission and data sync
- **Periodic Sync API**: Scheduled background updates

### Why Enhanced Custom Implementation?

We use an enhanced custom PWA instead of standard solutions because:

1. **Advanced Features**: Background sync, IndexedDB migration, chunked uploads
2. **Full Control**: Complete control over caching strategies and offline behavior
3. **TypeScript Safety**: Type-safe service worker with comprehensive error handling
4. **Performance**: Only include needed features, optimized bundle size
5. **Debugging**: Comprehensive development tools and debug capabilities
6. **Production Ready**: Robust error recovery and retry mechanisms

---

## 🔧 Build Pipeline & Compilation

### Three-Stage Build Process

#### Stage 1: TypeScript Compilation
```bash
yarn sw:build
# sw-src/index.ts → public/sw.js
```

#### Stage 2: Workbox Injection
```bash
yarn build:inject
# Injects __WB_MANIFEST into compiled SW
```

#### Stage 3: Production Build
```bash
yarn build
# Nuxt builds everything to .output/
```

### Build Scripts Explained

#### `scripts/inject-sw.cjs`
```javascript
// Workbox manifest injection for production
const { injectManifest } = require('workbox-build')

// Injects list of all static assets into service worker
// Replaces self.__WB_MANIFEST placeholder
```

#### `scripts/check-sw-placeholder.cjs`
```javascript
// Safety check: Ensures __WB_MANIFEST placeholder exists
// Prevents build failures during injection
```

### Package.json Scripts

```json
{
  "scripts": {
    "sw:build": "esbuild sw-src/index.ts --bundle --outfile=public/sw.js",
    "sw:check": "node scripts/check-sw-placeholder.cjs",
    "build:inject": "yarn sw:build && yarn sw:check && node scripts/inject-sw.cjs",
    "build": "nuxt build",
    "dev": "yarn sw:build && nuxt dev"
  }
}
```

### Critical Build Requirement

⚠️ **IMPORTANT**: The service worker must contain the exact string `self.__WB_MANIFEST` for Workbox injection to work.

**✅ Correct TypeScript code:**
```typescript
// This compiles to: self.__WB_MANIFEST
const manifest = (self as any).__WB_MANIFEST || []
```

**❌ Incorrect TypeScript code:**
```typescript
// This compiles to: selfWithWB.__WB_MANIFEST (Workbox can't find it)
const selfWithWB = self as unknown as { __WB_MANIFEST?: any }
let manifest = selfWithWB.__WB_MANIFEST
```

---

## ⚙️ Service Worker Implementation

### Main Service Worker (`sw-src/index.ts`)

This is the **consolidated TypeScript service worker** with streamlined PWA features:

```typescript
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { SW_CONFIG, CACHE_NAMES, AUTH_STUBS } from '../app/utils/constants/pwa'
import { openUnifiedDB, getAllRecords, deleteRecord } from '../app/utils/idb'

// Version and configuration from centralized constants
const SW_VERSION = SW_CONFIG.VERSION
```

### Key Features

1. **Precaching**: All build assets automatically cached using Workbox
2. **Runtime Caching**: Strategic caching with centralized cache names
3. **Background Sync**: Form sync using shared IndexedDB helper
4. **Push Notifications**: Complete notification system with click handling
5. **Update Management**: Seamless update detection with user control
6. **Shared IndexedDB**: Non-destructive schema management via `app/utils/idb.ts`
7. **Message Bridge**: Centralized communication via `useServiceWorkerBridge`

### Recent Architectural Improvements ✅

- **✅ IndexedDB Consolidation**: Replaced custom SW IndexedDB with shared helper
- **✅ Message Type Alignment**: SW and Bridge handle identical message contracts  
- **✅ Cache Strategy Unification**: All cache names use centralized constants
- **✅ Duplicate Logic Removal**: Removed deprecated upload functionality
- **✅ Bundle Size Optimization**: Reduced SW size by 1.8kb through cleanup
- **✅ Resilient IDB Writes**: Added bounded exponential backoff for transient `InvalidStateError` / `TransactionInactiveError` during rapid tab reloads

---

## 🔄 Update System

The update & messaging layer is driven by a single enum-like object `SW_MESSAGE_TYPES` (defined in `app/utils/constants/pwa.ts`) and strongly typed via `shared/types/sw-messages.ts`. For a full lifecycle diagram, message direction (SW→Client vs Client→SW), payload schemas, and extension steps refer to `docs/pwa/SW_MESSAGE_LIFECYCLE.md` (authoritative source). Below is a concise operational view.

### Service Worker Update Flow

The update system now uses **consolidated message handling** through `useServiceWorkerBridge`:

```mermaid
graph TD
    A[SW Detects Update] --> B[SW Posts SW_UPDATE_AVAILABLE]
    B --> C[useServiceWorkerBridge Receives]
    C --> D[Sets updateAvailable Ref]
    D --> E[default.vue Shows Banner]
    E --> F[User Clicks Update]
    F --> G[activateUpdateAndReload]
    G --> H[SW skipWaiting + Reload]
```

#### Enhanced Message Handling

```typescript
// useServiceWorkerBridge.ts - Singleton pattern
const { updateAvailable, activateUpdateAndReload } = useServiceWorkerBridge()

// SW Update Detection (consolidated)
watch(updateAvailable, (available) => {
  if (available) {
    // Show update banner in layout
    showUpdateNotification.value = true
  }
})
```

#### Update Detection Methods

- **Automatic Polling**: SW checks for waiting workers every 30 seconds
- **User Control**: Updates only apply when user chooses via UI
- **Graceful Fallback**: Maintains app functionality if updates fail
- **Singleton Communication**: Single message listener prevents conflicts

---

## 🛠️ Development Tools

### Debug and Testing

Development mode includes enhanced debugging through the **consolidated SW bridge**:

#### **Available Debug Functions**

1. **SW Update Check** - `useServiceWorkerBridge().ensureRegistration()`
2. **Force SW Control** - `useServiceWorkerBridge().claimControl()`
3. **Manual Refresh** - Standard `window.location.reload()`
4. **Debug Mode Toggle** - `useServiceWorkerBridge().setDebug(true)`
5. **Test Messages** - Direct SW communication via bridge

#### **Consolidated Composable**

```typescript
// Single source of truth for SW communication
const {
  // Production functions (always available)
  registration,
  version,
  updateAvailable,
  isControlling,
  notificationUrl,

  // SW Control functions
  requestSkipWaiting,
  claimControl,
  setDebug,
  activateUpdateAndReload,

  // State management
  formSyncStatus,
  lastFormSyncEventType,
  lastError
} = useServiceWorkerBridge()
```

### Testing Pages

1. **`/debug`** - Comprehensive debug dashboard with SW state
2. **Layout Debug Features** - Built into `default.vue` for real-time testing
3. **SW Message Testing** - Direct message passing validation

### Development vs Production

- **Development**: Debug logging enabled, SW updates immediate
- **Production**: Optimized bundle, controlled update flow
- **Testing**: Comprehensive offline functionality validation

---

## ⚙️ Constants & Configuration

### Centralized Configuration

All PWA constants are now centralized in `app/utils/constants/pwa.ts`:

#### **Before vs After Refactoring:**

**✅ BEFORE:**
```typescript
const SW_VERSION = 'v1.8.0-enhanced'
const DB_NAME = 'recwide_db'
const CACHE_NAMES = { pages: 'pages', assets: 'assets' }
```

**✅ AFTER:**
```typescript
import { SW_CONFIG, DB_CONFIG, CACHE_NAMES } from '../../app/utils/constants/pwa'

const SW_VERSION = SW_CONFIG.VERSION
const { NAME: DB_NAME } = DB_CONFIG
```

#### **Key Configuration Sections:**

1. **SW_CONFIG** - Service worker version, timeouts, intervals
2. **CACHE_NAMES** - All cache names and strategies
3. **DB_CONFIG** - IndexedDB configuration
  - Version `4` performs unified creation of required stores (`forms`, `notes`) and adds `folderId` / `updatedAt` indexes for notes.
  - Prior versions used lazy per-store creation; upgrading ensures atomic schema setup.
4. **AUTH_STUBS** - Development authentication stubs
5. **URL_PATTERNS** - Route matching patterns

### Files Refactored & Consolidated

- ✅ `sw-src/index.ts` - **Consolidated SW with shared IDB helper**
- ✅ `app/utils/idb.ts` - **Non-destructive IndexedDB operations**
- ✅ `app/composables/useServiceWorkerBridge.ts` - **Singleton message handling**
- ✅ `app/composables/useOffline.ts` - **Uses shared IDB helper**
- ✅ `app/plugins/sw-sync.client.ts` - **Streamlined sync registration**
- ✅ `app/layouts/default.vue` - **Integrated update notifications**
- ✅ `app/utils/constants/pwa.ts` - **Centralized configuration**

#### Recent Consolidation Benefits

1. **Data Safety**: Non-destructive IndexedDB schema upgrades
2. **Message Reliability**: Singleton pattern prevents duplicate listeners
3. **Bundle Optimization**: Removed 1.8kb of unused upload code
4. **Configuration Consistency**: All cache names and constants centralized
5. **Type Safety**: Full TypeScript coverage across SW and client
6. **Error Prevention**: Eliminated race conditions in IndexedDB operations
7. **Write Resilience**: Bounded backoff avoids user-visible failures on transient DB state changes

### IndexedDB Retry Policy
Generic helpers (`putRecord`, `deleteRecord` in `app/utils/idb.ts`) apply a tiny exponential backoff for transient errors using `IDB_RETRY_CONFIG`:

```ts
export const IDB_RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 40,
  FACTOR: 2,
  MAX_DELAY_MS: 400,
  JITTER_PCT: 0.2,
}
```

Characteristics:
- **Scoped**: Only retries `InvalidStateError` / `TransactionInactiveError`.
- **Bounded**: Worst-case added latency < ~1 second.
- **Atomic**: Each attempt reopens unified DB if needed.
- **Tunable**: Adjust constants in `pwa.ts` without code changes.

To tune: increase `MAX_ATTEMPTS` (rare) or `BASE_DELAY_MS` if seeing frequent transient errors under heavy multi-tab use.

---

## 🧪 Testing & Validation

### Manual Testing

#### **1. Basic Update Detection**
1. Make a change to any file
2. Run `yarn build:inject`
3. Refresh the browser
4. Update notification should appear

#### **2. Offline Functionality**
1. Open browser dev tools → Network tab
2. Set to "Offline"
3. Navigate the app - should work fully offline
4. Submit forms - should queue for background sync

#### **3. Installation Testing**
1. Open site in Chrome/Edge
2. Look for install prompt or address bar icon
3. Install as PWA
4. Test app functionality in standalone mode

### Automated Testing

```bash
# Run PWA offline tests
yarn test:pwa-offline

# Run basic PWA tests
yarn test:pwa-basic
```

### CI Validation

Quick validation steps for service worker injection:

```bash
# Check that SW placeholder exists
node scripts/check-sw-placeholder.cjs

# Verify injection worked
grep -q "workbox-" .output/public/sw.js && echo "✅ Workbox injected"
```

---

## 🚀 Deployment & Production

### Production Checklist

- [ ] Run `yarn build:inject` to inject Workbox manifest
- [ ] Verify `sw.js` contains workbox code (not just placeholder)
- [ ] Test offline functionality in production build
- [ ] Verify update notifications work correctly
- [ ] Check PWA install prompt appears
- [ ] Test background sync functionality
- [ ] Validate push notifications (if enabled)

### Environment Configuration

```bash
# Required environment variables
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
NOTIFICATION_EMAIL=your_email@domain.com
```

### Performance Considerations

1. **Service Worker Size**: Keep SW bundle small for fast updates
2. **Cache Strategy**: Balance between performance and storage
3. **Update Frequency**: Don't check for updates too frequently
4. **Asset Precaching**: Only precache critical assets

---

## 🔧 Troubleshooting

### Common Issues

#### **Service Worker Not Updating**
- Check browser dev tools → Application → Service Workers
- Clear all data and try again
- Verify `__WB_MANIFEST` placeholder exists in source
- Check console for Workbox injection errors

#### **Offline Functionality Not Working**
- Verify service worker is active and controlling the page
- Check Network tab - requests should show "(from ServiceWorker)"
- Clear cache and reload
- Check IndexedDB for stored offline data

#### **Build Issues**
- Ensure `yarn sw:build` runs without errors
- Check that `public/sw.js` is generated
- Verify Workbox injection completed successfully
- Check for TypeScript compilation errors

#### **Update Notifications Not Showing**
- Confirm `useServiceWorkerBridge` initialized exactly once (singleton)
- Verify build included SW changes (`yarn build:inject`) and page loaded new `sw.js`
- Check Application → Service Workers: is there a waiting worker? If yes, calling `requestSkipWaiting()` should trigger activation notification
- Open DevTools Console for any message type mismatches (refer to `SW_MESSAGE_LIFECYCLE.md`)
- In stubborn cases: unregister all SWs, hard reload, then trigger an update commit again

### Debug Tools

1. **`/debug`** - Comprehensive debugging dashboard
2. **Browser DevTools** - Application → Service Workers
3. **Console Logging** - All debug functions use `[DEV]` prefix
4. **Network Tab** - Verify requests are served from SW

### Emergency SW Cleanup

If service worker gets in a bad state:

```javascript
// Emergency cleanup (run in browser console)
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister())
})
```

---

## 📚 Additional Resources

- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

*Last updated: September 2025*
