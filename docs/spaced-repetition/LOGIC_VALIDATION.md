# Spaced Repetition Logic Validation Report

**Date**: November 26, 2025  
**Scope**: Core SM-2 algorithm, queue management, grading workflow  
**Status**: ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

**Status**: ✅ **ALL CRITICAL ISSUES RESOLVED**

The spaced repetition system has been refactored to follow the app's pragmatic architecture pattern. All critical issues have been fixed.

### Fixes Applied (November 26, 2025)

| Issue | Status | Solution |
|-------|--------|----------|
| Dual SM-2 implementations | ✅ FIXED | Removed unused domain layer, extracted to `server/utils/sm2.ts` |
| Queue suspended card filtering | ✅ FIXED | Added `suspended: false` to WHERE clause |
| Queue stats calculation | ✅ FIXED | Proper count queries for all stats including due cards |
| Grade 2 documentation confusion | ✅ FIXED | Updated docs to clarify it resets progress |
| No unit tests for algorithm | ✅ FIXED | Added comprehensive test suite in `tests/server/utils/sm2.spec.ts` |

---

## SM-2 Algorithm Analysis

### Implementation Comparison

#### API Implementation (ACTIVE - Currently Used)
**Location**: `server/api/review/grade.post.ts`

```typescript
function calculateSM2(params: {
  currentEF: number;
  currentInterval: number;
  currentRepetitions: number;
  grade: number;
}): { easeFactor: number; intervalDays: number; repetitions: number } {
  const { currentEF, currentInterval, currentRepetitions, grade } = params;

  let easeFactor = currentEF;
  let intervalDays = currentInterval;
  let repetitions = currentRepetitions;

  // BOUNDARY: grade >= 3 is success
  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(currentInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response - reset repetitions and interval
    repetitions = 0;
    intervalDays = 1;
  }

  // Update ease factor (applies to ALL grades)
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));

  // Ensure ease factor stays within bounds
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Cap interval at 180 days
  if (intervalDays > 180) {
    intervalDays = 180;
  }

  return { easeFactor, intervalDays, repetitions };
}
```

**Logic Analysis**:
- ✅ Grade boundary at `≥3` means grades 3, 4, 5 advance progress
- ✅ Grades 0, 1, 2 reset to start (repetitions = 0, interval = 1 day)
- ✅ First success: 1 day interval
- ✅ Second success: 6 days interval
- ✅ Third+ success: `interval * easeFactor`
- ✅ Ease factor updated for ALL grades (even resets)
- ✅ Lower bound enforced: `easeFactor >= 1.3`
- ✅ Interval cap: `intervalDays <= 180`

**Ease Factor Formula**:
```
EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
```

**Grade Impact on EF**:
- Grade 0: `EF - 0.8` (massive penalty)
- Grade 1: `EF - 0.54` (large penalty)
- Grade 2: `EF - 0.32` (medium penalty)
- Grade 3: `EF - 0.14` (small penalty)
- Grade 4: `EF + 0` (no change)
- Grade 5: `EF + 0.1` (reward)

---

#### Domain Layer Implementation (DORMANT - Not Used)
**Location**: `app/domain/sr/SRScheduler.ts`

