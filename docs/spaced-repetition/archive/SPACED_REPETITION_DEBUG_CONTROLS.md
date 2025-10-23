# Debug Controls Implementation Summary

> ⚠️ **PARTIALLY SUPERSEDED**: Core debug concepts have been merged into [../SPACED_REPETITION.md (Debug Controls section)](../SPACED_REPETITION.md#debug-controls--testing)
> 
> **What's been merged**:
> - ✅ "What Each Action Does" - Detailed explanations of Apply/Reset/Load Presets
> - ✅ "Apply BEFORE/AFTER Grading" - Timing guidance for testing
> - ✅ "Interval Days vs Next Review Date" - Relationship and recommendations
> 
> **Still useful for**:
> - 📝 Implementation details and file locations
> - 🏗️ Technical architecture of debug system
> - 📚 Historical context of development decisions
> 
> **Usage guidance**: Now in main documentation with enhanced explanations
> 
> *Implementation guide - conceptual content merged: October 2025*

---

## Overview
Successfully implemented comprehensive debug controls for testing spaced repetition scenarios in development environment only.

## Implementation Details

### 1. Debug API Endpoint
- **File**: `server/api/review/debug/update.post.ts`
- **Purpose**: Development-only API for updating spaced repetition parameters
- **Features**:
  - Environment-restricted (development only)
  - Comprehensive Zod validation
  - User authentication required
  - Updates all SM-2 algorithm parameters

### 2. Debug Panel Integration
- **File**: `app/components/review/CardReviewInterface.vue`
- **Location**: Integrated directly into review interface
- **Visibility**: Development environment only (`process.env.NODE_ENV !== 'production'`)

### 3. Debug Controls Available
- **Ease Factor**: Range slider (1.3 - 5.0)
- **Interval Days**: Range slider (0 - 180 days)
- **Repetitions**: Range slider (0 - 20)
- **Streak**: Range slider (0 - 100)
- **Next Review Date**: DateTime picker
- **Last Grade**: Dropdown (0-5, None)

### 4. Preset Scenarios
- **New Card**: Default starting state
- **Learning**: Early learning phase
- **Mastered**: Well-known card state
- **Struggling**: Difficult card state

### 5. Debug Functions
- **Apply Values**: Updates database with current debug values
- **Reset**: Restores values from current card state
- **Load Presets**: Quick scenario switching

## What Each Action Does

### 📊 **Apply Values** (Main Action)
**What it does:**
- Immediately updates the card's database record with your debug values
- Overwrites the current spaced repetition state permanently
- Bypasses the normal SM-2 algorithm calculations
- Changes take effect instantly (card scheduling updates immediately)

**Database fields updated:**
- `easeFactor` → Controls future difficulty adjustments
- `intervalDays` → Used in next algorithm calculation
- `repetitions` → Tracks study session count
- `streak` → Consecutive correct answers
- `nextReviewAt` → When card becomes due (if set)
- `lastGrade` → Previous performance score (if set)

### 🔄 **Reset**
**What it does:**
- Reloads the current card's original values from database
- Restores the debug panel sliders to current card state
- Does NOT change the database - only updates the UI
- Useful if you want to undo unsaved changes in the panel

### 🎯 **Load Presets**
**What it does:**
- Sets the debug panel controls to predefined values
- Does NOT change the database until you click "Apply Values"
- Provides quick scenarios for common testing cases:
  - **New**: Fresh card state (easeFactor: 2.5, interval: 0, reps: 0)
  - **Learning**: Early progress (easeFactor: 2.3, interval: 6, reps: 2)
  - **Mastered**: Advanced state (easeFactor: 2.8, interval: 45, reps: 8)
  - **Struggling**: Difficulty state (easeFactor: 1.7, interval: 2, reps: 1)

## ⏰ **When to Apply Changes: Before vs After Grading**

### 🎯 **Apply BEFORE Grading** (Recommended)
**Use case:** Testing how different card states affect the SM-2 algorithm

**Workflow:**
1. Load a card in review mode
2. Set debug values (simulate card history)
3. **Apply Values** → Card now has the state you want to test
4. **Grade the card** → See how algorithm responds to your simulated state
5. Observe the new calculated values (next interval, ease factor changes)

**Example:** "What happens when a struggling card (EF: 1.7, streak: 0) gets a good grade?"

### 🔧 **Apply AFTER Grading** (Edge Case Testing)
**Use case:** Overriding algorithm results to test specific scenarios

**Workflow:**
1. Grade a card normally (algorithm calculates new values)
2. Override with debug values to test edge cases
3. **Apply Values** → Manually set specific scheduling scenarios
4. Move to next card or test further behavior

**Example:** "Force a card to be due tomorrow regardless of grade"

### 🚫 **Apply is Agnostic to Grading**
The debug system operates **independently** of the grading system:
- **Debug changes**: Direct database updates, bypass algorithm
- **Grading changes**: Algorithm-calculated updates, follow SM-2 rules
- **Both can coexist**: Debug sets state → Grade calculates new state → Debug can override again

**Key insight:** Debug controls let you manipulate the card's state at any point to test "what if" scenarios!

## Usage Instructions

### Accessing Debug Panel
1. Start development server (`npm run dev`)
2. Navigate to review interface at `http://localhost:3000`
3. **You need existing cards to review** - go to a folder with cards
4. Start a review session (the gear icon only appears when reviewing cards)
5. Click yellow debug icon (⚙️) in top-right corner
6. Debug panel appears with all controls

### How It Works
- **Debug controls apply to the CURRENT card being reviewed**
- The controls load the current card's spaced repetition parameters
- When you click "Apply Values", it updates that specific card's database record
- Changes are immediate and persistent - the card will use the new parameters
- You can test different scenarios on the same card or different cards

### Step-by-Step Testing Process
1. **Start a review session** (must have cards to review)
2. **Current card loads** - debug panel shows its current parameters
3. **Modify parameters** using sliders/inputs or preset buttons
4. **Apply changes** - this updates the database for this specific card
5. **Test the card** - grade it and see how the new parameters affect scheduling
6. **Move to next card** or reset to test different scenarios

### What Gets Updated
- The specific CardReview record for the current card
- All SM-2 algorithm parameters (easeFactor, intervalDays, repetitions, streak)
- Next review date and optionally the last grade
- Changes persist across sessions

### Testing Scenarios
1. **New User Testing**: Use "New" preset
2. **Learning Progress**: Use "Learning" preset
3. **Advanced User**: Use "Mastered" preset
4. **Struggling Student**: Use "Struggling" preset
5. **Custom Scenarios**: Manually adjust all parameters

### Parameter Effects
- **Ease Factor**: Controls difficulty adjustment (lower = harder)
- **Interval Days**: Days until next review (used to calculate nextReviewAt in normal flow)
- **Repetitions**: Number of successful reviews
- **Streak**: Consecutive correct answers
- **Review Date**: When card becomes due (overrides calculated date)
- **Last Grade**: Previous performance score

### ⚠️ **Important: Interval Days vs Next Review Date**
There's a relationship between `intervalDays` and `nextReviewAt` that you should understand:

**Normal SM-2 Flow:**
1. User grades a card
2. Algorithm calculates new `intervalDays` based on performance
3. System sets `nextReviewAt = today + intervalDays`

**Debug Controls Behavior:**
- **Interval Days**: Sets the interval that will be used for *future* calculations
- **Next Review Date**: Sets when this card becomes due for review (immediate override)
- **When both are set**: Next Review Date takes precedence for scheduling, but Interval Days affects future calculations

**Recommendations:**
- **For testing scheduling**: Set Next Review Date to make cards due now/soon
- **For testing algorithm**: Set Interval Days to test how the algorithm behaves
- **For realistic testing**: Keep them consistent (Next Review Date ≈ today + Interval Days)
- **For conflict testing**: Set them differently to see edge case behavior

## Technical Implementation

### Environment Safety
```typescript
const isDev = process.env.NODE_ENV !== 'production'
```

### Parameter Validation
```typescript
const updateSchema = z.object({
  cardId: z.string(),
  easeFactor: z.number().min(1.3).max(5.0),
  intervalDays: z.number().min(0).max(180),
  repetitions: z.number().min(0).max(20),
  streak: z.number().min(0).max(100),
  nextReviewAt: z.string().datetime(),
  lastGrade: z.number().min(0).max(5).optional()
})
```

### API Integration
```typescript
const response = await $fetch('/api/review/debug/update', {
  method: 'POST',
  body: { cardId: currentCard.value.id, ...debugValues }
})
```

## Security Features
- ✅ Development environment only
- ✅ User authentication required
- ✅ Input validation with Zod
- ✅ Database transaction safety
- ✅ Error handling and user feedback

## Testing Workflow
1. **Prerequisites**: Have cards in a folder that are due for review
2. **Start review session**: Navigate to a folder and click "Start Review"
3. **Wait for card to load**: The debug gear icon appears in the header
4. **Open debug panel**: Click the yellow gear icon (⚙️)
5. **Choose testing approach**:
   - **Algorithm testing**: Set debug values → Apply → Grade → Observe algorithm response
   - **Scheduling testing**: Set next review date → Apply → Check when card appears
   - **Edge case testing**: Grade normally → Override with debug values → Apply
6. **Apply changes**: Click "Apply Values" to update the database
7. **Test behavior**: Grade the card and observe the algorithm's response to your debug state
8. **Reset if needed**: Click "Reset" to restore original values (before applying)
9. **Continue testing**: Move to next card or modify current card again

## Common Testing Patterns

### 🧪 **Testing Algorithm Behavior**
```
Load card → Set debug state → Apply → Grade → Observe new calculations
```
**Goal**: See how SM-2 responds to different card histories

### 📅 **Testing Scheduling**
```
Load card → Set next review date → Apply → Check queue/timing
```
**Goal**: Control when cards appear for review

### ⚡ **Testing Edge Cases**
```
Grade card → Override results → Apply → Test unusual states
```
**Goal**: Force specific scenarios that rarely occur naturally

## Troubleshooting

### "I can't find the gear icon"
- ✅ Make sure development server is running (`npm run dev`)
- ✅ You must be in a review session (not just browsing cards)
- ✅ Navigate to a folder with cards and click "Start Review"
- ✅ The gear icon appears in the header next to the analytics button

### "Debug panel is empty"
- ✅ Ensure you're in development mode (`NODE_ENV=development`)
- ✅ Wait for a card to load completely before opening the panel
- ✅ Check browser console for any JavaScript errors

### "Apply Values doesn't work"
- ✅ Make sure you're logged in and authenticated
- ✅ Check that the card has finished loading
- ✅ Verify you're in development environment

### "Interval Days and Next Review Date seem inconsistent"
- ✅ This is normal - they serve different purposes:
  - **Interval Days**: Used for future algorithm calculations
  - **Next Review Date**: Controls when card appears for review
- ✅ For realistic testing, keep them consistent
- ✅ For edge case testing, set them differently intentionally

## Next Steps
- Test all preset scenarios work correctly
- Validate parameter limits function properly
- Ensure smooth user experience
- Document any edge cases discovered during testing

## Notes
- Debug panel only visible in development
- **Debug changes apply to the current card being reviewed**
- **Changes persist to database** - the card's spaced repetition state is permanently updated
- Original values can be restored with Reset button (if you haven't moved to next card)
- Panel can be toggled on/off as needed during testing
- **Each card maintains its own spaced repetition parameters** - you're testing individual card behavior
- **To test new vs existing cards**: Create new cards or find cards with different experience levels
