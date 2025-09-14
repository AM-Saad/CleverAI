# PWA Constants Audit Report

## Overview
This report documents all hardcoded values found across the PWA system and the refactoring plan to use centralized constants/enums for better maintainability.

## Files Analyzed
1. `sw-src/index.ts` - Main service worker
2. `app/composables/useOffline.ts` - Background sync composable
3. `app/plugins/sw-sync.client.ts` - Sync registration plugin
4. `app/pages/offline.vue` - Offline experience page

## Hardcoded Values Found

### 1. Service Worker (`sw-src/index.ts`)

#### ✅ ALREADY REFACTORED:
- **SW_MESSAGE_TYPE**: Now uses centralized `SW_MESSAGE_TYPES`
- **Upload chunk sizes**: Now uses `UPLOAD_CONFIG.CHUNK_SIZE` (256KB min, 5MB max, 100 target chunks)
- **PREWARM_PATHS**: Now uses centralized constant array

#### ❌ STILL HARDCODED:
- **SW_VERSION**: `'v1.8.0-enhanced'` (should use `SW_CONFIG.VERSION`)
- **DEBUG configuration**: Query param and value checking
- **Timeout values**:
  - `20000` (20 seconds) - network timeout
  - `30000` (30 seconds) - update check interval
  - `1500` (1.5 seconds) - update settle delay
- **Database constants**:
  - `'recwide_db'` - database name
  - `2` - database version
  - `'forms'` - store name
  - `'projects'` - store name
- **Cache names**: `'pages'`, `'assets'`, `'images'`, `'static'`, `'api-auth'`
- **Cache configuration**:
  - Images: 50 max entries, 30 days expiry
  - Assets: 100 max entries, 7 days expiry
- **Upload constants**:
  - Concurrency: 3 chunks, 4 files
  - Base backoff: 1000ms
  - Max attempts: 5
  - HTTP status codes: 413, 429, 503
- **URL patterns and regexes**:
  - Dev file patterns: `'/@fs/'`, `'/node_modules/'`, etc.
  - Asset regex: `/\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/`
  - Nuxt assets regex pattern
- **Auth stubs**: `/api/auth/session`, `/api/auth/csrf`, `/api/auth/providers`
- **Notification defaults**: Default title, icon paths, badge
- **HTML response**: Complete offline HTML template with hardcoded styles

### 2. Offline Composable (`app/composables/useOffline.ts`)

#### ❌ HARDCODED VALUES:
- **Database constants**:
  - `DB_NAME = 'recwide_db'`
  - `DB_VERSION = 2`
  - `STORE_NAME = 'forms'`
- **Event names**:
  - `'offline-form-saved'`
  - `'offline-form-sync-started'`
  - `'offline-form-synced'`
  - `'offline-form-sync-error'`
- **Sync tag**: `'syncForm'`
- **IndexedDB keyPath migration**: `'email'` to `'id'`

### 3. Sync Plugin (`app/plugins/sw-sync.client.ts`)

#### ❌ HARDCODED VALUES:
- **Sync tags**:
  - `'syncForm'` - one-off sync
  - `'content-sync'` - periodic sync
- **Periodic sync interval**: `60 * 60 * 1000` (1 hour)
- **Message types**:
  - `'SYNC_FORM'`
  - `'FORM_SYNCED'`
  - `'FORM_SYNC_ERROR'`

### 4. Offline Page (`app/pages/offline.vue`)

#### ❌ HARDCODED VALUES:
- **Page definitions array**: Complete hardcoded list with titles, paths, descriptions, icons, priorities
- **UI text**:
  - `'You are currently offline'`
  - `'You are back online!'`
  - `'Available Offline'`
  - `'Network Status'`
  - `'Try to Reconnect'`
  - `'Refresh Page'`
  - `'Connecting...'`
  - `'Connection failed. Retrying...'`
- **Timeout values**:
  - `5000` (5 seconds) - connection check timeout
  - `3000` (3 seconds) - reconnect delay
- **Retry attempts**: `3`

## Duplications Found

1. **Database Configuration**:
   - `DB_NAME = 'recwide_db'` appears in both `sw-src/index.ts` and `useOffline.ts`
   - `DB_VERSION = 2` appears in both files
   - `STORE_NAME = 'forms'` appears in both files

2. **Sync Tags**:
   - `'syncForm'` appears in both `useOffline.ts` and `sw-sync.client.ts`

3. **Message Types**:
   - Several SW message types defined in both service worker and other files

4. **Timeout Values**:
   - Similar timeout patterns across files (5000ms, 3000ms, etc.)

## ✅ Constants Structure Created

Created centralized constants in:
- `shared/constants/pwa.ts` - Main PWA constants
- `shared/constants/offline.ts` - Offline-specific constants
- `shared/constants/index.ts` - Central export point
- `types/pwa.ts` - PWA type definitions
- `types/offline.ts` - Offline type definitions

## Refactoring Plan

### Phase 1: Complete Service Worker Refactoring
- [ ] Replace SW_VERSION with `SW_CONFIG.VERSION`
- [ ] Replace all timeout values with `SW_CONFIG.*` constants
- [ ] Replace database constants with `DB_CONFIG.*`
- [ ] Replace cache names with `CACHE_NAMES.*`
- [ ] Replace notification defaults with `NOTIFICATION_CONFIG.*`
- [ ] Replace URL patterns with `URL_PATTERNS.*`
- [ ] Replace auth stubs with `AUTH_STUBS`

### Phase 2: Refactor Composables and Plugins
- [ ] Update `useOffline.ts` to use `DB_CONFIG.*`
- [ ] Update `useOffline.ts` to use `DOM_EVENTS.*`
- [ ] Update `useOffline.ts` to use `SYNC_TAGS.*`
- [ ] Update `sw-sync.client.ts` to use centralized constants

### Phase 3: Refactor Pages and Components
- [ ] Update `offline.vue` to use `OFFLINE_PAGES` and `OFFLINE_UI.*`
- [ ] Check other PWA components for hardcoded values

### Phase 4: Validation
- [ ] Test all PWA functionality works after refactoring
- [ ] Ensure no build errors or type issues
- [ ] Verify service worker registration and updates work
- [ ] Test offline functionality and background sync

## Benefits of Refactoring

1. **Maintainability**: Single source of truth for all PWA constants
2. **Consistency**: Eliminates duplicated values across files
3. **Type Safety**: Proper TypeScript types for all constants
4. **Configuration**: Easy to modify behavior by changing constants
5. **Documentation**: Clear organization and naming of all values
6. **Testability**: Easier to mock and test with centralized constants

## Estimated Impact

- **Files to be modified**: 4 main files + potentially others
- **Lines of code affected**: ~100+ lines across all files
- **Risk level**: Medium (service worker changes require careful testing)
- **Testing required**: Full PWA functionality validation
