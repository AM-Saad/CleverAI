import { describe, it, expect } from 'vitest';
import { calculateSM2, calculateNextReviewDate, DEFAULT_SM2_POLICY } from '../../../server/utils/sm2';

describe('SM-2 Algorithm', () => {
  describe('calculateSM2', () => {
    describe('Grade Boundaries', () => {
      it('should reset progress on grade 0 (complete blackout)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 14,
          currentRepetitions: 3,
          grade: 0,
        });

        expect(result.repetitions).toBe(0);
        expect(result.intervalDays).toBe(1);
        expect(result.easeFactor).toBeLessThan(2.5); // Should decrease
        expect(result.easeFactor).toBeCloseTo(1.7); // 2.5 - 0.8
      });

      it('should reset progress on grade 1 (incorrect but recognized)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 14,
          currentRepetitions: 3,
          grade: 1,
        });

        expect(result.repetitions).toBe(0);
        expect(result.intervalDays).toBe(1);
        expect(result.easeFactor).toBeCloseTo(1.96); // 2.5 - 0.54
      });

      it('should reset progress on grade 2 (incorrect, needed help)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 14,
          currentRepetitions: 3,
          grade: 2,
        });

        expect(result.repetitions).toBe(0);
        expect(result.intervalDays).toBe(1);
        expect(result.easeFactor).toBeCloseTo(2.18); // 2.5 - 0.32
      });

      it('should progress on grade 3 (correct with hesitation)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 6,
          currentRepetitions: 1,
          grade: 3,
        });

        expect(result.repetitions).toBe(2);
        expect(result.intervalDays).toBeGreaterThan(6);
        expect(result.easeFactor).toBeCloseTo(2.36); // 2.5 - 0.14
      });

      it('should progress on grade 4 (correct with effort)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 6,
          currentRepetitions: 1,
          grade: 4,
        });

        expect(result.repetitions).toBe(2);
        expect(result.intervalDays).toBeGreaterThan(6);
        expect(result.easeFactor).toBe(2.5); // No change
      });

      it('should progress on grade 5 (perfect recall)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 6,
          currentRepetitions: 1,
          grade: 5,
        });

        expect(result.repetitions).toBe(2);
        expect(result.intervalDays).toBeGreaterThan(6);
        expect(result.easeFactor).toBeCloseTo(2.6); // 2.5 + 0.1
      });
    });

    describe('Interval Progression', () => {
      it('should use 1 day interval for first success (repetitions = 0)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 0,
          currentRepetitions: 0,
          grade: 4,
        });

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(1);
      });

      it('should use 6 days interval for second success (repetitions = 1)', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 1,
          currentRepetitions: 1,
          grade: 4,
        });

        expect(result.intervalDays).toBe(6);
        expect(result.repetitions).toBe(2);
      });

      it('should use formula (interval * EF) for third+ success', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 6,
          currentRepetitions: 2,
          grade: 4,
        });

        expect(result.intervalDays).toBe(Math.round(6 * 2.5)); // 15 days
        expect(result.repetitions).toBe(3);
      });

      it('should apply formula correctly with higher repetitions', () => {
        const result = calculateSM2({
          currentEF: 2.3,
          currentInterval: 14,
          currentRepetitions: 3,
          grade: 5,
        });

        expect(result.intervalDays).toBe(Math.round(14 * 2.3)); // 32 days
        expect(result.repetitions).toBe(4);
        expect(result.easeFactor).toBeCloseTo(2.4); // 2.3 + 0.1
      });
    });

    describe('Ease Factor Updates', () => {
      it('should apply correct ease factor changes for each grade', () => {
        const baseEF = 2.5;
        const baseParams = {
          currentEF: baseEF,
          currentInterval: 10,
          currentRepetitions: 2,
        };

        const grade0 = calculateSM2({ ...baseParams, grade: 0 });
        expect(grade0.easeFactor).toBeCloseTo(baseEF - 0.8);

        const grade1 = calculateSM2({ ...baseParams, grade: 1 });
        expect(grade1.easeFactor).toBeCloseTo(baseEF - 0.54);

        const grade2 = calculateSM2({ ...baseParams, grade: 2 });
        expect(grade2.easeFactor).toBeCloseTo(baseEF - 0.32);

        const grade3 = calculateSM2({ ...baseParams, grade: 3 });
        expect(grade3.easeFactor).toBeCloseTo(baseEF - 0.14);

        const grade4 = calculateSM2({ ...baseParams, grade: 4 });
        expect(grade4.easeFactor).toBeCloseTo(baseEF);

        const grade5 = calculateSM2({ ...baseParams, grade: 5 });
        expect(grade5.easeFactor).toBeCloseTo(baseEF + 0.1);
      });

      it('should enforce minimum ease factor of 1.3', () => {
        const result = calculateSM2({
          currentEF: 1.4,
          currentInterval: 10,
          currentRepetitions: 2,
          grade: 0, // Massive penalty (-0.8)
        });

        expect(result.easeFactor).toBe(1.3); // Should not go below minimum
      });

      it('should allow ease factor to grow above default', () => {
        let ef = 2.5;
        let interval = 6;
        let repetitions = 2;

        // Simulate 5 perfect recalls
        for (let i = 0; i < 5; i++) {
          const result = calculateSM2({
            currentEF: ef,
            currentInterval: interval,
            currentRepetitions: repetitions,
            grade: 5,
          });
          ef = result.easeFactor;
          interval = result.intervalDays;
          repetitions = result.repetitions;
        }

        expect(ef).toBeGreaterThan(2.5);
        expect(ef).toBeCloseTo(3.0); // 2.5 + (5 * 0.1)
      });
    });

    describe('Interval Capping', () => {
      it('should cap interval at maxIntervalDays (180 days)', () => {
        const result = calculateSM2({
          currentEF: 3.0,
          currentInterval: 100,
          currentRepetitions: 5,
          grade: 5,
        });

        // 100 * 3.0 = 300, but should be capped at 180
        expect(result.intervalDays).toBe(180);
      });

      it('should respect custom policy maxIntervalDays', () => {
        const customPolicy = {
          ...DEFAULT_SM2_POLICY,
          maxIntervalDays: 90,
        };

        const result = calculateSM2(
          {
            currentEF: 3.0,
            currentInterval: 50,
            currentRepetitions: 5,
            grade: 5,
          },
          customPolicy
        );

        // 50 * 3.0 = 150, but should be capped at 90
        expect(result.intervalDays).toBe(90);
      });
    });

    describe('Custom Policy', () => {
      it('should use custom first and second intervals', () => {
        const customPolicy = {
          ...DEFAULT_SM2_POLICY,
          firstIntervalDays: 2,
          secondIntervalDays: 10,
        };

        const firstSuccess = calculateSM2(
          {
            currentEF: 2.5,
            currentInterval: 0,
            currentRepetitions: 0,
            grade: 4,
          },
          customPolicy
        );
        expect(firstSuccess.intervalDays).toBe(2);

        const secondSuccess = calculateSM2(
          {
            currentEF: 2.5,
            currentInterval: 2,
            currentRepetitions: 1,
            grade: 4,
          },
          customPolicy
        );
        expect(secondSuccess.intervalDays).toBe(10);
      });

      it('should use custom minimum ease factor', () => {
        const customPolicy = {
          ...DEFAULT_SM2_POLICY,
          minEaseFactor: 1.5,
        };

        const result = calculateSM2(
          {
            currentEF: 1.6,
            currentInterval: 10,
            currentRepetitions: 2,
            grade: 0, // Would bring it to 0.8
          },
          customPolicy
        );

        expect(result.easeFactor).toBe(1.5); // Custom minimum
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero interval correctly', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: 0,
          currentRepetitions: 0,
          grade: 4,
        });

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(1);
      });

      it('should handle negative intervals gracefully', () => {
        const result = calculateSM2({
          currentEF: 2.5,
          currentInterval: -5, // Invalid but should handle
          currentRepetitions: 0,
          grade: 4,
        });

        expect(result.intervalDays).toBe(1); // First success always 1 day
      });

      it('should handle very high ease factors', () => {
        const result = calculateSM2({
          currentEF: 5.0,
          currentInterval: 30,
          currentRepetitions: 10,
          grade: 5,
        });

        expect(result.intervalDays).toBe(180); // Capped at max
        expect(result.easeFactor).toBeCloseTo(5.1);
      });
    });

    describe('Realistic Learning Scenarios', () => {
      it('should simulate struggling card (multiple failures)', () => {
        let ef = 2.5;
        let interval = 0;
        let reps = 0;

        // First attempt - fail
        let result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 1 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(reps).toBe(0);
        expect(interval).toBe(1);

        // Second attempt - still fail
        result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 2 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(reps).toBe(0);
        expect(interval).toBe(1);

        // Third attempt - success!
        result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 3 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(reps).toBe(1);
        expect(interval).toBe(1);

        // Ease factor should have decreased from failures
        expect(ef).toBeLessThan(2.5);
      });

      it('should simulate easy card (consistent perfect recalls)', () => {
        let ef = 2.5;
        let interval = 0;
        let reps = 0;

        // Review 1: 1 day
        let result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 5 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(interval).toBe(1);

        // Review 2: 6 days
        result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 5 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(interval).toBe(6);

        // Review 3: ~16 days (6 * 2.6)
        result = calculateSM2({ currentEF: ef, currentInterval: interval, currentRepetitions: reps, grade: 5 });
        ef = result.easeFactor;
        interval = result.intervalDays;
        reps = result.repetitions;
        expect(interval).toBeGreaterThan(15);

        // Ease factor should have increased
        expect(ef).toBeGreaterThan(2.5);
      });
    });
  });

  describe('calculateNextReviewDate', () => {
    it('should add interval days to current date', () => {
      const now = new Date('2025-11-26T12:00:00Z');
      const result = calculateNextReviewDate(7, now);

      expect(result.toISOString()).toBe('2025-12-03T12:00:00.000Z');
    });

    it('should handle zero interval', () => {
      const now = new Date('2025-11-26T12:00:00Z');
      const result = calculateNextReviewDate(0, now);

      expect(result.toISOString()).toBe('2025-11-26T12:00:00.000Z');
    });

    it('should handle month boundaries', () => {
      const now = new Date('2025-11-28T12:00:00Z');
      const result = calculateNextReviewDate(5, now);

      expect(result.toISOString()).toBe('2025-12-03T12:00:00.000Z');
    });

    it('should use current time if no date provided', () => {
      const before = new Date();
      const result = calculateNextReviewDate(1);
      const after = new Date();

      // Result should be between before and after + 1 day
      expect(result.getTime()).toBeGreaterThan(before.getTime());
      expect(result.getTime()).toBeLessThan(after.getTime() + 86400000 + 1000);
    });
  });
});
