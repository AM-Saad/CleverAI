# 🧪 Complete Testing Scenarios for CleverAI Timing & SR System

## 📋 **Test Setup Requirements**

### **🔧 Prerequisites**
1. **Development Server**: `yarn dev` running on port 3000+ (required for debug controls)
2. **Database Access**: Prisma client connected and migrations applied
3. **Test Environment**: `.env.local` or `.env` configured for testing
4. **Browser Tools**: Chrome/Firefox with developer console access
5. **Test User Account**: Create or use existing user for notification testing
6. **Push Notifications**: Browser permission granted for notification testing

### **🌐 Environment Configuration**
```bash
# .env or .env.local - Essential settings for testing
NODE_ENV=development                                  # Enables testing dashboard
CRON_CHECK_DUE_CARDS_SCHEDULE=*/15 * * * *           # Every 15 minutes (NOT */1!)
CRON_CHECK_DUE_CARDS_TIMEZONE=UTC                    # Server cron timezone
ENABLE_CRON=true                                      # Enable cron system
CRON_SECRET_TOKEN=test-secret-token-for-debugging    # Security for manual triggers

# Database
DATABASE_URL="your-database-connection-string"

# Optional: Enhanced logging for testing
DEBUG_NOTIFICATIONS=true
DEBUG_TIMEZONE_CALCULATIONS=true
```

### **🗄️ Database Preparation**
```sql
-- Ensure all required columns exist (run if missing)
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS cardDueTime VARCHAR(5) DEFAULT '09:00';
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS cardDueThreshold INTEGER DEFAULT 5;
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS quietHoursEnabled BOOLEAN DEFAULT false;
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS quietHoursStart VARCHAR(5) DEFAULT '22:00';
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS quietHoursEnd VARCHAR(5) DEFAULT '08:00';
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS dailyReminderEnabled BOOLEAN DEFAULT false;
ALTER TABLE UserNotificationPreferences ADD COLUMN IF NOT EXISTS dailyReminderTime VARCHAR(5) DEFAULT '19:00';

-- Create test user preferences if needed
INSERT INTO UserNotificationPreferences (userId, cardDueEnabled, timezone, cardDueTime, cardDueThreshold)
VALUES ('your-test-user-id', true, 'America/New_York', '09:00', 5)
ON CONFLICT (userId) DO UPDATE SET
  cardDueEnabled = EXCLUDED.cardDueEnabled,
  timezone = EXCLUDED.timezone,
  cardDueTime = EXCLUDED.cardDueTime,
  cardDueThreshold = EXCLUDED.cardDueThreshold;
```

### **🧪 Test Data Setup**
```typescript
// Use this in browser console to quickly create test data
const createTestCards = async (count = 5) => {
  for (let i = 0; i < count; i++) {
    // Navigate to review interface and use debug panel
    // Set cards with different due dates for comprehensive testing
    await new Promise(resolve => setTimeout(resolve, 1000)) // Delay between creations
  }
}

// Quick timezone testing helper
const testTimezones = [
  'America/New_York',    // EST/EDT (UTC-5/-4)
  'Europe/London',       // GMT/BST (UTC+0/+1)
  'Asia/Tokyo',          // JST (UTC+9)
  'America/Los_Angeles', // PST/PDT (UTC-8/-7)
  'Australia/Sydney'     // AEST/AEDT (UTC+10/+11)
]

testTimezones.forEach(tz => {
  console.log(`${tz}: ${new Date().toLocaleString('en-US', {timeZone: tz})}`)
})
```

---

## 🎯 **Scenario 1: New User Experience (Default Settings)**

### 1.1 Setup Notification Preferences
**Goal**: Test default user experience with timezone awareness

**Steps**:
1. Navigate to **Settings → Notification Preferences**
2. Configure these settings:
   ```
   📚 Card Due Notifications: ✅ ENABLED
   ⏰ Notification Time: 09:00 (9 AM)
   🎯 Threshold: "Focused Reviewer" (5 cards)
   🌍 Timezone: America/New_York (EST/EDT)
   🤫 Quiet Hours: ✅ ENABLED (22:00 - 08:00)
   📅 Daily Reminders: ✅ ENABLED (19:00 - 7 PM)
   ```

