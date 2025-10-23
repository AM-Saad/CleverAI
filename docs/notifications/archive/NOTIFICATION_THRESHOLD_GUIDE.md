# 🔔 Notification Threshold User Guide

## 📊 **Engaging Threshold Categories**

We've transformed the technical "minimum cards threshold" into user-friendly categories that help users choose their ideal notification frequency based on their learning style.

### **Available Options:**

#### ⚡ **Instant Learner** (1+ cards)
- **Target User**: Highly motivated learners who want to stay on top of every review
- **Learning Style**: Daily micro-sessions, consistent habit builders
- **Use Case**: "I want to review cards as soon as they're due"
- **Notification**: You'll get notified when even 1 card is ready

#### 📚 **Steady Studier** (3+ cards)
- **Target User**: Regular learners who prefer small, manageable batches
- **Learning Style**: Short but frequent study sessions
- **Use Case**: "I like to review a few cards at a time throughout the day"
- **Notification**: You'll get notified when 3 or more cards are ready

#### 🎯 **Focused Reviewer** (5+ cards) - *Default*
- **Target User**: Balanced learners who want meaningful study sessions
- **Learning Style**: Moderate sessions with good focus time
- **Use Case**: "I want enough cards to make it worth sitting down to study"
- **Notification**: You'll get notified when 5 or more cards are ready

#### 📊 **Batch Processor** (10+ cards)
- **Target User**: Efficiency-focused learners who prefer longer sessions
- **Learning Style**: Dedicated study blocks, fewer interruptions
- **Use Case**: "I prefer to accumulate cards and review them in batches"
- **Notification**: You'll get notified when 10 or more cards are ready

#### 💪 **Power Learner** (20+ cards)
- **Target User**: Intensive learners who love study marathons
- **Learning Style**: Long, focused sessions with high card volume
- **Use Case**: "I want to do serious study sessions with lots of cards"
- **Notification**: You'll get notified when 20 or more cards are ready

#### ⚙️ **Custom**
- **Target User**: Users with specific preferences not covered by presets
- **Learning Style**: Completely customizable
- **Use Case**: "I know exactly how many cards I want before being notified"
- **Notification**: You set the exact number (1-100 cards)

---

## 🎯 **How It Solves Your Issue**

### **Your Previous Problem:**
```typescript
📚 User 68a60683031c492736e6b49a has 1 due cards
📈 Skipping user 68a60683031c492736e6b49a - only 1 due cards (threshold: 5)
```

### **Now With User Choice:**
1. **User sees friendly options** instead of a technical number field
2. **User chooses "Instant Learner"** → threshold becomes 1
3. **System respects user preference:**
   ```typescript
   📚 User 68a60683031c492736e6b49a has 1 due cards
   🔔 Sending notification to user 68a60683031c492736e6b49a: 1 cards ready for review
   ✅ Successfully sent notification
   ```

---

## 🛠 **Technical Implementation**

### **Frontend Component** (`NotificationPreferences.vue`):
- Visual card-based selection UI
- Engaging titles and emojis for each threshold
- Descriptions that explain the learning style
- Custom input option for specific needs
- Real-time updates via debounced API calls

### **Backend Integration**:
- `cardDueThreshold` field in user preferences table
- Validation: 1-100 range
- Cron task uses individual user thresholds
- Default fallback to 5 cards for new users

### **User Experience Flow**:
1. User visits Settings → Notifications
2. Sees friendly threshold categories with descriptions
3. Clicks on their preferred learning style
4. Settings auto-save with visual confirmation
5. Cron system respects their individual preference

---

## 🚀 **Testing the New System**

### **Test Different Personas:**

1. **Test "Instant Learner"** (threshold: 1):
   - Add 1 card due today
   - Wait for cron job (every 2 minutes in dev)
   - Should receive notification immediately

2. **Test "Power Learner"** (threshold: 20):
   - Add 15 cards due today
   - Wait for cron job
   - Should NOT receive notification (below threshold)
   - Add 5 more cards (total 20)
   - Wait for cron job
   - Should receive notification

3. **Test Custom** (threshold: 7):
   - Set custom value to 7
   - Add 7 cards due today
   - Should receive notification

### **Expected Logs:**
```typescript
🚀 Starting cron job 'check-due-cards'
🔔 Starting scheduled card notification check...
🔔 Found 1 users with card due notifications enabled
📚 User 68a60683031c492736e6b49a has 1 due cards
🔔 Sending notification to user 68a60683031c492736e6b49a: 1 cards ready for review
✅ Successfully sent notification to user 68a60683031c492736e6b49a
🔔 Card notification check completed: { processed: 1, notificationsSent: 1, errors: 0, skipped: 0 }
```

---

## 📱 **UI Preview**

The settings now show:
```
📚 Card Due Notifications [ON]

Notification Frequency
Choose how often you'd like to be notified about due cards

[⚡ Instant Learner - 1+ cards] ✓ Selected
Get notified as soon as any card is due. Perfect for staying on top of every review.

[📚 Steady Studier - 3+ cards]
Be notified when you have a few cards ready. Great for regular, bite-sized study sessions.

[🎯 Focused Reviewer - 5+ cards]
Build up a small batch before reviewing. Ideal for concentrated study periods.

[📊 Batch Processor - 10+ cards]
Wait for a decent stack to accumulate. Perfect for longer, dedicated study sessions.

[💪 Power Learner - 20+ cards]
Go big or go home! Great for intensive study marathons and maximum efficiency.

[⚙️ Custom - [7] cards]
Set your own notification threshold
```

This transforms a technical setting into an engaging, personality-driven choice that helps users understand their learning style! 🎯
