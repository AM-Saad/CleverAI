# 🔔 Notification System Revision Plan

## Executive Summary

This document outlines comprehensive improvements to CleverAI's notification system from both Service Worker/PWA and server perspectives. The current implementation has web-push library integrated but NotificationScheduler.ts still has TODO comments for actual push sending.

---

## Current State Analysis

### ✅ What Works Well
1. **Web-push library** - Already installed and configured in `send.post.ts`
2. **VAPID keys** - Properly configured with environment variables
3. **Subscription management** - Complete lifecycle with database persistence
4. **User preferences** - Comprehensive preference system with thresholds
5. **SW event handlers** - Push and notificationclick events properly implemented
6. **Cron integration** - check-due-cards task working with proper timing logic
7. **Authorization** - Proper auth checks for API endpoints
8. **MongoDB schema** - Well-indexed notification models

### ❌ Issues Found

#### 1. **NotificationScheduler.ts Not Using Web-Push** (Critical)
- **Location**: `server/services/NotificationScheduler.ts:233`
- **Issue**: `sendPushNotification()` function only logs, doesn't actually send
- **Impact**: Scheduler creates notifications in DB but never delivers them
- **Fix**: Replace TODO with actual web-push.sendNotification() calls

#### 2. **Duplicate Notification Logic** (Code Smell)
- **Location**: `check-due-cards.ts` vs `NotificationScheduler.ts`
- **Issue**: Two different notification sending implementations
- **Impact**: Inconsistent error handling, harder to maintain
- **Fix**: Consolidate into single service layer

#### 3. **No Subscription Health Checks** (Reliability)
- **Location**: Multiple subscription endpoints
- **Issue**: Stale subscriptions accumulate, no automatic cleanup
- **Impact**: Failed sends to expired endpoints, inflated metrics
- **Fix**: Add health check cron, mark stale subscriptions

#### 4. **Limited SW Notification Actions** (UX)
- **Location**: `sw-src/index.ts:714-764`
- **Issue**: No action buttons on notifications
- **Impact**: Users can only click to open, no quick actions
- **Fix**: Add "Review Now", "Snooze", "Dismiss" actions

#### 5. **No Delivery Tracking** (Observability)
- **Location**: Entire notification flow
- **Issue**: No way to track if notifications were actually delivered/displayed
- **Impact**: Can't debug user reports, no metrics
- **Fix**: Add NotificationDelivery model, track states

#### 6. **Missing Badge Updates** (PWA)
- **Location**: `sw-src/index.ts` push handler
- **Issue**: App badge not updated when notifications arrive
- **Impact**: Users don't see pending review count in app icon
- **Fix**: Use Badge API in SW to update badge count

#### 7. **Error Handling Inconsistencies** (Reliability)
- **Location**: Multiple endpoints
- **Issue**: Some places retry, some don't; inconsistent logging
- **Impact**: Silent failures, hard to debug
- **Fix**: Standardize error handling with proper logging

#### 8. **No Notification Preferences Validation** (Security)
- **Location**: `api/notifications/preferences.ts`
- **Issue**: Minimal validation on user input
- **Impact**: Could store invalid thresholds/times
- **Fix**: Add Zod schemas for preference updates

---

## Implementation Plan

### Phase 1: Core Fixes (High Priority)

#### Task 1.1: Fix NotificationScheduler Web-Push Integration
**Files**: `server/services/NotificationScheduler.ts`
**Goal**: Replace TODO with actual web-push implementation

```typescript
// Current (broken)
async function sendPushNotification(subscription: any, content: NotificationContent) {
  console.log(`Would send notification to ${subscription.endpoint}:`, content)
  // TODO: Implement actual web push when ready
}

// New (working)
async function sendPushNotification(
  subscription: NotificationSubscription,
  content: NotificationContent
): Promise<{ success: boolean; error?: string }> {
  try {
    const webPush = await import('web-push').then(m => m.default)
    
    // Configure VAPID if not already done
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured')
    }
    
    webPush.setVapidDetails(
      'mailto:abdelrhmanm525@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const payload = JSON.stringify({
      title: content.title,
      body: content.body,
      icon: content.icon || '/icons/icon-192x192.png',
      badge: content.badge || '/icons/badge-72x72.png',
      tag: content.tag,
      data: content.data
    })

    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      payload
    )

    return { success: true }
  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    console.error('Push send failed:', err)
    
    // Handle expired subscriptions
    if (err.statusCode === 410 || err.statusCode === 404) {
      await markSubscriptionInactive(subscription.id, 'Endpoint expired')
    }
    
    return { success: false, error: err.message }
  }
}
```

#### Task 1.2: Consolidate Notification Sending
**Files**: Create `server/services/PushNotificationService.ts`
**Goal**: Single source of truth for push notifications