**Expected UI Behavior**:
- Timezone dropdown shows "🗽 Eastern Time (New York)"
- Current time display updates to show EST/EDT time
- All time inputs respect the selected timezone

### 1.2 Create Cards with Debug Controls
**Goal**: Set up cards with different review states

**Steps**:
1. Navigate to a folder with cards
2. Click **"Start Review"**
3. Wait for card to load, then click **🔧 Debug Icon** (yellow gear)
4. Create different card scenarios:

**Card 1 - New Card**:
```
🔧 Debug Panel Settings:
- Click "📝 New Card" preset
- Ease Factor: 2.5
- Interval Days: 0
- Repetitions: 0
- Streak: 0
- Next Review Date: [NOW] (make it due immediately)
- Apply Changes
```

**Card 2 - Learning Card**:
```
🔧 Debug Panel Settings:
- Click "📚 Learning" preset
- Ease Factor: 2.3
- Interval Days: 6
- Repetitions: 2
- Streak: 2
- Next Review Date: [NOW] (override to be due now)
- Apply Changes
```

**Card 3 - Mastered Card** (for tomorrow testing):
```
🔧 Debug Panel Settings:
- Click "🎓 Mastered" preset
- Ease Factor: 3.2
- Interval Days: 45
- Repetitions: 8
- Streak: 15
- Next Review Date: [TOMORROW 09:15] (15 min after notification time)
- Apply Changes
```

### 1.3 Test Notification Logic
**Goal**: Verify timing system works correctly

**Manual Cron Trigger**:
```bash
curl -H "x-cron-secret: test-secret-token-for-debugging" \
     http://localhost:5174/api/admin/cron/trigger/check-due-cards
```

**Expected Results**:
- **If current time is 09:00-09:15 EST**: Notification sent (5+ cards due)
- **If current time is 22:00-08:00 EST**: Skipped (quiet hours)
- **If current time is outside window**: Skipped (wrong notification time)
- **Console Output**: Shows timezone-aware decision making

---

## 🌍 **Scenario 2: Timezone Edge Cases**

### 2.1 Cross-Timezone Testing
**Goal**: Test timezone conversion accuracy

**Settings Configuration**:
```
🌍 Timezone: Europe/London (GMT/BST)
⏰ Notification Time: 14:00 (2 PM London)
🤫 Quiet Hours: 23:00 - 07:00 (London time)
📅 Daily Reminder: 20:00 (8 PM London)
```

**Cards Setup**:
Use debug controls to create cards due now:
```
🔧 Set 3 cards with "Next Review Date" = current London time
🔧 Ensure 5+ cards total (meet threshold)
```

**Testing Different Time Windows**:
1. **During London business hours (14:00-14:15 GMT)**:
   - Expected: Notifications sent
   - Check: Server logs show London timezone calculations

2. **During London quiet hours (23:00-07:00 GMT)**:
   - Expected: Notifications skipped
   - Check: "In quiet hours" message with timezone

3. **Outside notification window**:
   - Expected: "Outside notification window" with current/preferred times

### 2.2 Daylight Saving Time Testing
**Goal**: Test timezone handling during DST transitions

**Setup**:
- Set timezone to one that observes DST (e.g., America/New_York)
- Test near DST transition dates (March/November)

---

## ⚡ **Scenario 3: Extreme Performance Testing**

### 3.1 Threshold Boundary Testing
**Goal**: Test notification threshold logic

**Setup Multiple Threshold Scenarios**:

**Sub-test A: "Instant Learner" (1 card)**:
```
Settings:
- 🎯 Threshold: "Instant Learner" (1 card)
- ⏰ Notification Time: [CURRENT TIME]

Debug Setup:
- Set 1 card due now
- Apply changes

Expected: Notification sent immediately
```

**Sub-test B: "Power Learner" (20 cards)**:
```
Settings:
- 🎯 Threshold: "Power Learner" (20 cards)

Debug Setup:
- Set only 19 cards due (use debug to set multiple cards)
- Apply changes

Expected: No notification (below threshold)
```

**Sub-test C: Custom Threshold (7 cards)**:
```
Settings:
- 🎯 Custom threshold: 7 cards

Debug Setup:
- Set exactly 7 cards due
- Apply changes

Expected: Notification sent (meets exact threshold)
```

