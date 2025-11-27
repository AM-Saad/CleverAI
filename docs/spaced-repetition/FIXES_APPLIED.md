# Spaced Repetition Logic Fixes - Implementation Summary

**Date**: November 26, 2025  
**Status**: ✅ All fixes implemented and verified

---

## Changes Made

### 1. ✅ Fixed Queue Suspended Card Filtering
**File**: `server/api/review/queue.get.ts`

**Problem**: Suspended cards were included in the review queue.

**Solution**: Added `suspended: false` to WHERE clause:
```typescript
const whereClause = {
  userId: user.id,
  nextReviewAt: { lte: new Date() },
  suspended: false,  // ← Added
  ...(folderId ? { folderId } : {}),
};
```

---

### 2. ✅ Fixed Queue Stats Calculation
**File**: `server/api/review/queue.get.ts`

**Problems**:
- Due cards count was using fetched array length (limited by `take`)
- Stats queries didn't filter suspended cards

**Solution**: Added proper count query for due cards and filtered suspended:
```typescript
const [totalCards, newCards, learningCards, dueCards] = await Promise.all([
  prisma.cardReview.count({
    where: { userId: user.id, suspended: false, ...(folderId ? { folderId } : {}) },
  }),
  // ... other counts with suspended: false
  prisma.cardReview.count({
    where: {
      userId: user.id,
      suspended: false,
      nextReviewAt: { lte: new Date() },  // ← Actual due count
      ...(folderId ? { folderId } : {}),
    },
  }),
]);
```

---

### 3. ✅ Updated Grade 2 Documentation
**File**: `docs/spaced-repetition/SPACED_REPETITION.md`

**Problem**: Documentation said grade 2 is "correct with difficulty" but it resets progress.

**Solution**: Clarified that grades 0, 1, 2 all reset:
```markdown
| Grade | Meaning | Algorithm Effect |
|-------|---------|------------------|
| 0 | **Again** (complete blackout) | Reset to start, EF -0.8 |
| 1 | **Hard** (incorrect but recognized) | Reset to start, EF -0.54 |
| 2 | **Hard** (incorrect, needed help) | Reset to start, EF -0.32 |
| 3 | **Good** (correct with hesitation) | Progress, EF -0.14 |
| 4 | **Good** (correct with effort) | Progress, EF ±0 |
| 5 | **Easy** (perfect recall) | Progress, EF +0.1 |

**Important**: Grades 0, 1, and 2 all **reset progress**.
Only grades 3+ advance your learning.
```

---

### 4. ✅ Removed Unused Domain Layer
**Files Deleted**:
- `app/domain/sr/SREngine.ts`
- `app/domain/sr/SRScheduler.ts`
- `app/domain/sr/SRTypes.ts`
- `app/domain/repositories/CardReviewRepository.ts`
- `app/domain/repositories/PrismaCardReviewRepository.ts`
- `app/domain/repositories/CardRepository.ts`
- `app/domain/repositories/PrismaCardRepository.ts`

**Reason**: The app follows a pragmatic API-direct architecture. The domain layer existed but was never used (API bypassed it completely). Keeping unused code creates confusion.

**Files Kept**:
- `app/domain/sr/SRPolicy.ts` - Still referenced for configuration
- `app/domain/sr/ReminderService.ts` - Used by notification system

---

### 5. ✅ Extracted SM-2 to Shared Utility
**New File**: `server/utils/sm2.ts`

**Problem**: SM-2 algorithm was embedded in API endpoint, not reusable or testable.

**Solution**: Created comprehensive utility module:
```typescript
export interface SM2Params {
  currentEF: number;
  currentInterval: number;
  currentRepetitions: number;
  grade: number;
}

export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SM2Policy {
  minEaseFactor: number;
  maxIntervalDays: number;
  firstIntervalDays: number;
  secondIntervalDays: number;
}

export const DEFAULT_SM2_POLICY: SM2Policy = {
  minEaseFactor: 1.3,
  maxIntervalDays: 180,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
};

export function calculateSM2(params: SM2Params, policy?: SM2Policy): SM2Result;
export function calculateNextReviewDate(intervalDays: number, now?: Date): Date;
```

**Updated**: `server/api/review/grade.post.ts` now imports from utility:
```typescript
import { calculateSM2, calculateNextReviewDate } from "@server/utils/sm2";

// Inside transaction:
const { easeFactor, intervalDays, repetitions } = calculateSM2({
  currentEF: cardReview.easeFactor,
  currentInterval: cardReview.intervalDays,
  currentRepetitions: cardReview.repetitions,
  grade,
});

const nextReviewAt = calculateNextReviewDate(intervalDays);
```

---

### 6. ✅ Added Comprehensive Test Suite
**New File**: `tests/server/utils/sm2.spec.ts`

