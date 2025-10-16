# 🛠️ Development Guide

> **Complete development workflow, testing strategies, and debugging tools for CleverAI**

---

## 📑 Table of Contents

1. [Development Environment](#-development-environment)
2. [Testing Strategies](#-testing-strategies)
3. [Debug Tools & Controls](#-debug-tools--controls)
4. [Service Worker Development](#-service-worker-development)
5. [Offline Functionality Testing](#-offline-functionality-testing)
6. [Performance Testing](#-performance-testing)
7. [Browser Compatibility](#-browser-compatibility)
8. [Debugging Workflows](#-debugging-workflows)
9. [Production Deployment](#-production-deployment)
10. [Emergency Procedures](#-emergency-procedures)

---

## 🚀 Development Environment

### Prerequisites

- **Node.js**: Version 18+ recommended
- **Package Manager**: Yarn (preferred) or npm
- **Database**: MongoDB with Prisma
- **Browser**: Chrome/Firefox with dev tools
- **Environment**: `.env.local` configured

### Quick Start

```bash
# Clone and setup
git clone <repository>
cd cleverAI
yarn install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your configuration

# Database setup
yarn db:sync

# Start development server
yarn dev
```

### Essential Environment Variables

```bash
# Core Development
NODE_ENV=development
DATABASE_URL="mongodb://localhost:27017/cleverai-dev"

# Cron System (Testing)
ENABLE_CRON=true
CRON_CHECK_DUE_CARDS_SCHEDULE="*/2 * * * *"  # Every 2 minutes for testing
CRON_SECRET_TOKEN="dev-secret-token"

# Push Notifications
VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
NOTIFICATION_EMAIL="dev@localhost"

# Debug Flags
DEBUG_NOTIFICATIONS=true
DEBUG_TIMEZONE_CALCULATIONS=true
DEBUG_SPACED_REPETITION=true
```

### Development Scripts

```json
{
  "scripts": {
    "dev": "yarn sw:build && nuxt dev",
    "sw:build": "esbuild sw-src/index.ts --bundle --outfile=public/sw.js",
    "build:inject": "yarn sw:build && node scripts/inject-sw.cjs",
    "test:pwa-offline": "playwright test tests/pwa-offline.spec.ts",
    "test:cron": "curl -X POST 'http://localhost:3000/api/admin/cron?secret=dev-secret-token&job=check-due-cards'",
    "notifications:cleanup": "tsx server/utils/cleanupSubscriptions.ts",
    "db:sync": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

---

## 🧪 Testing Strategies

### Comprehensive Testing Dashboard

Access the main testing interface at `/debug` with:

#### **Features Available**
- ⚡ **Manual cron triggers** - Test scheduling immediately
- 🔔 **Notification testing** - Send test notifications
- 📊 **Real-time monitoring** - Live system status
- 🎯 **Preset scenarios** - Common user patterns
- 💻 **Console helpers** - Copy-paste debug commands

#### **Quick Access Testing**
```bash
# Test notification system
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Development test notification"}'

# Test cron system
curl -X POST 'http://localhost:3000/api/admin/cron?secret=dev-secret-token&job=check-due-cards'

# Test service worker update
curl -X POST http://localhost:3000/api/sw/force-update
```

### Testing Workflows by Feature

#### **Spaced Repetition System Testing**

##### End-to-End Review Workflow
1. **Setup**: Navigate to folder with flashcards
2. **Enrollment**: Click "Enroll for Review" on cards
3. **Review Session**: Go to `/review` page
4. **Keyboard Testing**: Test all shortcuts (`?` for help)
5. **Analytics**: Press `A` to verify analytics dashboard
6. **Debug Controls**: Use gear icon for algorithm testing

##### Debug Controls Testing
```typescript
// Test spaced repetition algorithm
const testSRAlgorithm = async () => {
  // 1. Access debug panel (gear icon during review)
  // 2. Set test state: repetitions: 2, easeFactor: 2.0
  // 3. Grade with different values (1-6)
  // 4. Verify algorithm calculations
}
```

#### **PWA & Service Worker Testing**

##### Offline Functionality Test
1. **Enable offline mode** in browser dev tools
2. **Navigate the app** - should work fully offline
3. **Submit forms** - should queue for background sync
4. **Re-enable network** - verify sync occurs
5. **Test update mechanism** - service worker updates

##### Service Worker Update Testing
```bash
# Force service worker update
yarn sw:build && yarn build:inject

# Test update notification component
open http://localhost:3000/test-enhanced-sw
```

#### **Notification System Testing**

##### Complete Notification Flow
1. **Permission Request**: Test browser notification permission
2. **Subscription**: Subscribe to push notifications
3. **Preference Setting**: Test different threshold categories
4. **Manual Trigger**: Send test notification
5. **Click Handling**: Verify notification click navigation

##### Cron & Timing Testing
```bash
# Test different timezone scenarios
const testTimezones = [
  'America/New_York',    # EST/EDT
  'Europe/London',       # GMT/BST
  'Asia/Tokyo',          # JST
  'America/Los_Angeles', # PST/PDT
  'Australia/Sydney'     # AEST/AEDT
]

# Test quiet hours spanning midnight
# Setup: quietHours: 22:00-08:00
# Test times: 23:30 (should be quiet), 07:30 (should be quiet), 15:30 (should not be quiet)
```

---

## 🔧 Debug Tools & Controls

### Development Mode Detection

All debug tools automatically detect development environment:

```typescript
const isDev = process.env.NODE_ENV === 'development'
const isClient = typeof window !== 'undefined'

// Debug tools only available in development
if (isDev && isClient) {
  console.log('🔧 Development mode active')
  console.log('🛠️ Debug tools available')
}
```

### Floating Debug Interface

#### **Access Methods**
1. **Purple beaker icon** - Bottom-right corner (auto-appears in dev)
2. **Keyboard shortcut** - `Ctrl/Cmd + Shift + D`
3. **URL parameter** - `?debug=true`

#### **Debug Panel Features**
- **System Status**: Real-time server time, timezone, user preferences
- **Quick Actions**: Manual triggers for all major systems
- **Preset Scenarios**: One-click setup for common test cases
- **Console Helpers**: Copy-paste commands for advanced testing

### Service Worker Debug Controls

#### **Available in Development Mode**
1. **Force SW Update** - Manually triggers service worker update check
2. **Force SW Control** - Forces service worker to take control of page
3. **Manual Refresh** - Simple page reload functionality
4. **Debug SW** - Comprehensive service worker state logging
5. **Test SW Message** - Tests message passing between page and SW

#### **Enhanced Composable Features**
```typescript
const {
  // Production functions (always available)
  updateAvailable,
  isUpdating,
  checkForUpdates,
  applyUpdate,

  // Development functions (dev mode only)
  forceServiceWorkerUpdate,
  forceServiceWorkerControl,
  manualRefresh,
  debugServiceWorker
} = useServiceWorkerUpdates()
```

### Spaced Repetition Debug Controls

#### **Algorithm Testing Panel**
Access via gear icon during card review:

```typescript
// Debug functions available
{
  applyValues: (params: DebugParams) => Promise<void>,
  resetCard: () => Promise<void>,
  loadPreset: (preset: PresetName) => Promise<void>,
  getCurrentState: () => Promise<CardState>,
  testAlgorithm: (grade: number) => Promise<AlgorithmResult>
}
```

#### **Preset Testing Scenarios**
- **New Card**: Fresh enrollment state
- **Learning Card**: Early stage learning (1-2 repetitions)
- **Review Card**: Established card (3+ repetitions)
- **Difficult Card**: Low ease factor (hard to remember)
- **Easy Card**: High ease factor (easy to remember)

---

## ⚙️ Service Worker Development

### Development Workflow

#### **Local Development**
```bash
# Build service worker
yarn sw:build

# Start dev server (auto-rebuilds SW)
yarn dev

# Test PWA features
open http://localhost:3000?standalone=true
```

#### **Service Worker Debug Tools**
```javascript
// Browser console debugging
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => {
    console.log('SW Registration:', reg)
    console.log('SW State:', reg.active?.state)
    console.log('SW Script URL:', reg.active?.scriptURL)
  })
})

// Test service worker messages
navigator.serviceWorker.controller?.postMessage({
  type: 'TEST_MESSAGE',
  payload: { test: true }
})
```

#### **Update Testing**
1. Make changes to `sw-src/index.ts`
2. Run `yarn sw:build`
3. Refresh browser
4. Check for update notification
5. Test update application flow

### Service Worker Debugging

#### **Common Debug Scenarios**
```typescript
// Test caching strategies
const testCache = async () => {
  const cache = await caches.open('test-cache')
  await cache.add('/api/test')
  const response = await cache.match('/api/test')
  console.log('Cached response:', response)
}

// Test background sync
const testBackgroundSync = async () => {
  const registration = await navigator.serviceWorker.ready
  if ('sync' in registration) {
    await registration.sync.register('test-sync')
    console.log('Background sync registered')
  }
}

// Test push notifications
const testPushMessage = async () => {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  console.log('Push subscription:', subscription?.toJSON())
}
```

---

## 📱 Offline Functionality Testing

### Manual Offline Testing

#### **Basic Offline Flow**
1. **Open browser dev tools** → Network tab
2. **Set to "Offline"**
3. **Navigate the app** - should work fully offline
4. **Submit forms** - should queue for background sync
5. **Test service worker** - verify offline pages load
6. **Re-enable network** - verify sync occurs

#### **Offline Test Scenarios**
```typescript
// Test offline form submission
const testOfflineForm = async () => {
  // 1. Go offline
  // 2. Fill out a form
  // 3. Submit (should queue)
  // 4. Go online
  // 5. Verify form submission occurs
}

// Test offline navigation
const testOfflineNavigation = async () => {
  // 1. Go offline
  // 2. Navigate between pages
  // 3. Verify all pages load from cache
  // 4. Check offline fallback page
}
```

### Automated Offline Testing

#### **Playwright Tests**
```bash
# Run comprehensive offline tests
yarn test:pwa-offline

# Run basic PWA tests
yarn test:pwa-basic
```

#### **Test Coverage**
- ✅ Page navigation while offline
- ✅ Form submission queuing
- ✅ Service worker activation
- ✅ Cache functionality
- ✅ Background sync
- ✅ Offline fallback pages

---

## ⚡ Performance Testing

### Key Performance Metrics

#### **Load Time Benchmarks**
- **Initial page load**: < 2 seconds
- **Service worker activation**: < 500ms
- **Debug panel open**: < 300ms
- **API response times**: < 200ms
- **Database queries**: < 100ms

#### **Performance Testing Tools**
```bash
# Lighthouse CI
npx lighthouse http://localhost:3000 --output=json

# Bundle analysis
yarn build && npx nuxt analyze

# Memory profiling
# Use browser dev tools → Performance tab
```

#### **Performance Debug Commands**
```javascript
// Monitor memory usage
const monitorMemory = () => {
  if (performance.memory) {
    console.log('Used JS heap:', performance.memory.usedJSHeapSize)
    console.log('Total JS heap:', performance.memory.totalJSHeapSize)
    console.log('Heap limit:', performance.memory.jsHeapSizeLimit)
  }
}

// Monitor network performance
const monitorNetwork = () => {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      console.log('Network timing:', entry.name, entry.duration)
    })
  })
  observer.observe({ entryTypes: ['navigation', 'resource'] })
}
```

### Cron System Performance

#### **Performance Optimization**
- **Reduced frequency**: Every 15 minutes (not 1 minute)
- **Batch processing**: Process multiple users efficiently
- **Database indexing**: Optimized queries
- **Timezone caching**: Cache timezone calculations

#### **Performance Monitoring**
```typescript
// Monitor cron performance
const monitorCronPerformance = async () => {
  const startTime = performance.now()

  // Run cron task
  await checkDueCards()

  const duration = performance.now() - startTime
  console.log(`Cron task completed in ${duration}ms`)
}
```

---

## 🌐 Browser Compatibility

### Supported Browsers

#### **Primary Support**
- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

#### **Mobile Support**
- **iOS Safari**: iOS 14+
- **Chrome Mobile**: Latest
- **Samsung Internet**: Latest

### Feature Detection

```typescript
// Check for PWA features
const checkPWASupport = () => {
  const support = {
    serviceWorker: 'serviceWorker' in navigator,
    pushNotifications: 'PushManager' in window,
    backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
    periodicSync: 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype,
    installPrompt: 'onbeforeinstallprompt' in window
  }

  console.table(support)
  return support
}
```

### Cross-Browser Testing

#### **Testing Checklist**
- ✅ Service worker registration
- ✅ Push notification permissions
- ✅ Keyboard shortcuts
- ✅ Offline functionality
- ✅ Install prompt
- ✅ Background sync
- ✅ Responsive design

#### **Known Issues & Workarounds**
```typescript
// Safari-specific workarounds
const safariWorkarounds = () => {
  // Safari doesn't support background sync
  if (isSafari) {
    console.warn('Background sync not supported in Safari')
    // Implement alternative strategy
  }

  // Safari push notification quirks
  if (isSafari && Notification.permission === 'denied') {
    console.warn('Safari may require user gesture for notifications')
  }
}
```

---

## 🐛 Debugging Workflows

### Systematic Debugging Approach

#### **1. Issue Identification**
```typescript
// Gather system information
const gatherDebugInfo = () => {
  const info = {
    userAgent: navigator.userAgent,
    serviceWorker: !!navigator.serviceWorker.controller,
    notifications: Notification.permission,
    online: navigator.onLine,
    connection: navigator.connection?.effectiveType,
    memory: performance.memory?.usedJSHeapSize,
    timestamp: new Date().toISOString()
  }

  console.table(info)
  return info
}
```

#### **2. Component-Specific Debugging**

##### **PWA Issues**
```bash
# Check service worker status
open chrome://inspect/#service-workers

# Clear service worker cache
# Application tab → Storage → Clear storage

# Test PWA installation
# Application tab → Manifest
```

##### **Notification Issues**
```javascript
// Debug notification permissions
const debugNotifications = async () => {
  console.log('Permission:', Notification.permission)

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    console.log('Subscription:', subscription?.toJSON())
  }
}
```

##### **Spaced Repetition Issues**
```typescript
// Debug algorithm calculations
const debugSRAlgorithm = (cardData, grade) => {
  const oldState = { ...cardData }
  const newState = calculateSM2(cardData, grade)

  console.group('SM-2 Algorithm Debug')
  console.log('Input:', oldState)
  console.log('Grade:', grade)
  console.log('Output:', newState)
  console.log('Interval change:', newState.intervalDays - oldState.intervalDays)
  console.groupEnd()
}
```

### Debug Console Commands

#### **Quick Debug Functions**
```javascript
// Add these to browser console for quick debugging

// Test all systems
const debugAll = async () => {
  await debugNotifications()
  await debugServiceWorker()
  await debugDatabase()
  await debugPerformance()
}

// Test API endpoints
const testAPIs = async () => {
  const endpoints = [
    '/api/review/queue',
    '/api/notifications/subscriptions',
    '/api/admin/cron'
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint)
      console.log(`${endpoint}:`, response.status)
    } catch (error) {
      console.error(`${endpoint}:`, error.message)
    }
  }
}