### 3.2 Daily Reminder vs Card Due Conflict
**Goal**: Test when both notifications should trigger

**Setup**:
```
⏰ Card Due Time: 19:00
📅 Daily Reminder Time: 19:00 (same time!)
🎯 Threshold: 5 cards due
```

**Expected Behavior**:
- Both daily reminder AND card due notification logic should execute
- Check server logs for both message types

---

## 🔄 **Scenario 4: Spaced Repetition Algorithm Testing**

### 4.1 Algorithm Progression Testing
**Goal**: Test how debug controls affect SM-2 calculations

**Workflow**:
1. **Set Initial State**:
   ```
   🔧 Debug Settings:
   - Ease Factor: 2.5 (default)
   - Interval Days: 1
   - Repetitions: 0
   - Streak: 0
   - Apply Changes
   ```

2. **Grade Card with Different Scores**:
   ```
   Test Sequence:
   - Grade 5 (Easy) → Note new ease factor and interval
   - Reset with debug → Grade 3 (Good) → Compare results
   - Reset with debug → Grade 1 (Hard) → Compare results
   - Reset with debug → Grade 0 (Again) → Check interval reset
   ```

3. **Observe Algorithm Behavior**:
   - **Grade 5**: Should increase ease factor and interval significantly
   - **Grade 3**: Should maintain ease factor, standard interval
   - **Grade 1**: Should decrease ease factor, short interval
   - **Grade 0**: Should reset to short interval, decrease ease factor

### 4.2 Advanced User State Testing
**Goal**: Test edge cases with experienced users

**Setup Struggling Advanced User**:
```
🔧 Debug Settings:
- Ease Factor: 1.3 (minimum)
- Interval Days: 180 (maximum)
- Repetitions: 20 (maximum)
- Streak: 0 (struggling despite experience)
- Apply Changes
```

**Test Grading**:
- Grade this card with different scores
- Observe how algorithm handles minimum ease factor
- Check if it prevents ease factor from going below 1.3

---

## 📊 **Scenario 5: Real-World Daily Usage Simulation**

### 5.1 Morning Study Session
**Goal**: Simulate typical morning routine

**Timeline Setup**:
```
User Profile:
- 🌍 Timezone: America/Los_Angeles (PST/PDT)
- ⏰ Preferred Study Time: 08:00 (8 AM Pacific)
- 🤫 Quiet Hours: 22:00 - 07:00
- 📅 Daily Reminder: 19:00 (7 PM)
- 🎯 Threshold: "Steady Studier" (3 cards)
```

**Day 1 - Setup**:
1. Set 5 cards due at 08:05 AM Pacific (just after notification window)
2. Trigger cron manually during notification window (08:00-08:15)
3. Expected: Notification sent
4. Complete review session, grade cards normally
5. Note new review dates calculated by algorithm

**Day 2 - Test Daily Reminder**:
1. Set time to 19:00 Pacific (7 PM)
2. Trigger cron manually
3. Expected: Daily reminder sent (even if no cards due)

**Day 3 - Test Quiet Hours**:
1. Set several cards due immediately
2. Set time to 23:30 Pacific (11:30 PM - quiet hours)
3. Trigger cron manually
4. Expected: No notifications (quiet hours respected)

### 5.2 Weekend Power Session
**Goal**: Test intensive study session behavior

**Setup**:
```
🎯 Threshold: "Power Learner" (20 cards)
⏰ Notification Time: 10:00
```

**Debug Multiple Cards**:
```
Create 20 cards with various states:
- 5 New cards (debug preset: New)
- 5 Learning cards (debug preset: Learning)
- 5 Mastered cards (set due now)
- 5 Struggling cards (debug preset: Struggling)
```

**Session Testing**:
1. Review all 20 cards in one session
2. Use different grades for each category
3. Observe how algorithm schedules future reviews
4. Check session analytics and timing

---

## 🔧 **Debug Panel Power User Guide**

### **🎛️ Advanced Debug Scenarios**

