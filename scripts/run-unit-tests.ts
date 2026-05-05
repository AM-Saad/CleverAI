import assert from "node:assert/strict";
import { calculateSM2 } from "../server/modules/review/domain/sm2";
import { gradeReviewCard } from "../server/modules/review/application/gradeReviewCard";
import { syncBoardItems } from "../server/modules/board/application/syncBoardItems";
import { syncWorkspaceNotes } from "../server/modules/notes/application/syncWorkspaceNotes";
import { consumeGenerationQuota } from "../server/modules/subscription/application/generationQuota";
import { createStripeCreditCheckout } from "../server/modules/subscription/application/createStripeCreditCheckout";
import { rewardAdCredit } from "../server/modules/subscription/application/rewardAdCredit";
import { grantStripePurchaseCredits } from "../server/modules/subscription/application/grantStripePurchaseCredits";
import { saveGeneratedArtifacts } from "../server/modules/ai-generation/application/saveGeneratedArtifacts";
import { prepareGatewayGeneration } from "../server/modules/ai-generation/application/prepareGatewayGeneration";
import { mergePendingBoardItems } from "../app/features/board/composables/mergePendingBoardItems";
import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "../server/modules/review/ports/ReviewRepository";
import type { XpPort } from "../server/modules/review/ports/XpPort";
import type { BoardItemState } from "../app/features/board/composables/useBoardItemsStore";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

class FakeReviewRepository implements ReviewRepository {
  constructor(public record: ReviewCardRecord | null) {}

  async findByIdForUser() {
    return this.record;
  }