// Monitor real-time events
const monitorEvents = () => {
  const events = ['online', 'offline', 'visibilitychange', 'beforeunload']
  events.forEach(event => {
    window.addEventListener(event, (e) => {
      console.log(`Event: ${event}`, e)
    })
  })
}
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

#### **Build Verification**
```bash
# Complete build process
yarn build:inject

# Verify service worker injection
grep -q "workbox-" .output/public/sw.js && echo "✅ Workbox injected"

# Test production build locally
yarn preview
```

#### **Environment Configuration**
```bash
# Production environment variables
NODE_ENV=production
ENABLE_CRON=true
CRON_CHECK_DUE_CARDS_SCHEDULE="*/15 * * * *"

# Remove debug flags
unset DEBUG_NOTIFICATIONS
unset DEBUG_TIMEZONE_CALCULATIONS
```

#### **Security Checklist**
- ✅ VAPID keys properly configured
- ✅ CRON_SECRET_TOKEN set
- ✅ Debug endpoints disabled in production
- ✅ Rate limiting enabled
- ✅ HTTPS required for PWA features

### Deployment Validation

#### **Post-Deployment Tests**
```bash
# Test PWA installation
curl -I https://your-domain.com/manifest.webmanifest

# Test service worker
curl -I https://your-domain.com/sw.js

# Test notification endpoint (with auth)
curl -X POST https://your-domain.com/api/notifications/send \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Production Test", "body": "Deployment verification"}'
```