**Quick Card State Setup Commands:**
```javascript
// Run in browser console while debug panel is open

// 1. Set card due immediately (perfect for testing notifications)
debugValues.nextReviewAt = new Date().toISOString().slice(0,16)
// Apply changes in debug panel

// 2. Set card due in exactly 2 minutes (for testing timing)
const twoMinutesFromNow = new Date(Date.now() + 2*60*1000)
debugValues.nextReviewAt = twoMinutesFromNow.toISOString().slice(0,16)

// 3. Set card due tomorrow at notification time
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
tomorrow.setHours(9, 0, 0, 0) // 9 AM tomorrow
debugValues.nextReviewAt = tomorrow.toISOString().slice(0,16)

// 4. Create struggling card that needs immediate attention
debugValues.easeFactor = 1.3      // Minimum ease factor
debugValues.intervalDays = 1       // Short interval
debugValues.repetitions = 5        // Has been reviewed before
debugValues.streak = 0             // But struggling
debugValues.nextReviewAt = new Date().toISOString().slice(0,16)

// 5. Create overdue card (for testing overdue logic)
const threeDaysAgo = new Date(Date.now() - 3*24*60*60*1000)
debugValues.nextReviewAt = threeDaysAgo.toISOString().slice(0,16)

// 6. Create card due during quiet hours (for testing quiet hours logic)
const tonight = new Date()
tonight.setHours(23, 30, 0, 0) // 11:30 PM tonight
debugValues.nextReviewAt = tonight.toISOString().slice(0,16)
```

### **⚡ Bulk Card Creation for Threshold Testing**
```javascript
// Create multiple cards efficiently for threshold testing
const createCardsAtThreshold = async (targetCount = 5) => {
  console.log(`Creating ${targetCount} cards due now...`)

  // This assumes you're in the review interface with debug panel access
  for (let i = 0; i < targetCount; i++) {
    // Set each card due now with slight variations
    debugValues.nextReviewAt = new Date(Date.now() + i*1000).toISOString().slice(0,16)
    debugValues.easeFactor = 2.5 - (i * 0.1) // Vary ease factors
    debugValues.intervalDays = i + 1          // Different intervals
    debugValues.repetitions = i               // Different experience levels

    // Apply changes (you'll need to click apply in the UI)
    console.log(`Card ${i+1}: Due at ${debugValues.nextReviewAt}`)

    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`✅ Created ${targetCount} cards for notification threshold testing`)
}

// Usage: createCardsAtThreshold(10) for "Focused Reviewer" threshold testing
```

### **🎯 Preset Combinations for Realistic Scenarios**

**New User First Week:**
```javascript
// Day 1: First cards
debugValues = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, streak: 0, nextReviewAt: now }

// Day 2: Some progress
debugValues = { easeFactor: 2.5, intervalDays: 1, repetitions: 1, streak: 1, nextReviewAt: now }

// Day 4: Building streak
debugValues = { easeFactor: 2.6, intervalDays: 2, repetitions: 2, streak: 2, nextReviewAt: now }

// Day 7: Established pattern
debugValues = { easeFactor: 2.7, intervalDays: 4, repetitions: 3, streak: 3, nextReviewAt: now }
```

**Returning User After Break:**
```javascript
// Cards that were mastered but now due after vacation
debugValues = {
  easeFactor: 3.1,          // Was well-known
  intervalDays: 21,         // 3-week interval
  repetitions: 8,           // Experienced card
  streak: 8,                // Had good streak
  nextReviewAt: '2024-01-01T09:00' // Overdue from vacation
}
```

**Power User Heavy Session:**
```javascript
// Create 20 cards with realistic distribution
const powerUserCards = [
  // 5 easy cards (mastered, long intervals)
  { easeFactor: 3.2, intervalDays: 45, repetitions: 10, streak: 10 },
  { easeFactor: 3.0, intervalDays: 30, repetitions: 8, streak: 8 },
  { easeFactor: 3.1, intervalDays: 35, repetitions: 9, streak: 9 },
  { easeFactor: 2.9, intervalDays: 25, repetitions: 7, streak: 7 },
  { easeFactor: 3.3, intervalDays: 50, repetitions: 12, streak: 12 },

  // 10 medium cards (learning, medium intervals)
  { easeFactor: 2.6, intervalDays: 8, repetitions: 4, streak: 4 },
  { easeFactor: 2.5, intervalDays: 6, repetitions: 3, streak: 3 },
  { easeFactor: 2.7, intervalDays: 10, repetitions: 5, streak: 4 },
  { easeFactor: 2.4, intervalDays: 4, repetitions: 2, streak: 2 },
  { easeFactor: 2.8, intervalDays: 12, repetitions: 6, streak: 5 },
  // ... continue pattern

  // 5 difficult cards (struggling, short intervals)
  { easeFactor: 1.3, intervalDays: 1, repetitions: 3, streak: 0 },
  { easeFactor: 1.4, intervalDays: 2, repetitions: 4, streak: 1 },
  { easeFactor: 1.5, intervalDays: 1, repetitions: 5, streak: 0 },
  { easeFactor: 1.3, intervalDays: 3, repetitions: 6, streak: 0 },
  { easeFactor: 1.6, intervalDays: 2, repetitions: 4, streak: 1 }
]

// Apply each configuration with cards due now
powerUserCards.forEach((card, i) => {
  console.log(`Setting up power user card ${i+1}:`, card)
  Object.assign(debugValues, card)
  debugValues.nextReviewAt = new Date().toISOString().slice(0,16)
  // Apply in UI between each iteration
})
```