**Coverage**:
- ✅ Grade boundaries (0-2 reset, 3-5 progress)
- ✅ Interval progression (1 day → 6 days → formula)
- ✅ Ease factor updates for all grades
- ✅ Minimum EF enforcement (1.3)
- ✅ Maximum interval capping (180 days)
- ✅ Custom policy support
- ✅ Edge cases (zero/negative intervals, very high EF)
- ✅ Realistic learning scenarios (struggling vs easy cards)
- ✅ Date calculation

**Total**: 30+ test cases covering all algorithm paths.

---

## Architecture Decision

**Chosen**: **Pragmatic API-Direct Approach** (Option A)

**Rationale**: 
- Entire app uses direct Prisma in API endpoints
- No other feature uses domain layer pattern
- Simpler is better - less code to maintain
- Domain layer existed but was never integrated

**What we kept**:
- Single source of truth: `server/utils/sm2.ts`
- Configurable via `SM2Policy` interface
- Fully tested with comprehensive suite
- Reusable across codebase

**What we removed**:
- Unused `SREngine`, `SRScheduler`, repository interfaces
- Duplicate algorithm implementations
- Architectural complexity without benefit

---

## Validation

### Algorithm Correctness
✅ Grade boundary `>= 3` advances, `< 3` resets  
✅ First success → 1 day interval  
✅ Second success → 6 days interval  
✅ Third+ success → `interval * easeFactor`  
✅ Ease factor updated on every grade  
✅ Ease factor clamped to `[1.3, ∞)`  
✅ Interval capped at maxIntervalDays (180)

### Queue Management
✅ Only due cards (`nextReviewAt <= now`) appear  
✅ Suspended cards excluded from queue  
✅ Stats accurately count new/learning/due cards  
✅ Performance optimized with parallel queries

### Data Integrity
✅ Transactions prevent race conditions  
✅ Idempotency prevents duplicate grades  
✅ `nextReviewAt` always set correctly  
✅ Ease factor never goes below 1.3  
✅ Interval never exceeds 180 days

### Code Quality
✅ Single algorithm implementation  
✅ Extracted to testable utility  
✅ Comprehensive test coverage  
✅ Proper TypeScript types  
✅ Configuration via policy interface  
✅ Clear documentation

---

## Future Considerations

### If Algorithm Needs Change
1. Update `server/utils/sm2.ts`
2. Update tests in `tests/server/utils/sm2.spec.ts`
3. Run tests to verify
4. Update documentation

### If Policy Needs Adjustment
Modify `DEFAULT_SM2_POLICY` in `server/utils/sm2.ts`:
```typescript
export const DEFAULT_SM2_POLICY: SM2Policy = {
  minEaseFactor: 1.3,        // Lower bound for difficulty
  maxIntervalDays: 180,      // Maximum 6 months
  firstIntervalDays: 1,      // First success: tomorrow
  secondIntervalDays: 6,     // Second success: 6 days
};
```

### If Different Algorithm Needed
1. Create new file (e.g., `server/utils/sm17.ts`)
2. Implement same interface: `calculateSM2(params, policy)`
3. Update import in `server/api/review/grade.post.ts`
4. Add tests for new algorithm

---

## Files Changed

### Modified
- `server/api/review/grade.post.ts` - Use SM-2 utility, remove duplicate code
- `server/api/review/queue.get.ts` - Add suspended filter, fix due count
- `docs/spaced-repetition/SPACED_REPETITION.md` - Clarify grade 2 behavior
- `docs/spaced-repetition/LOGIC_VALIDATION.md` - Update status to fixed

### Created
- `server/utils/sm2.ts` - SM-2 algorithm utility (new)
- `tests/server/utils/sm2.spec.ts` - Comprehensive test suite (new)

### Deleted
- `app/domain/sr/SREngine.ts` - Unused
- `app/domain/sr/SRScheduler.ts` - Unused
- `app/domain/sr/SRTypes.ts` - Unused
- `app/domain/repositories/CardReviewRepository.ts` - Unused
- `app/domain/repositories/PrismaCardReviewRepository.ts` - Unused
- `app/domain/repositories/CardRepository.ts` - Unused
- `app/domain/repositories/PrismaCardRepository.ts` - Unused

---

## Conclusion

All critical issues identified in the validation report have been resolved:

1. ✅ **Architecture consistency** - Now follows app's pragmatic pattern
2. ✅ **Single source of truth** - One SM-2 implementation
3. ✅ **Queue correctness** - Proper filtering and counting
4. ✅ **Documentation accuracy** - Grade meanings clarified
5. ✅ **Code quality** - Extracted, tested, reusable
6. ✅ **Maintainability** - Less code, clearer structure

The spaced repetition system is now **production-ready** with:
- ✅ Correct SM-2 algorithm implementation
- ✅ Proper queue management
- ✅ Clear documentation
- ✅ Comprehensive test coverage
- ✅ Maintainable architecture