```typescript
// New centralized service
export class PushNotificationService {
  private webPush: typeof import('web-push').default
  
  async initialize() {
    this.webPush = await import('web-push').then(m => m.default)
    this.webPush.setVapidDetails(
      'mailto:abdelrhmanm525@gmail.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
  }
  
  async sendToUser(userId: string, content: NotificationContent) {
    // Get all active subscriptions
    // Send to each
    // Track delivery
    // Handle failures
  }
  
  async sendToSubscription(sub: Subscription, content: NotificationContent) {
    // Single subscription send
    // Error handling
    // Retry logic
  }
}
```

#### Task 1.3: Add Notification Actions
**Files**: `sw-src/index.ts`
**Goal**: Add interactive notification buttons

```typescript
// In push event handler
const options: NotificationOptions = {
  body: data.message || 'You have cards to review!',
  icon: data.icon || '/icons/192x192.png',
  badge: '/icons/badge-72x72.png',
  tag: data.tag || 'card-review',
  requireInteraction: false,
  data: {
    url: data.url || '/review',
    timestamp: Date.now(),
    originalData: data
  },
  actions: [
    {
      action: 'review',
      title: '📚 Review Now',
      icon: '/icons/review-action.png'
    },
    {
      action: 'snooze',
      title: '⏰ Snooze 1hr',
      icon: '/icons/snooze-action.png'
    },
    {
      action: 'dismiss',
      title: '❌ Dismiss',
      icon: '/icons/dismiss-action.png'
    }
  ]
}

// Handle actions in notificationclick
swSelf.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  
  const action = event.action
  const data = event.notification.data
  
  event.waitUntil((async () => {
    if (action === 'snooze') {
      // Create snooze request
      await fetch('/api/notifications/snooze', {
        method: 'POST',
        body: JSON.stringify({ duration: 3600 })
      })
      return
    }
    
    if (action === 'dismiss') {
      // Just close, no action
      return
    }
    
    // Default or 'review' action
    const targetUrl = data?.url || '/review'
    const clients = await swSelf.clients.matchAll({ type: 'window' })
    
    if (clients.length) {
      clients[0].postMessage({ type: 'NOTIFICATION_CLICK_NAVIGATE', url: targetUrl })
      await (clients[0] as WindowClient).focus()
    } else {
      await swSelf.clients.openWindow(targetUrl)
    }
  })())
})
```

### Phase 2: Subscription Lifecycle (Medium Priority)

#### Task 2.1: Add Subscription Health Checks
**Files**: Create `server/tasks/check-subscription-health.ts`

```typescript
export async function checkSubscriptionHealth() {
  // Find subscriptions not seen in 30 days
  const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const staleSubs = await prisma.notificationSubscription.findMany({
    where: {
      OR: [
        { lastSeen: { lt: staleDate } },
        { lastSeen: null, createdAt: { lt: staleDate } }
      ],
      isActive: true
    }
  })
  
  // Mark as inactive (don't delete - keep for history)
  await prisma.notificationSubscription.updateMany({
    where: {
      id: { in: staleSubs.map(s => s.id) }
    },
    data: {
      isActive: false,
      failureCount: { increment: 1 }
    }
  })
  
  return { marked: staleSubs.length }
}
```

#### Task 2.2: Add Auto Re-subscription Logic
**Files**: `app/composables/useNotifications.ts`

```typescript
// Check subscription health on app load
onMounted(async () => {
  if (isSubscribed.value) {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // Subscription lost - auto re-register
      console.warn('Subscription lost, attempting re-registration')
      await registerNotification()
    } else {
      // Ping server to update lastSeen
      await $fetch('/api/notifications/ping', {
        method: 'POST',
        body: { endpoint: subscription.endpoint }
      })
    }
  }
})
```

### Phase 3: Monitoring & Analytics (Low Priority)

#### Task 3.1: Add Delivery Tracking
**Files**: `server/prisma/schema.prisma`, `server/services/PushNotificationService.ts`

```prisma
model NotificationDelivery {
  id                    String   @id @default(auto()) @map("_id") @db.ObjectId
  scheduledNotificationId String  @db.ObjectId
  subscriptionId        String   @db.ObjectId
  
  sentAt                DateTime?
  deliveredAt           DateTime? // When SW confirmed receipt
  clickedAt             DateTime? // When user clicked
  
  status                NotificationStatus // PENDING, SENT, DELIVERED, CLICKED, FAILED
  errorMessage          String?
  
  @@index([scheduledNotificationId])
  @@index([subscriptionId])
  @@index([status, sentAt])
}

enum NotificationStatus {
  PENDING
  SENT
  DELIVERED
  CLICKED
  FAILED
}
```

#### Task 3.2: Add Badge API Support
**Files**: `sw-src/index.ts`