### **🧪 Advanced Testing Workflows**

**DST Transition Testing:**
```javascript
// Test notifications around Daylight Saving Time changes
const dstTestDates = [
  '2024-03-10T07:00', // Spring forward (2 AM → 3 AM)
  '2024-11-03T07:00', // Fall back (2 AM → 1 AM)
]

dstTestDates.forEach(testDate => {
  debugValues.nextReviewAt = testDate
  console.log(`Testing DST transition: ${testDate}`)
  // Apply and test notification timing
})
```

**Cross-Timezone Collaboration Testing:**
```javascript
// Simulate users in different timezones with cards due "now" in each timezone
const globalUsers = [
  { timezone: 'America/New_York', localTime: '09:00' },    // 9 AM Eastern
  { timezone: 'Europe/London', localTime: '14:00' },       // 2 PM London
  { timezone: 'Asia/Tokyo', localTime: '22:00' },          // 10 PM Tokyo
  { timezone: 'Australia/Sydney', localTime: '08:00' },    // 8 AM Sydney
]

globalUsers.forEach(user => {
  const testTime = new Date()
  testTime.setHours(parseInt(user.localTime.split(':')[0]),
                   parseInt(user.localTime.split(':')[1]), 0, 0)

  console.log(`${user.timezone} user: Card due at ${user.localTime} local time`)
  debugValues.nextReviewAt = testTime.toISOString().slice(0,16)
  // Test with this timezone setting in notification preferences
})
```

### **📊 Performance Testing Helpers**

**Load Testing Card Creation:**
```javascript
// Create large number of cards for performance testing
const createLoadTestCards = async (count = 100) => {
  console.log(`Creating ${count} cards for load testing...`)

  const batchSize = 10
  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const batchStart = batch * batchSize
    const batchEnd = Math.min(batchStart + batchSize, count)

    console.log(`Processing batch ${batch + 1}: cards ${batchStart + 1}-${batchEnd}`)

    for (let i = batchStart; i < batchEnd; i++) {
      // Vary the cards to be realistic
      const cardType = i % 4
      switch(cardType) {
        case 0: // New
          debugValues = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, streak: 0 }
          break
        case 1: // Learning
          debugValues = { easeFactor: 2.3, intervalDays: 6, repetitions: 2, streak: 2 }
          break
        case 2: // Mastered
          debugValues = { easeFactor: 3.1, intervalDays: 45, repetitions: 8, streak: 15 }
          break
        case 3: // Struggling
          debugValues = { easeFactor: 1.4, intervalDays: 3, repetitions: 5, streak: 0 }
          break
      }

      // All due now for notification testing
      debugValues.nextReviewAt = new Date().toISOString().slice(0,16)

      // You'll need to apply these changes in the UI
      console.log(`Card ${i+1}: ${['New', 'Learning', 'Mastered', 'Struggling'][cardType]}`)
    }

    // Pause between batches to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log(`✅ Load test setup complete: ${count} cards created`)
}
```

---

## 📈 **Success Criteria & Validation**

### ✅ **Functional Requirements Validation**