#### **Monitoring Setup**
```typescript
// Production error tracking
const setupErrorMonitoring = () => {
  window.addEventListener('error', (event) => {
    // Send to error tracking service
    console.error('Production error:', event.error)
  })

  window.addEventListener('unhandledrejection', (event) => {
    // Send to error tracking service
    console.error('Unhandled promise rejection:', event.reason)
  })
}
```

---

## 🚨 Emergency Procedures

### Service Worker Emergency Reset

```javascript
// Emergency service worker cleanup
const emergencyServiceWorkerReset = async () => {
  // Unregister all service workers
  const registrations = await navigator.serviceWorker.getRegistrations()
  for (const registration of registrations) {
    await registration.unregister()
  }

  // Clear all caches
  const cacheNames = await caches.keys()
  for (const cacheName of cacheNames) {
    await caches.delete(cacheName)
  }

  // Clear storage
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    await navigator.storage.persist()
  }

  console.log('🚨 Emergency SW reset complete')
  location.reload()
}
```

### Database Emergency Procedures

```bash
# Emergency subscription cleanup
yarn notifications:cleanup

# Reset all spaced repetition data
# CAUTION: This will reset all user progress
db.CardReview.updateMany({}, {
  $set: {
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    nextReviewAt: new Date()
  }
})
```

### System Health Check

```typescript
// Complete system health check
const systemHealthCheck = async () => {
  const health = {
    database: await checkDatabaseConnection(),
    serviceWorker: await checkServiceWorkerStatus(),
    notifications: await checkNotificationSystem(),
    cron: await checkCronStatus(),
    performance: await checkPerformanceMetrics()
  }

  console.table(health)
  return health
}
```

---

## 📚 Additional Development Resources

### Documentation Links
- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- [PWA Best Practices](https://web.dev/pwa-checklist/)

### Development Tools
- **Browser DevTools**: Essential for debugging
- **Lighthouse**: PWA auditing
- **Workbox DevTools**: Service worker debugging
- **Vue DevTools**: Component debugging
- **Prisma Studio**: Database visualization

### Community Resources
- [PWA Builder](https://www.pwabuilder.com/)
- [Web.dev PWA Guides](https://web.dev/progressive-web-apps/)
- [MDN Service Worker Guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

*Last updated: September 2025*
