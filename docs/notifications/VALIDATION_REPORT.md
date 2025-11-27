# Notifications Category - Validation Report

**Date:** October 23, 2025  
**Status:** ✅ Confirmed with Minor Notes

---

## Documents Validated

1. **NOTIFICATIONS.md** - Main notification system documentation
2. **CRON_TIMING.md** - Cron job timing and scheduling
3. **Archive docs** (7 historical documents)

---

## Validation Results

### ✅ Architecture & Components - CONFIRMED

**What the docs claim:**
- Client-side composables: `useNotifications.ts`, `useServiceWorkerBridge.ts`
- Server APIs: subscribe, unsubscribe, send, preferences, subscriptions
- Service worker push handling in `sw-src/index.ts`
- Prisma models: `NotificationSubscription`, `UserNotificationPreferences`

**Actual implementation:**
- ✅ All files exist at documented paths
- ✅ API endpoints match (subscribe.ts, unsubscribe.ts, preferences.ts, subscriptions.get.ts, send.post.ts)
- ✅ Service worker handles push events in `sw-src/index.ts`
- ✅ Prisma schema includes all documented models

**Status:** Perfect match

---

### ✅ User Preferences & Thresholds - CONFIRMED

**What the docs claim:**
- Threshold categories: Instant Learner (1+), Steady Studier (3+), Focused Reviewer (5+), Batch Processor (10+), Power Learner (20+)
- Default threshold: 5 cards
- Range: 1-100 cards

**Actual implementation:**
```prisma
cardDueThreshold  Int  @default(5) // Notify when >= 5 cards due
```
```typescript
// In preferences.ts validation
cardDueThreshold: z.number().min(1).max(100)
```

**Status:** Perfect match - code implements exactly what docs describe

---

### ✅ Cron Logic - CONFIRMED

**What the docs claim:**
- Checks users with `cardDueEnabled: true`
- Respects `cardDueThreshold` (minimum cards)
- Honors quiet hours and timezone settings
- Uses `ENABLE_CRON` and `CRON_SECRET_TOKEN` env vars
- Prevents duplicate notifications (cooldown period)

**Actual implementation in `server/tasks/check-due-cards.ts`:**
```typescript
// 1. Query users with notifications enabled
const usersWithPref = await prisma.userNotificationPreferences.findMany({
  where: { cardDueEnabled: true }
})

// 2. Check quiet hours
if (userPref.quietHoursEnabled && isInQuietHoursTimezone(...)) {
  continue // Skip
}

// 3. Check threshold
if (dueCards.length < userPref.cardDueThreshold) {
  continue // Skip - not enough cards
}

// 4. Check cooldown (recent notification)
const recentNotification = await prisma.scheduledNotification.findFirst({
  where: {
    userId: userPref.userId,
    type: "CARD_DUE",
    scheduledFor: { gte: new Date(now.getTime() - 1 * 60 * 1000) }
  }
})
```

**Status:** Perfect match - all documented logic is implemented

---

### ✅ Database Schema - CONFIRMED

**What the docs claim:**
```prisma
model NotificationSubscription {
  id, endpoint, keys, userId, createdAt, expiresAt, 
  isActive, failureCount, lastSeen, userAgent, deviceInfo
}

model UserNotificationPreferences {
  cardDueEnabled, cardDueThreshold, cardDueTime, timezone,
  quietHoursEnabled, quietHoursStart, quietHoursEnd,
  dailyReminderEnabled, dailyReminderTime
}
```

**Actual schema:**
- ✅ `NotificationSubscription` - all fields match
- ✅ `UserNotificationPreferences` - all fields match
- ✅ Additional fields documented: `sendAnytimeOutsideQuietHours`, `activeHoursEnabled`, `activeHoursStart`, `activeHoursEnd`
- ✅ `ScheduledNotification` model exists (used for tracking sent notifications)

**Note:** Docs could add `ScheduledNotification` model to schema section

---

### ✅ API Endpoints - CONFIRMED