**Core Timing Logic:**
```bash
□ Timezone Calculations
  - ✅ All times calculated in user's specified timezone
  - ✅ DST transitions handled correctly (spring forward/fall back)
  - ✅ Midnight crossover in quiet hours works (22:00-08:00)
  - ✅ Invalid timezones gracefully fallback to UTC

□ Notification Window Logic
  - ✅ 15-minute window around cardDueTime respected (±15 min)
  - ✅ Notifications only sent during window (not outside)
  - ✅ Cron schedule aligns with notification windows
  - ✅ Multiple cron runs in window don't duplicate notifications

□ Precedence & Filtering
  - ✅ Quiet hours take absolute precedence (no notifications during sleep)
  - ✅ Card threshold prevents low-relevance notifications
  - ✅ 6-hour cooldown prevents notification spam
  - ✅ System blockers (no subscriptions) always prevent notifications
```

**User Experience Requirements:**
```bash
□ Notification Preferences UI
  - ✅ Timezone selector shows user-friendly names
  - ✅ Real-time timezone display updates correctly
  - ✅ All time inputs respect selected timezone
  - ✅ Preference changes save and persist correctly
  - ✅ Validation prevents invalid time combinations

□ Daily Reminder System
  - ✅ Runs independently of card due notifications
  - ✅ Respects same quiet hours and timezone rules
  - ✅ Once-per-day limitation works correctly
  - ✅ Can coexist with card due notifications at same time

□ Debug & Testing Tools
  - ✅ Testing dashboard appears only in development
  - ✅ Manual cron trigger works with proper authentication
  - ✅ Preset scenarios load correctly and immediately
  - ✅ Debug panel integrates with existing SR controls
  - ✅ Console logging provides useful debugging information
```

### 🔍 **Performance & Reliability Validation**

**System Performance:**
```bash
□ Cron Execution Performance
  - ✅ Execution time <1 second for 100 users
  - ✅ Execution time <5 seconds for 1000 users
  - ✅ Memory usage stable during execution
  - ✅ Database connections properly managed
  - ✅ No memory leaks in timezone calculations

□ Database Performance
  - ✅ Queries optimized with proper indexes
  - ✅ No N+1 query problems
  - ✅ Connection pooling handles concurrent access
  - ✅ Transaction management for consistency
  - ✅ Cleanup of old notification records

□ Resource Utilization
  - ✅ CPU usage: 93% reduction vs every-minute cron
  - ✅ Database load: 93% fewer queries per day
  - ✅ Memory footprint: Stable across all timezone calculations
  - ✅ Network calls: Minimal external API dependencies
```

**Reliability & Error Handling:**
```bash
□ Edge Case Handling
  - ✅ Network failures during notification sending
  - ✅ Database unavailability during cron execution
  - ✅ Invalid user data (malformed preferences)
  - ✅ Timezone changes mid-execution
  - ✅ System clock changes/NTP sync issues

□ Error Recovery
  - ✅ Failed notifications don't block other users
  - ✅ Database errors don't crash cron process
  - ✅ Graceful degradation when services unavailable
  - ✅ Automatic retry logic for transient failures
  - ✅ Proper error logging without sensitive data exposure
```

### � **Monitoring & Alerting Validation**

**Operational Metrics:**
```bash
□ Key Performance Indicators
  - 🎯 Notification delivery rate: >99%
  - 🎯 Cron execution time: <1 second average
  - 🎯 Error rate: <1% per execution
  - 🎯 User preference update success: >99.9%
  - 🎯 Timezone calculation accuracy: 100%

□ Health Checks
  - ✅ Cron status endpoint responds correctly
  - ✅ Database connectivity verified
  - ✅ Notification service availability confirmed
  - ✅ Timezone utility functions validated
  - ✅ API authentication working properly
```

**Alerting Thresholds:**
```typescript
// Recommended alerting configuration
const alertThresholds = {
  cronExecutionTime: {
    warning: 3000,    // 3 seconds
    critical: 10000   // 10 seconds
  },
  notificationDeliveryRate: {
    warning: 95,      // 95%
    critical: 90      // 90%
  },
  errorRate: {
    warning: 5,       // 5%
    critical: 10      // 10%
  },
  consecutiveFailures: {
    warning: 3,       // 3 failures
    critical: 5       // 5 failures
  }
}
```

### 🚨 **Common Issues & Troubleshooting**

