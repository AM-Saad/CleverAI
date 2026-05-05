import { describe, expect, it } from "vitest";
import { gradeReviewCard } from "../../server/modules/review/application/gradeReviewCard";
import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "../../server/modules/review/ports/ReviewRepository";
import type { XpPort } from "../../server/modules/review/ports/XpPort";

class FakeRepository implements ReviewRepository {
  constructor(public record: ReviewCardRecord) {}

  async findByIdForUser() {
    return this.record;
  }

  async updateAfterGrade(_tx: unknown, input: UpdateReviewCardInput) {
    this.record = {
      ...this.record,
      easeFactor: input.easeFactor,
      intervalDays: input.intervalDays,
      repetitions: input.repetitions,
      nextReviewAt: input.nextReviewAt,
      streak: input.streak,
    };
    return this.record;
  }
}

class FakeXpPort implements XpPort {
  async awardReviewXp() {
    return 7;
  }

  async awardEnrollXp() {
    return 3;
  }
}

function fakePrisma() {
  return {
    gradeRequest: {
      findUnique: async () => null,
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) =>
      fn({
        gradeRequest: {
          create: async () => ({}),
        },
      }),
  };
}

describe("gradeReviewCard", () => {
  it("grades a review card through the shared SM-2 workflow", async () => {
    const repository = new FakeRepository({
      id: "review-1",
      userId: "user-1",
      resourceId: "card-1",
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: new Date("2026-01-01T00:00:00.000Z"),
      streak: 0,
    });

    const result = await gradeReviewCard({
      prisma: fakePrisma(),
      repository,
      xpPort: new FakeXpPort(),
      userId: "user-1",
      cardId: "review-1",
      grade: 4,
      requestId: "request-1",
      xpSource: "review",
    });

    expect(result.intervalDays).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(result.xpEarned).toBe(7);
    expect(repository.record.repetitions).toBe(1);
    expect(repository.record.streak).toBe(1);
  });
});