```typescript
export class Sm2Scheduler implements SRScheduler {
  next(prev: ReviewState, grade: 0|1|2|3|4|5, policy = defaultSRPolicy, now = new Date()): ReviewState {
    const p: SRPolicy = policy;

    // Clamp grade defensively
    const g = Math.max(0, Math.min(5, grade));

    // Ease factor update (SM-2 style)
    const delta = 0.1 - (5 - g) * (0.08 + (5 - g) * 0.02);
    const easeFactor = Math.max(p.minEaseFactor, (prev.easeFactor ?? p.defaultEaseFactor) + delta);

    // BOUNDARY: g < 3 is failure
    const repetitions = g < 3 ? 0 : (prev.repetitions ?? 0) + 1;

    // Base interval selection
    let intervalDays: number;
    if (g < 3) {
      // Lapse → quick revisit
      intervalDays = p.firstIntervalDays;
    } else if (repetitions <= 1) {
      intervalDays = p.firstIntervalDays;
    } else if (repetitions === 2) {
      intervalDays = p.secondIntervalDays;
    } else {
      const prevInterval = prev.intervalDays > 0 ? prev.intervalDays : p.secondIntervalDays;
      intervalDays = Math.round(prevInterval * easeFactor);
    }

    // Clamp interval to [1, max]
    intervalDays = Math.max(1, Math.min(p.maxIntervalDays, intervalDays));

    // Compute next review date
    const nextReviewAt = new Date(now.getTime());
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

    return {
      ...prev,
      repetitions,
      easeFactor,
      intervalDays,
      nextReviewAt,
      lastReviewedAt: now,
      lastGrade: g,
    };
  }
}
```