**Documented endpoints:**
- `POST /api/notifications/subscribe` ✅
- `POST /api/notifications/unsubscribe` ✅
- `POST /api/notifications/send` ✅
- `GET /api/notifications/preferences` ✅
- `PUT /api/notifications/preferences` ✅
- `GET /api/notifications/subscriptions` ✅

**Actual implementation:**
- All endpoints exist
- Method handling matches (GET/PUT in preferences.ts using `getMethod()`)
- Request/response shapes match Zod schemas

---

### ✅ Advanced Timing Features - CONFIRMED (Added after initial validation)

**What the code implements:**
```prisma
// In UserNotificationPreferences model
sendAnytimeOutsideQuietHours Boolean @default(false)
activeHoursEnabled           Boolean @default(false)
activeHoursStart             String  @default("09:00")
activeHoursEnd               String  @default("21:00")
```

**Implementation details:**
1. **Send Anytime Outside Quiet Hours** (`sendAnytimeOutsideQuietHours`)
   - When enabled: Ignores `cardDueTime`, sends anytime outside quiet hours
   - When disabled: Only sends during 15-min window around `cardDueTime`
   - Logic in `check-due-cards.ts` line 85: `if (!userPref.sendAnytimeOutsideQuietHours)`
   - UI toggle in `NotificationPreferences.vue`
   
2. **Active Hours** (`activeHoursEnabled`, `activeHoursStart`, `activeHoursEnd`)
   - Defines window when notifications are allowed (e.g., 09:00-21:00)
   - Works with Send Anytime to restrict notification times
   - Logic in `check-due-cards.ts` line 99: `if (userPref.activeHoursEnabled)`
   - Time pickers in `NotificationPreferences.vue`
   - Debug dashboard shows `inActiveHours` gate status

**Precedence Rules (from test scenarios):**
1. Quiet Hours always block (highest priority)
2. Send Anytime ON + Active Hours OFF → Send anytime outside Quiet Hours
3. Send Anytime ON + Active Hours ON → Send only during Active Hours and outside Quiet Hours
4. Send Anytime OFF + Active Hours OFF → Send near Card Due Time, outside Quiet Hours
5. Send Anytime OFF + Active Hours ON → Card Due Time must be inside Active Hours

**Status:** ✅ Fully implemented but not documented in main NOTIFICATIONS.md

---

### ⚠️ Minor Discrepancies

1. **IndexedDB reference in data flow diagram**
  - Clarification: IndexedDB is used for the offline form queue and notes persistence via `app/utils/idb.ts` (shared between client and SW).
  - Reality: Notifications do not persist messages in IndexedDB; they rely on push payloads + click handling.
  - **Impact:** Low - diagram adjusted in PWA docs; cross-reference added
   
2. **ScheduledNotification model not documented**
   - Exists in schema and is actively used
   - Tracks notification history and cooldowns
   - **Impact:** Low - should add to schema section

3. **Advanced timing features not in main docs**
   - `sendAnytimeOutsideQuietHours` and Active Hours are fully implemented
   - Only documented in test scenarios, not in NOTIFICATIONS.md
   - **Impact:** Medium - users don't know these features exist

---

## Summary

**Overall Status:** ✅ **Confirmed**

The notification system implementation matches the documentation almost perfectly. The core features, logic flow, database schema, and API contracts are all accurately documented.

**Required improvements:**
- ✅ Document `sendAnytimeOutsideQuietHours` feature in NOTIFICATIONS.md
- ✅ Document Active Hours feature in NOTIFICATIONS.md
- ✅ Add precedence rules and timing logic flow
- ✅ Clarify IndexedDB usage in data flow (form sync & notes vs notifications)
- ⚠️ Document `ScheduledNotification` model in schema section

**Code quality:** Excellent - implements exactly what docs promise with proper validation, error handling, and type safety.

---

## Next Steps

1. ✅ Notifications validated
2. ⏭️ Validate PWA category next