  async updateAfterGrade(_tx: unknown, input: UpdateReviewCardInput) {
    assert.ok(this.record, "expected a review record to update");
    this.record = {
      ...this.record,
      easeFactor: input.easeFactor,
      intervalDays: input.intervalDays,
      repetitions: input.repetitions,
      nextReviewAt: input.nextReviewAt,
      lastReviewedAt: input.lastReviewedAt,
      lastGrade: input.lastGrade,
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

function fakePrismaForReview() {
  return {
    gradeRequest: {
      findUnique: async () => null,
    },
    $transaction: async <T>(fn: (tx: any) => Promise<T>) =>
      fn({
        gradeRequest: {
          create: async () => ({}),
        },
      }),
  };
}

function fakeNotesPrisma() {
  const notes = new Map<string, any>();
  let noteSequence = 1;

  return {
    notes,
    prisma: {
      workspace: {
        findFirst: async ({ where }: any) =>
          where.id === "workspace-1" && where.userId === "user-1"
            ? { id: "workspace-1", userId: "user-1" }
            : null,
      },
      note: {
        findFirst: async ({ where }: any) => notes.get(where.id) ?? null,
        create: async ({ data }: any) => {
          const id = data.id ?? `server-note-${noteSequence++}`;
          const row = {
            id,
            workspaceId: data.workspaceId,
            content: data.content,
            tags: data.tags,
            noteType: data.noteType,
            metadata: data.metadata,
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          };
          notes.set(id, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const existing = notes.get(where.id);
          assert.ok(existing, "expected existing note");
          const row = { ...existing, ...data, updatedAt: new Date() };
          notes.set(where.id, row);
          return row;
        },
        delete: async ({ where }: any) => {
          const existing = notes.get(where.id);
          notes.delete(where.id);
          return existing;
        },
      },
    },
  };
}

function fakeBoardPrisma() {
  const boardItems = new Map<string, any>();
  let boardItemSequence = 1;

  return {
    boardItems,
    prisma: {
      workspace: {
        findFirst: async ({ where }: any) =>
          where.id === "workspace-1" && where.userId === "user-1"
            ? { id: "workspace-1" }
            : null,
      },
      boardItem: {
        findFirst: async ({ where }: any) => {
          const row = boardItems.get(where.id);
          return row && row.userId === where.userId ? row : null;
        },
        create: async ({ data }: any) => {
          const id = data.id ?? `server-board-${boardItemSequence++}`;
          const row = {
            id,
            userId: data.userId,
            columnId: data.columnId ?? null,
            workspaceId: data.workspaceId ?? null,
            content: data.content,
            tags: data.tags ?? [],
            order: data.order ?? 0,
            dueDate: data.dueDate ?? null,
            attachments: data.attachments ?? [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
          boardItems.set(id, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const existing = boardItems.get(where.id);
          assert.ok(existing, "expected existing board item");
          const row = { ...existing, ...data };
          boardItems.set(where.id, row);
          return row;
        },
        delete: async ({ where }: any) => {
          const existing = boardItems.get(where.id);
          boardItems.delete(where.id);
          return existing;
        },
      },
    },
  };
}

function fakeSubscriptionPrisma() {
  const subscriptions = new Map<string, any>();
  const creditTransactions: any[] = [];

  const createCreditTransaction = async ({ data }: any) => {
    creditTransactions.push(data);
    return data;
  };

  const findCreditTransaction = async ({ where }: any) => {
    const metadataFilter = where?.metadata;
    if (!metadataFilter?.path || metadataFilter.equals === undefined) {
      return null;
    }

    const [metadataKey] = metadataFilter.path;
    return (
      creditTransactions.find(
        (transaction) =>
          transaction?.metadata?.[metadataKey] === metadataFilter.equals
      ) ?? null
    );
  };

  const upsertSubscription = async ({ where, create, update }: any) => {
    const existing = subscriptions.get(where.userId);
    if (!existing) {
      const row = {
        creditBalance: 0,
        ...create,
      };
      subscriptions.set(where.userId, row);
      return row;
    }

    const row = {
      ...existing,
      creditBalance:
        update.creditBalance?.increment !== undefined
          ? existing.creditBalance + update.creditBalance.increment
          : existing.creditBalance,
      lifetimeCredits:
        update.lifetimeCredits?.increment !== undefined
          ? (existing.lifetimeCredits ?? 0) + update.lifetimeCredits.increment
          : existing.lifetimeCredits,
      lastFreeRefillAt: update.lastFreeRefillAt ?? existing.lastFreeRefillAt,
    };
    subscriptions.set(where.userId, row);
    return row;
  };

  return {
    subscriptions,
    creditTransactions,
    prisma: {
      userSubscription: {
        findUnique: async ({ where }: any) =>
          subscriptions.get(where.userId) ?? null,
        create: async ({ data }: any) => {
          const row = {
            creditBalance: 0,
            ...data,
          };
          subscriptions.set(data.userId, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const existing = subscriptions.get(where.userId);
          assert.ok(existing, "expected existing subscription");
          const row = {
            ...existing,
            generationsUsed:
              data.generationsUsed?.increment !== undefined
                ? existing.generationsUsed + data.generationsUsed.increment
                : existing.generationsUsed,
            creditBalance:
              data.creditBalance?.decrement !== undefined
                ? existing.creditBalance - data.creditBalance.decrement
                : data.creditBalance?.increment !== undefined
                  ? existing.creditBalance + data.creditBalance.increment
                  : existing.creditBalance,
          };
          subscriptions.set(where.userId, row);
          return row;
        },
        upsert: upsertSubscription,
      },
      creditTransaction: {
        create: createCreditTransaction,
        findFirst: findCreditTransaction,
      },
      $transaction: async <T>(input: any): Promise<T> => {
        if (typeof input === "function") {
          return input({
            userSubscription: {
              findUnique: async ({ where }: any) =>
                subscriptions.get(where.userId) ?? null,
              update: async ({ where, data }: any) => {
                const existing = subscriptions.get(where.userId);
                assert.ok(existing, "expected existing subscription");
                const row = {
                  ...existing,
                  generationsUsed:
                    data.generationsUsed?.increment !== undefined
                      ? existing.generationsUsed + data.generationsUsed.increment
                      : existing.generationsUsed,
                  creditBalance:
                    data.creditBalance?.decrement !== undefined
                      ? existing.creditBalance - data.creditBalance.decrement
                      : existing.creditBalance,
                };
                subscriptions.set(where.userId, row);
                return row;
              },
              upsert: upsertSubscription,
            },
            creditTransaction: {
              create: createCreditTransaction,
              findFirst: findCreditTransaction,
            },
          });
        }
        await Promise.all(input);
        return undefined as T;
      },
    },
  };
}

function fakeGenerationSavePrisma() {
  const flashcards = new Map<string, any>();
  const questions = new Map<string, any>();
  const reviews: any[] = [];
  let flashcardSequence = 1;
  let questionSequence = 1;

  return {
    flashcards,
    questions,
    reviews,
    prisma: {
      $transaction: async <T>(fn: (tx: any) => Promise<T>) =>
        fn({
          flashcard: {
            findMany: async ({ where }: any) =>
              Array.from(flashcards.values())
                .filter((item) => item.materialId === where.materialId)
                .map((item) => ({ id: item.id })),
            deleteMany: async ({ where }: any) => {
              const toDelete = Array.from(flashcards.values()).filter(
                (item) => item.materialId === where.materialId
              );
              for (const item of toDelete) flashcards.delete(item.id);
              return { count: toDelete.length };
            },
            createMany: async ({ data }: any) => {
              for (const item of data) {
                const id = `flashcard-${flashcardSequence++}`;
                flashcards.set(id, { id, ...item });
              }
              return { count: data.length };
            },
          },
          question: {
            findMany: async ({ where }: any) =>
              Array.from(questions.values())
                .filter((item) => item.materialId === where.materialId)
                .map((item) => ({ id: item.id })),
            deleteMany: async ({ where }: any) => {
              const toDelete = Array.from(questions.values()).filter(
                (item) => item.materialId === where.materialId
              );
              for (const item of toDelete) questions.delete(item.id);
              return { count: toDelete.length };
            },
            createMany: async ({ data }: any) => {
              for (const item of data) {
                const id = `question-${questionSequence++}`;
                questions.set(id, { id, ...item });
              }
              return { count: data.length };
            },
          },
          cardReview: {
            deleteMany: async ({ where }: any) => {
              const before = reviews.length;
              const filtered = reviews.filter(
                (review) =>
                  !where.cardId.in.includes(review.cardId) ||
                  review.resourceType !== where.resourceType
              );
              reviews.splice(0, reviews.length, ...filtered);
              return { count: before - reviews.length };
            },
          },
        }),
    },
  };
}

function fakeGatewayPreparePrisma() {
  const materials = new Map<string, any>();
  const workspaces = new Map<string, any>();

  return {
    materials,
    workspaces,
    prisma: {
      material: {
        findUnique: async ({ where }: any) => materials.get(where.id) ?? null,
      },
      workspace: {
        findFirst: async ({ where }: any) => {
          const workspace = workspaces.get(where.id);
          return workspace && workspace.userId === where.userId ? workspace : null;
        },
      },
    },
  };
}

test("SM-2 schedules first successful review for one day", () => {
  const result = calculateSM2({
    currentEF: 2.5,
    currentInterval: 0,
    currentRepetitions: 0,
    grade: 4,
  });

  assert.equal(result.intervalDays, 1);
  assert.equal(result.easeFactor, 2.5);
  assert.equal(result.repetitions, 1);
});

test("shared review grading updates card state and awards XP", async () => {
  const repository = new FakeReviewRepository({
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
    prisma: fakePrismaForReview(),
    repository,
    xpPort: new FakeXpPort(),
    userId: "user-1",
    cardId: "review-1",
    grade: 4,
    requestId: "request-1",
    xpSource: "review",
  });

  assert.equal(result.intervalDays, 1);
  assert.equal(result.easeFactor, 2.5);
  assert.equal(result.xpEarned, 7);
  assert.equal(repository.record?.repetitions, 1);
  assert.equal(repository.record?.streak, 1);
});

test("workspace note sync maps temp IDs to server IDs", async () => {
  const { prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-1",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          content: "Draft note",
          metadata: { color: "blue" },
        },
      ],
    },
  });

  assert.deepEqual(result.applied, ["temp-note-1"]);
  assert.equal(result.idMap["temp-note-1"], "server-note-1");
  assert.deepEqual(result.conflicts, []);
});

test("workspace note sync treats missing deletes as applied", async () => {
  const { prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "note-missing",
          operation: "delete",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
        },
      ],
    },
  });

  assert.deepEqual(result.applied, ["note-missing"]);
  assert.deepEqual(result.conflicts, []);
});