**Logic Analysis**:
- ✅ **SAME** grade boundary at `< 3` (equivalent to API's `>= 3`)
- ✅ **SAME** ease factor formula
- ✅ **SAME** first/second interval logic
- ✅ **SAME** interval capping with policy
- ✅ **BETTER**: Uses configurable policy instead of hardcoded values
- ✅ **BETTER**: More defensive with nullish coalescing
- ✅ **BETTER**: Proper Date handling with nextReviewAt calculation
- ✅ **BETTER**: Returns complete ReviewState object

---

### Critical Difference: Which Implementation is Used?

**ACTUAL PRODUCTION FLOW**:
```
User grades card
    ↓
POST /api/review/grade
    ↓
calculateSM2() in grade.post.ts  ← API IMPLEMENTATION USED
    ↓
Update database directly with Prisma
```

**EXPECTED DDD FLOW** (not happening):
```
User grades card
    ↓
POST /api/review/grade
    ↓
SREngine.grade()
    ↓
SRScheduler.next()  ← DOMAIN IMPLEMENTATION (NOT USED)
    ↓
CardReviewRepository.update()
```

**Verdict**: The domain layer (`SREngine`, `SRScheduler`) exists but **IS NOT BEING USED**. The API endpoint bypasses it entirely and implements SM-2 directly.

---

## Grade Boundary Analysis

### What Happens to Grade 2?

**Current Behavior** (API Implementation):
```typescript
if (grade >= 3) {
  // Progress continues
  repetitions += 1;
  intervalDays = calculated_value;
} else {
  // Grade 0, 1, 2 all RESET
  repetitions = 0;
  intervalDays = 1;
}
```

**Meaning**:
- Grade 2 = "Hard (correct with difficulty)" per documentation
- **But grade 2 resets progress** just like grades 0 and 1
- This is **INCONSISTENT** with documentation

**Documentation Says**:
| Grade | Meaning | Algorithm Effect |
|-------|---------|------------------|
| 0 | **Again** (complete blackout) | Reset to start |
| 1 | **Hard** (incorrect but familiar) | Reset to start |
| 2 | **Hard** (correct with difficulty) | Reset to start |
| 3 | **Good** (correct with hesitation) | Normal progression |

**Problem**: Grade 2 is labeled "correct" but treated as "incorrect" algorithmically.

**Options**:
1. ✅ **Keep current behavior** - Change docs to say grade 2 is "incorrect"
2. ❌ Change boundary to `grade >= 2` - Makes grade 2 advance (breaks SM-2 standard)
3. ✅ **Use 4-point scale** (0-1-2-3 or 0-1-3-4) to avoid confusion

---

## Queue Management Analysis

### Queue Fetching Logic

**Location**: `server/api/review/queue.get.ts`

```typescript
const whereClause = {
  userId: user.id,
  nextReviewAt: { lte: new Date() },  // Due cards only
  ...(folderId ? { folderId } : {}),
};

cardReviews = await prisma.cardReview.findMany({
  where: whereClause,
  take: limit,
  orderBy: { nextReviewAt: "asc" },  // Oldest due first
});
```

**Logic Assessment**:
- ✅ Correctly filters by `nextReviewAt <= now`
- ✅ Orders by oldest due first (FIFO for due cards)
- ✅ Respects folder filtering
- ✅ Limits result set
- ❌ **No suspended card filtering** (bug if suspend feature is used)
- ⚠️ No consideration for "new card daily cap" from policy

**Missing Logic**:
```typescript
// Should include:
const whereClause = {
  userId: user.id,
  nextReviewAt: { lte: new Date() },
  suspended: false,  // ← MISSING
  ...(folderId ? { folderId } : {}),
};
```

---

### Queue Statistics Calculation

**Current Implementation**:
```typescript
const [totalCards, newCards, learningCards] = await Promise.all([
  prisma.cardReview.count({
    where: { userId: user.id, ...(folderId ? { folderId } : {}) },
  }),
  prisma.cardReview.count({
    where: { userId: user.id, repetitions: 0, ...(folderId ? { folderId } : {}) },
  }),
  prisma.cardReview.count({
    where: { userId: user.id, repetitions: { gt: 0, lt: 3 }, ...(folderId ? { folderId } : {}) },
  }),
]);
const dueCards = cardReviews.length;
```

**Performance Analysis**:
- ✅ Uses `Promise.all` for parallelization
- ❌ **3 separate COUNT queries** instead of 1 aggregation
- ❌ `dueCards` is just the fetched limit, not actual due count
- ⚠️ `learningCards` definition (`repetitions: 1-2`) is arbitrary

**Better Approach**:
```typescript
const stats = await prisma.cardReview.groupBy({
  by: ['repetitions'],
  where: { userId: user.id, ...(folderId ? { folderId } : {}) },
  _count: true,
});

const dueCount = await prisma.cardReview.count({
  where: {
    userId: user.id,
    nextReviewAt: { lte: new Date() },
    ...(folderId ? { folderId } : {}),
  },
});
```

---

## Grading Workflow Analysis

### Transaction Safety

**Current Implementation**:
```typescript
const updatedCard = await prisma.$transaction(async (tx) => {
  // Fetch card review (locks row)
  const cardReview = await tx.cardReview.findFirst({
    where: { id: validatedBody.cardId, userId: user.id },
  });
  
  if (!cardReview) throw Errors.notFound("card");

  // Calculate new values
  const { easeFactor, intervalDays, repetitions } = calculateSM2({...});

  // Update card
  const updated = await tx.cardReview.update({
    where: { id: validatedBody.cardId },
    data: { easeFactor, intervalDays, repetitions, ... },
  });

  // Record idempotency token
  if (validatedBody.requestId) {
    await tx.gradeRequest.create({ ... }).catch(() => {});
  }

  return updated;
});
```

**Transaction Analysis**:
- ✅ **Proper transaction usage** for atomicity
- ✅ Row-level locking via `findFirst` within transaction
- ✅ Prevents race conditions from concurrent grades
- ✅ Idempotency support via `requestId`
- ⚠️ Silent catch on `gradeRequest.create` could hide issues

**Idempotency Logic**:
```typescript
if (validatedBody.requestId) {
  const existing = await prisma.gradeRequest.findUnique({
    where: { requestId: validatedBody.requestId },
  });
  if (existing) {
    // Return cached result without re-grading
    return cached_response;
  }
}
```

**Assessment**:
- ✅ Prevents duplicate grades from network retries
- ✅ Returns existing result on duplicate request
- ⚠️ Depends on client generating unique requestId

---

## Policy Configuration Analysis

**Current Policy** (`app/domain/sr/SRPolicy.ts`):
```typescript
export const defaultSRPolicy: SRPolicy = {
  defaultEaseFactor: 2.5,    // Standard SM-2
  minEaseFactor: 1.3,        // Standard SM-2
  firstIntervalDays: 1,       // 1 day for first success
  secondIntervalDays: 6,      // 6 days for second success
  maxIntervalDays: 180,       // 6 months max (reasonable)
  dailyNewCap: 10,            // UNUSED in current implementation
}
```

**Usage**:
- ✅ Policy exists in domain layer
- ❌ **NOT USED** - API hardcodes values instead
- ❌ `dailyNewCap` not enforced anywhere
- ❌ No runtime configuration possible

**Hardcoded Values in API**:
```typescript
// In calculateSM2():
if (easeFactor < 1.3) { easeFactor = 1.3; }  // hardcoded minEF
if (intervalDays > 180) { intervalDays = 180; }  // hardcoded maxInterval

// In interval logic:
if (repetitions === 0) { intervalDays = 1; }  // hardcoded firstInterval
else if (repetitions === 1) { intervalDays = 6; }  // hardcoded secondInterval
```

---

## Recommendations

### Priority 1: Architecture Decision (Choose One)

#### Option A: Keep API Implementation (Pragmatic)
**If domain layer is overkill for your needs:**

1. **Delete unused domain layer code**:
   - Remove `app/domain/sr/SREngine.ts`
   - Remove `app/domain/sr/SRScheduler.ts`
   - Remove `app/domain/repositories/CardReviewRepository.ts`

2. **Extract calculateSM2 to shared utility**:
   ```typescript
   // server/utils/sm2.ts
   export function calculateSM2(params) { ... }
   ```

3. **Add policy configuration**:
   ```typescript
   // Use env vars or config file instead of hardcoded values
   const SM2_MIN_EF = process.env.SM2_MIN_EF || 1.3;
   const SM2_MAX_INTERVAL = process.env.SM2_MAX_INTERVAL || 180;
   ```

4. **Update documentation** to reflect architecture

**Pros**: Simpler, less code, faster to understand  
**Cons**: Less testable, no separation of concerns, harder to swap algorithms

---

#### Option B: Use Domain Layer (DDD Approach)
**If you want proper architecture:**

1. **Refactor API endpoint to use domain layer**:
   ```typescript
   // server/api/review/grade.post.ts
   import { getSREngine } from '@server/domain/sr/engine-factory';
   
   export default defineEventHandler(async (event) => {
     const user = await requireRole(event, ["USER"]);
     const validatedBody = GradeCardRequestSchema.parse(await readBody(event));
     
     const engine = getSREngine();  // Factory provides configured engine
     
     const updatedState = await engine.grade({
       userId: user.id,
       cardId: validatedBody.cardId,
       grade: parseInt(validatedBody.grade),
       requestId: validatedBody.requestId,
     });
     
     // Schedule notification...
     
     return success({
       nextReviewAt: updatedState.nextReviewAt.toISOString(),
       intervalDays: updatedState.intervalDays,
       easeFactor: updatedState.easeFactor,
       message: "Card graded successfully",
     });
   });
   ```

2. **Delete duplicate calculateSM2** from API file

3. **Implement PrismaCardReviewRepository** properly

4. **Add tests** for domain layer logic

**Pros**: Clean architecture, testable, swappable algorithms, proper separation  
**Cons**: More code, more complexity, requires refactoring

---

### Priority 2: Fix Grade 2 Semantics

**Current confusion**:
- Documentation says grade 2 is "Hard (correct with difficulty)"
- Algorithm treats grade 2 as failure (resets progress)

**Solution Options**:

1. **Update documentation to match code**:
   ```markdown
   | Grade | Meaning | Effect |
   |-------|---------|--------|
   | 0 | Again (complete blackout) | Reset |
   | 1 | Hard (incorrect but recognized) | Reset |
   | 2 | Hard (incorrect, needed hint) | Reset |
   | 3 | Good (correct with hesitation) | Progress |
   | 4 | Good (correct with effort) | Progress |
   | 5 | Easy (perfect recall) | Progress |
   ```

2. **Use 4-point scale** (clearer semantics):
   ```markdown
   | Grade | Meaning | Effect |
   |-------|---------|--------|
   | 0 | Again (no recall) | Reset |
   | 1 | Hard (struggled) | Reset |
   | 3 | Good (remembered) | Progress |
   | 4 | Easy (instant recall) | Progress |
   ```
   Then remap UI buttons to skip grade 2.

---

### Priority 3: Fix Queue Management

1. **Add suspended card filtering**:
   ```typescript
   const whereClause = {
     userId: user.id,
     nextReviewAt: { lte: new Date() },
     suspended: false,  // Add this
     ...(folderId ? { folderId } : {}),
   };
   ```

2. **Fix due cards count**:
   ```typescript
   const dueCards = await prisma.cardReview.count({
     where: {
       userId: user.id,
       nextReviewAt: { lte: new Date() },
       ...(folderId ? { folderId } : {}),
     },
   });
   ```

3. **Optimize stats with aggregation**:
   ```typescript
   const stats = await prisma.cardReview.aggregate({
     where: { userId: user.id, ...(folderId ? { folderId } : {}) },
     _count: true,
     _sum: { /* if tracking review counts */ },
   });
   ```

---

### Priority 4: Testing & Validation

1. **Add unit tests for calculateSM2**:
   ```typescript
   describe('SM-2 Algorithm', () => {
     it('should reset progress on grade < 3', () => {
       const result = calculateSM2({
         currentEF: 2.5,
         currentInterval: 14,
         currentRepetitions: 3,
         grade: 2,
       });
       
       expect(result.repetitions).toBe(0);
       expect(result.intervalDays).toBe(1);
       expect(result.easeFactor).toBeLessThan(2.5);
     });
     
     it('should progress on grade >= 3', () => {
       const result = calculateSM2({
         currentEF: 2.5,
         currentInterval: 6,
         currentRepetitions: 1,
         grade: 4,
       });
       
       expect(result.repetitions).toBe(2);
       expect(result.intervalDays).toBeGreaterThan(6);
     });
   });
   ```

2. **Integration tests for grading workflow**

3. **Load testing for concurrent grades**

---

## Verification Checklist

Use this to validate the implementation:

### Algorithm Correctness
- [ ] Grade boundary `>= 3` advances, `< 3` resets
- [ ] First success → 1 day interval
- [ ] Second success → 6 days interval
- [ ] Third+ success → `interval * easeFactor`
- [ ] Ease factor updated on every grade
- [ ] Ease factor clamped to `[1.3, ∞)`
- [ ] Interval capped at maxIntervalDays (180)

### Grade Semantics
- [ ] Grade meanings documented accurately
- [ ] UI grade buttons match documented behavior
- [ ] Users understand grade 2 resets progress

### Queue Management
- [ ] Only due cards (`nextReviewAt <= now`) appear
- [ ] Suspended cards excluded from queue
- [ ] Stats accurately count new/learning/due cards
- [ ] Performance acceptable with large card counts

### Data Integrity
- [ ] Transactions prevent race conditions
- [ ] Idempotency prevents duplicate grades
- [ ] nextReviewAt always set correctly
- [ ] Ease factor never goes below 1.3
- [ ] Interval never exceeds 180 days

### Architecture
- [ ] Code architecture documented and understood
- [ ] Domain layer either used or removed
- [ ] No duplicate algorithm implementations
- [ ] Configuration values not hardcoded

---

## Conclusion

The spaced repetition system implements **standard SM-2 algorithm correctly** but has significant architectural issues:

1. **Duplicate implementations** exist with identical logic
2. **Domain layer is bypassed** - architecture not followed
3. **Grade 2 semantics** need documentation update
4. **Queue filtering** missing suspended cards check
5. **Stats calculation** could be optimized

**Recommendation**: Choose between pragmatic API-only approach or proper DDD architecture, then remove duplicate code and fix queue filtering.

The **algorithm math is correct** - the issues are purely architectural and documentation.