**Notification Not Received:**
```bash
1. Check notification preferences:
   - cardDueEnabled: true?
   - Current time within notification window?
   - Not in quiet hours?
   - Enough cards meet threshold?

2. Verify system status:
   - Cron running successfully?
   - User has active push subscriptions?
   - No recent notifications (6-hour cooldown)?
   - No system errors in logs?

3. Test manually:
   - Use testing dashboard manual trigger
   - Check browser console for errors
   - Verify timezone calculations in logs
   - Test with minimal threshold (1 card)
```

**Performance Issues:**
```bash
1. Cron execution slow:
   - Check database query performance
   - Review user count vs execution time
   - Monitor memory usage during execution
   - Look for N+1 query patterns

2. High server load:
   - Verify cron frequency (should be */15 not */1)
   - Check for infinite loops in timezone calculations
   - Monitor database connection pooling
   - Review error retry logic

3. Memory leaks:
   - Monitor memory usage over time
   - Check timezone utility function cleanup
   - Review notification sending cleanup
   - Look for unclosed database connections
```

**User Experience Problems:**
```bash
1. Wrong notification times:
   - Verify user's timezone setting
   - Check DST transition handling
   - Validate notification window calculations
   - Test with user's exact timezone

2. Too many/few notifications:
   - Review threshold settings
   - Check cooldown period logic
   - Verify daily reminder frequency
   - Look for duplicate notification logic

3. UI/preferences issues:
   - Test timezone selector functionality
   - Verify preference persistence
   - Check validation error messages
   - Test with edge case timezones
```

### 🎯 **Acceptance Testing Checklist**

**Pre-Production Deployment:**
```bash
□ All 5 test scenarios completed successfully
□ Performance benchmarks met under load
□ Security review completed (cron endpoints, data validation)
□ Documentation updated and reviewed
□ Monitoring and alerting configured
□ Rollback plan prepared and tested
□ User communication plan ready
□ Support team trained on new system

□ Production Readiness
□ Database migrations tested in staging
□ Environment variables configured correctly
□ Cron service configured and tested
□ Load balancer configuration updated
□ CDN/cache invalidation planned
□ Backup and disaster recovery verified
```

**Post-Deployment Validation:**
```bash
□ First 24 hours:
  - Monitor cron execution performance
  - Verify notification delivery rates
  - Check error logs for issues
  - Monitor user preference updates
  - Validate timezone calculations accuracy

□ First week:
  - Analyze user engagement patterns
  - Review performance under real load
  - Monitor support ticket volume
  - Validate all timezone edge cases
  - Check system stability metrics

□ First month:
  - Assess overall user satisfaction
  - Review notification effectiveness
  - Optimize based on real usage patterns
  - Plan next iteration improvements
  - Document lessons learned
```

This comprehensive testing framework ensures the timing system works flawlessly across all user scenarios, edge cases, and operational conditions! 🎯✨




Rule order (what must be true to send)
Quiet Hours: Always block delivery during this window.
Send Anytime (Outside Quiet Hours)
ON: Card Due Time is ignored. We can send any time:
outside Quiet Hours
inside Active Hours if Active Hours is enabled
and only if threshold met and cooldown not active
OFF: Card Due Time is required. We send only:
near Card Due Time (time-window)
outside Quiet Hours
and if Active Hours is enabled, Card Due Time must fall within Active Hours
and only if threshold met and cooldown not active
Common conflict cases (and fixes)
Card Due Time outside Active Hours (with Active Hours ON, Send Anytime OFF)
Result: Nothing sends at that time.
Fix: Move Card Due Time into Active Hours or disable Active Hours (or turn Send Anytime ON).
Active Hours overlap heavily with Quiet Hours (or leave no free overlap)
Result: No valid send window.
Fix: Adjust either window so there’s at least some time outside Quiet Hours and inside Active Hours.
Midnight crossover windows
Supported. Just ensure the intended overlap actually exists (e.g., Active 22:00–06:00 with Quiet 23:00–07:00 leaves no gap).
Quick matrix
Send Anytime ON + Active Hours OFF → Send anytime outside Quiet Hours.
Send Anytime ON + Active Hours ON → Send only during Active Hours and outside Quiet Hours.
Send Anytime OFF + Active Hours OFF → Send near Card Due Time, outside Quiet Hours.
Send Anytime OFF + Active Hours ON → Send near Card Due Time only if that time is inside Active Hours and outside Quiet Hours.