```typescript
// In push event handler, after showing notification
try {
  // Get current due cards count from notification data
  const dueCount = data.dueCardsCount || 0
  
  if ('setAppBadge' in navigator) {
    await (navigator as any).setAppBadge(dueCount)
  }
} catch (badgeError) {
  console.warn('Badge update failed:', badgeError)
}

// Clear badge when user visits review page
swSelf.addEventListener('message', async (event) => {
  if (event.data?.type === 'CLEAR_BADGE') {
    try {
      if ('clearAppBadge' in navigator) {
        await (navigator as any).clearAppBadge()
      }
    } catch (e) { /* ignore */ }
  }
})
```

#### Task 3.3: Create Debug Dashboard
**Files**: Create `app/pages/debug/notifications.vue`

```vue
<template>
  <div class="notification-debug">
    <h1>Notification System Debug</h1>
    
    <section>
      <h2>Subscription Status</h2>
      <pre>{{ subscriptionInfo }}</pre>
      <button @click="testNotification">Send Test Notification</button>
    </section>
    
    <section>
      <h2>Recent Deliveries</h2>
      <table>
        <thead>
          <tr>
            <th>Sent At</th>
            <th>Status</th>
            <th>Title</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="delivery in recentDeliveries" :key="delivery.id">
            <td>{{ formatDate(delivery.sentAt) }}</td>
            <td>{{ delivery.status }}</td>
            <td>{{ delivery.title }}</td>
            <td>
              <button @click="viewDetails(delivery)">Details</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
```

### Phase 4: Testing (Ongoing)

#### Task 4.1: Unit Tests
- Test NotificationScheduler with mocked web-push
- Test subscription lifecycle methods
- Test preference validation

#### Task 4.2: Integration Tests  
- Test full notification flow end-to-end
- Test cron → scheduler → web-push → SW
- Test error handling and retries

#### Task 4.3: E2E Tests (Playwright)
- Test notification permission flow
- Test notification display
- Test notification click navigation
- Test notification actions

---

## Migration Strategy

### Step 1: Feature Flags
Add feature flags to gradually roll out changes:

```typescript
const FEATURE_FLAGS = {
  USE_NEW_PUSH_SERVICE: process.env.ENABLE_NEW_PUSH_SERVICE === 'true',
  ENABLE_NOTIFICATION_ACTIONS: process.env.ENABLE_NOTIFICATION_ACTIONS === 'true',
  ENABLE_BADGE_API: process.env.ENABLE_BADGE_API === 'true',
  ENABLE_DELIVERY_TRACKING: process.env.ENABLE_DELIVERY_TRACKING === 'true',
}
```

### Step 2: Parallel Running
Run old and new systems in parallel, log differences:

```typescript
// Send via both old and new, compare results
if (FEATURE_FLAGS.USE_NEW_PUSH_SERVICE) {
  await sendViaNewService()
} else {
  await sendViaOldService()
}
```

### Step 3: Gradual Rollout
- Week 1: 10% of users
- Week 2: 25% of users
- Week 3: 50% of users
- Week 4: 100% of users

### Step 4: Monitoring
Track key metrics:
- Notification send rate
- Delivery success rate
- Click-through rate
- Error rate
- Subscription churn rate

---

## Success Metrics

### Before
- ❌ NotificationScheduler doesn't send push notifications
- ❌ No way to track delivery
- ❌ Stale subscriptions accumulate
- ❌ Basic notifications with no actions
- ❌ No badge updates

### After
- ✅ All notifications sent via web-push
- ✅ Complete delivery tracking
- ✅ Automatic subscription cleanup
- ✅ Rich notifications with actions
- ✅ Badge API integration
- ✅ Comprehensive monitoring dashboard
- ✅ 99%+ delivery success rate
- ✅ <5% error rate

---

## Timeline

- **Phase 1 (Week 1-2)**: Core fixes - web-push integration, consolidation, actions
- **Phase 2 (Week 3)**: Subscription lifecycle - health checks, auto re-subscription
- **Phase 3 (Week 4)**: Monitoring - delivery tracking, dashboard, badges
- **Phase 4 (Ongoing)**: Testing - unit, integration, e2e tests

---

## Risks & Mitigations

### Risk 1: Breaking Existing Notifications
**Mitigation**: Feature flags, parallel running, gradual rollout

### Risk 2: Performance Impact
**Mitigation**: Batch operations, queue notifications, rate limiting

### Risk 3: Browser Compatibility
**Mitigation**: Feature detection, graceful degradation, polyfills

### Risk 4: User Notification Fatigue
**Mitigation**: Respect quiet hours, threshold system, easy opt-out

---

## Next Steps

1. ✅ Review this plan with team
2. 🔄 Start with Phase 1, Task 1.1 (Fix NotificationScheduler)
3. 🔄 Add unit tests as we go
4. 🔄 Update documentation continuously
5. 🔄 Monitor metrics after each deployment

---

## References

- [Web Push Protocol RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292)
- [Push API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Badge API Spec](https://w3c.github.io/badging/)