test("workspace note sync reports server-newer conflicts", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    content: "Server note",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  });

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "note-1",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          content: "Client stale note",
        },
      ],
    },
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, [{ id: "note-1" }]);
});

test("board item sync maps temp IDs to server IDs", async () => {
  const { prisma } = fakeBoardPrisma();

  const result = await syncBoardItems({
    prisma,
    userId: "user-1",
    request: [
      {
        id: "temp-board-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        columnId: null,
        content: "Offline task",
        tags: [],
        order: 0,
        attachments: [],
        operation: "upsert",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(result.applied, ["temp-board-1"]);
  assert.equal(result.idMap["temp-board-1"], "server-board-1");
  assert.equal(result.results[0]?.status, "created");
  assert.deepEqual(result.conflicts, []);
});

test("board item sync reports server-newer conflicts", async () => {
  const { boardItems, prisma } = fakeBoardPrisma();
  boardItems.set("board-1", {
    id: "board-1",
    userId: "user-1",
    workspaceId: "workspace-1",
    columnId: null,
    content: "Server task",
    tags: [],
    order: 0,
    attachments: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  });

  const result = await syncBoardItems({
    prisma,
    userId: "user-1",
    request: [
      {
        id: "board-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        columnId: null,
        content: "Client stale task",
        tags: [],
        order: 0,
        attachments: [],
        operation: "upsert",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, [{ id: "board-1" }]);
  assert.equal(result.results[0]?.status, "conflict");
});

test("board item sync treats missing deletes as applied", async () => {
  const { prisma } = fakeBoardPrisma();

  const result = await syncBoardItems({
    prisma,
    userId: "user-1",
    request: [
      {
        id: "board-missing",
        userId: "user-1",
        workspaceId: "workspace-1",
        columnId: null,
        content: "",
        tags: [],
        order: 0,
        attachments: [],
        operation: "delete",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(result.applied, ["board-missing"]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.results[0]?.status, "deleted");
});

test("mergePendingBoardItems preserves pending column and order", () => {
  const merged = mergePendingBoardItems(
    [
      {
        id: "board-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        columnId: "column-a",
        content: "Server task",
        tags: ["server"],
        order: 0,
        dueDate: null,
        attachments: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } satisfies BoardItemState,
    ],
    [
      {
        id: "board-1",
        operation: "upsert",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 2,
        workspaceId: "workspace-1",
        columnId: "column-b",
        order: 7,
        content: "Offline task",
        tags: ["offline"],
      },
    ],
  );

  const item = merged.get("board-1");
  assert.ok(item);
  assert.equal(item.columnId, "column-b");
  assert.equal(item.order, 7);
  assert.equal(item.content, "Offline task");
  assert.deepEqual(item.tags, ["offline"]);
  assert.equal(item.isDirty, true);
});

test("mergePendingBoardItems ignores stale pending updates", () => {
  const merged = mergePendingBoardItems(
    [
      {
        id: "board-1",
        userId: "user-1",
        workspaceId: "workspace-1",
        columnId: "column-a",
        content: "Newer local task",
        tags: ["local"],
        order: 2,
        dueDate: null,
        attachments: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      } satisfies BoardItemState,
    ],
    [
      {
        id: "board-1",
        operation: "upsert",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        workspaceId: "workspace-1",
        columnId: "column-b",
        order: 7,
        content: "Stale pending task",
        tags: ["stale"],
      },
    ],
  );

  const item = merged.get("board-1");
  assert.ok(item);
  assert.equal(item.columnId, "column-a");
  assert.equal(item.order, 2);
  assert.equal(item.content, "Newer local task");
  assert.deepEqual(item.tags, ["local"]);
});

test("generation quota spends a credit after free quota is exhausted", async () => {
  const { subscriptions, creditTransactions, prisma } = fakeSubscriptionPrisma();
  subscriptions.set("user-1", {
    userId: "user-1",
    tier: "FREE",
    generationsUsed: 10,
    generationsQuota: 10,
    creditBalance: 2,
  });

  const result = await consumeGenerationQuota({
    prisma,
    userId: "user-1",
  });

  assert.equal(result.creditSpent, true);
  assert.equal(result.generationsUsed, 10);
  assert.equal(result.creditBalance, 1);
  assert.equal(creditTransactions.length, 1);
});

test("reward ad credit stays idempotent for duplicate session tokens", async () => {
  const { subscriptions, creditTransactions, prisma } = fakeSubscriptionPrisma();
  subscriptions.set("user-1", {
    userId: "user-1",
    tier: "FREE",
    generationsUsed: 0,
    generationsQuota: 10,
    creditBalance: 0,
    lifetimeCredits: 0,
  });

  const first = await rewardAdCredit({
    prisma,
    userId: "user-1",
    sessionToken: "ad-session-1",
  });
  const second = await rewardAdCredit({
    prisma,
    userId: "user-1",
    sessionToken: "ad-session-1",
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(subscriptions.get("user-1")?.creditBalance, 1);
  assert.equal(creditTransactions.length, 1);
});

test("stripe purchase credit grants stay idempotent per payment intent", async () => {
  const { subscriptions, creditTransactions, prisma } = fakeSubscriptionPrisma();

  const first = await grantStripePurchaseCredits({
    prisma,
    userId: "user-1",
    packId: "pack_50",
    stripePaymentIntentId: "pi_1",
  });
  const second = await grantStripePurchaseCredits({
    prisma,
    userId: "user-1",
    packId: "pack_50",
    stripePaymentIntentId: "pi_1",
  });

  assert.equal(first.duplicate, false);
  assert.equal(first.creditsGranted, 50);
  assert.equal(second.duplicate, true);
  assert.equal(second.creditsGranted, 0);
  assert.equal(subscriptions.get("user-1")?.creditBalance, 50);
  assert.equal(creditTransactions.length, 1);
});

test("stripe checkout intent uses pack pricing from subscription module", async () => {
  const createdIntents: any[] = [];

  const result = await createStripeCreditCheckout({
    stripeSecretKey: "sk_test_123",
    userId: "user-1",
    packId: "pack_120",
    stripe: {
      paymentIntents: {
        create: async (payload: any) => {
          createdIntents.push(payload);
          return { client_secret: "pi_secret_123" } as any;
        },
      },
    } as any,
  });

  assert.equal(result.clientSecret, "pi_secret_123");
  assert.equal(result.packId, "pack_120");
  assert.equal(createdIntents[0]?.amount, 1061);
  assert.equal(createdIntents[0]?.metadata?.userId, "user-1");
  assert.equal(createdIntents[0]?.metadata?.packId, "pack_120");
});

test("generated flashcards save through shared ai-generation service", async () => {
  const { flashcards, reviews, prisma } = fakeGenerationSavePrisma();
  flashcards.set("flashcard-old-1", {
    id: "flashcard-old-1",
    materialId: "material-1",
  });
  reviews.push({
    cardId: "flashcard-old-1",
    resourceType: "flashcard",
  });

  const result = await saveGeneratedArtifacts({
    prisma,
    task: "flashcards",
    workspaceId: "workspace-1",
    materialId: "material-1",
    replace: true,
    loadedMaterialType: "txt",
    result: [
      {
        front: "Q1",
        back: "A1",
        sourceMetadata: { anchor: "block-1" },
      },
      {
        front: "Q2",
        back: "A2",
      },
    ],
  });

  assert.equal(result.savedCount, 2);
  assert.equal(result.deletedCount, 1);
  assert.equal(result.deletedReviewsCount, 1);
  assert.equal(flashcards.size, 2);
});

test("gateway generation prep injects PDF markers and derives save workspace", async () => {
  const { materials, prisma } = fakeGatewayPreparePrisma();
  materials.set("material-1", {
    id: "material-1",
    content: "First page\nSecond page",
    type: "pdf",
    metadata: { pageCount: 2 },
    workspace: {
      id: "workspace-1",
      userId: "user-1",
    },
  });

  const result = await prepareGatewayGeneration({
    prisma,
    userId: "user-1",
    request: {
      task: "flashcards",
      materialId: "material-1",
      save: true,
    },
  });

  assert.equal(result.canSave, true);
  assert.equal(result.saveWorkspaceId, "workspace-1");
  assert.equal(result.loadedMaterialType, "pdf");
  assert.match(result.text, /\[\[PAGE:1\]\]/);
});

test("gateway generation prep rejects oversized text", async () => {
  const { prisma } = fakeGatewayPreparePrisma();

  await assert.rejects(
    () =>
      prepareGatewayGeneration({
        prisma,
        userId: "user-1",
        request: {
          task: "quiz",
          text: "x".repeat(100_001),
        },
      }),
    (error: any) => error?.message === "Text too large",
  );
});

test("gateway generation prep enforces workspace ownership before save", async () => {
  const { workspaces, prisma } = fakeGatewayPreparePrisma();
  workspaces.set("workspace-1", {
    id: "workspace-1",
    userId: "someone-else",
  });

  await assert.rejects(
    () =>
      prepareGatewayGeneration({
        prisma,
        userId: "user-1",
        request: {
          task: "flashcards",
          text: "Valid enough text",
          save: true,
          workspaceId: "workspace-1",
        },
      }),
    (error: any) =>
      error?.message === "You do not have access to this workspace.",
  );
});

let failed = 0;

for (const testCase of tests) {
  try {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} unit test(s) failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} unit test(s) passed.`);
