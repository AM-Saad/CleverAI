Walk-through concrete examples with actual numbers to show how the SM-2 algorithm adapts to your performance.

## 🎯 **Default Starting State**

When you first enroll a card:
```typescript
{
  repetitions: 0,
  easeFactor: 2.5,
  intervalDays: 0,
  nextReviewAt: "today"
}
```

## 📚 **Example 1: Hard → Easy Performance**

Let's say you're learning a difficult Spanish word: "perspicaz" (perceptive)

### **Review #1 (Today)**
- **State Before**: `repetitions: 0, easeFactor: 2.5, interval: 0`
- **Your Grade**: `2` (Hard - you got it wrong, difficult to recall)
- **Calculation**:
  ```typescript
  // Grade 2 = incorrect response
  repetitions = 0        // Reset (stays 0)
  intervalDays = 1       // Always 1 day for incorrect
  easeFactor = 2.5 - 0.32 = 2.18  // Gets harder
  ```
- **Result**: Review again **tomorrow** (1 day)
- **New State**: `repetitions: 0, easeFactor: 2.18, interval: 1`

### **Review #2 (Tomorrow)**
- **State Before**: `repetitions: 0, easeFactor: 2.18, interval: 1`
- **Your Grade**: `4` (Good - correct with slight hesitation)
- **Calculation**:
  ```typescript
  // Grade 4 = correct response
  // First successful review (repetitions was 0)
  intervalDays = 1       // Always 1 day for first success
  repetitions = 1        // Increment
  easeFactor = 2.18 + 0 = 2.18  // No change for grade 4
  ```
- **Result**: Review again **tomorrow** (1 day)
- **New State**: `repetitions: 1, easeFactor: 2.18, interval: 1`

### **Review #3 (Day After Tomorrow)**
- **State Before**: `repetitions: 1, easeFactor: 2.18, interval: 1`
- **Your Grade**: `5` (Easy - perfect recall!)
- **Calculation**:
  ```typescript
  // Grade 5 = correct response
  // Second successful review (repetitions was 1)
  intervalDays = 6       // Always 6 days for second success
  repetitions = 2        // Increment
  easeFactor = 2.18 + 0.1 = 2.28  // Gets easier
  ```
- **Result**: Review in **6 days**
- **New State**: `repetitions: 2, easeFactor: 2.28, interval: 6`

### **Review #4 (6 Days Later)**
- **State Before**: `repetitions: 2, easeFactor: 2.28, interval: 6`
- **Your Grade**: `5` (Easy - still perfect!)
- **Calculation**:
  ```typescript
  // Grade 5 = correct response
  // Third+ successful review - use formula
  intervalDays = Math.round(6 * 2.28) = 14 days
  repetitions = 3        // Increment
  easeFactor = 2.28 + 0.1 = 2.38  // Gets easier
  ```
- **Result**: Review in **14 days**
- **New State**: `repetitions: 3, easeFactor: 2.38, interval: 14`

---

## 📚 **Example 2: Easy → Hard Performance**

Now let's say you're learning "casa" (house) - should be easy!

### **Review #1 (Today)**
- **State Before**: `repetitions: 0, easeFactor: 2.5, interval: 0`
- **Your Grade**: `5` (Easy - you know this!)
- **Calculation**:
  ```typescript
  // Grade 5 = correct response
  // First successful review
  intervalDays = 1       // Always 1 day for first success
  repetitions = 1        // Increment
  easeFactor = 2.5 + 0.1 = 2.6  // Gets easier
  ```
- **Result**: Review **tomorrow** (1 day)
- **New State**: `repetitions: 1, easeFactor: 2.6, interval: 1`

### **Review #2 (Tomorrow)**
- **State Before**: `repetitions: 1, easeFactor: 2.6, interval: 1`
- **Your Grade**: `5` (Easy - still obvious)
- **Calculation**:
  ```typescript
  // Grade 5 = correct response
  // Second successful review
  intervalDays = 6       // Always 6 days for second success
  repetitions = 2        // Increment
  easeFactor = 2.6 + 0.1 = 2.7  // Gets easier
  ```
- **Result**: Review in **6 days**
- **New State**: `repetitions: 2, easeFactor: 2.7, interval: 6`

### **Review #3 (6 Days Later)**
- **State Before**: `repetitions: 2, easeFactor: 2.7, interval: 6`
- **Your Grade**: `5` (Easy)
- **Calculation**:
  ```typescript
  // Grade 5 = correct response
  intervalDays = Math.round(6 * 2.7) = 16 days
  repetitions = 3
  easeFactor = 2.7 + 0.1 = 2.8
  ```
- **Result**: Review in **16 days**
- **New State**: `repetitions: 3, easeFactor: 2.8, interval: 16`

### **Review #4 (16 Days Later - You Forgot!)**
- **State Before**: `repetitions: 3, easeFactor: 2.8, interval: 16`
- **Your Grade**: `1` (Hard - wrong, but familiar when shown)
- **Calculation**:
  ```typescript
  // Grade 1 = incorrect response - RESET TIME!
  repetitions = 0        // Back to square one
  intervalDays = 1       // Start over with 1 day
  easeFactor = 2.8 - 0.54 = 2.26  // Gets harder
  ```
- **Result**: Review **tomorrow** (back to daily reviews)
- **New State**: `repetitions: 0, easeFactor: 2.26, interval: 1`

## 🎯 **Key Insights:**

1. **Easy cards get spaced further apart** (higher ease factor = longer intervals)
2. **Hard cards stay closer together** (lower ease factor = shorter intervals)
3. **Forgetting resets progress** but keeps the "difficulty memory" (ease factor)
4. **The system adapts** to each card's individual difficulty for you
5. **First two reviews** are always 1 day, then 6 days (regardless of ease factor)

This creates a **personalized learning curve** where the system learns which cards are hard for YOU specifically! 🚀
