import assert from "node:assert/strict";
import { ref } from "vue";
import { calculateSM2 } from "../server/modules/review/domain/sm2";
import { gradeReviewCard } from "../server/modules/review/application/gradeReviewCard";
import { syncBoardItems } from "../server/modules/board/application/syncBoardItems";
import { applyWorkspaceNoteLayout } from "../server/modules/notes/application/applyWorkspaceNoteLayout";
import { syncWorkspaceNotes } from "../server/modules/notes/application/syncWorkspaceNotes";
import { consumeGenerationQuota } from "../server/modules/subscription/application/generationQuota";
import { createStripeCreditCheckout } from "../server/modules/subscription/application/createStripeCreditCheckout";
import { rewardAdCredit } from "../server/modules/subscription/application/rewardAdCredit";
import { grantStripePurchaseCredits } from "../server/modules/subscription/application/grantStripePurchaseCredits";
import { saveGeneratedArtifacts } from "../server/modules/ai-generation/application/saveGeneratedArtifacts";
import { prepareGatewayGeneration } from "../server/modules/ai-generation/application/prepareGatewayGeneration";
import { completeGatewayCacheHit } from "../server/modules/ai-generation/application/completeGatewayGeneration";
import { quotaHeaders } from "../server/modules/subscription/infrastructure/http/quotaHttp";
import { mergePendingBoardItems } from "../app/features/board/composables/mergePendingBoardItems";
import { BoardItemsSyncRequestSchema } from "../shared/utils/boardItem.contract";
import {
  CreateNoteDTO,
  ReorderNotesDTO,
  UpdateNoteDTO,
} from "../shared/utils/note.contract";
import {
  CreateNoteGroupDTO,
  ReorderNoteGroupsDTO,
  UpdateNoteGroupDTO,
} from "../shared/utils/note-group.contract";
import {
  NoteLayoutChangeSchema,
  NotesSyncRequestSchema,
  PendingNoteChangeSchema,
} from "../shared/utils/note-sync.contract";
import {
  buildCanonicalNoteLayout,
  type NotesLayoutCommand,
  type NotesLayoutStatus,
} from "../app/features/notes/composables/notesLayoutController";
import {
  DEFAULT_WORKSPACE_NOTE_HTML,
  TITLE_FALLBACK,
  extractWorkspaceNoteTitle,
  normalizeWorkspaceNoteContent,
  normalizeWorkspaceNoteTitle,
} from "../shared/utils/workspaceNote";
import {
  buildWorkspaceTextDraftCommit,
  resolveEditorSaveState,
  saveStateLabel,
} from "../app/features/notes/composables/notesDraftCommitter";
import { createNotesSplitInteractionController } from "../app/features/notes/composables/notesSplitInteractionController";
import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "../server/modules/review/ports/ReviewRepository";
import type { XpPort } from "../server/modules/review/ports/XpPort";
import type { BoardItemState } from "../app/features/board/composables/useBoardItemsStore";
import type { ActivePane, SplitPosition } from "../app/composables/ui/useSplitNotes";

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

class FakeReviewRepository implements ReviewRepository {
  constructor(public record: ReviewCardRecord | null) { }

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
	  const noteGroups = new Map<string, any>([
	    ["group-1", { id: "group-1", workspaceId: "workspace-1", title: "Group 1", order: 0 }],
	  ]);
	  let noteSequence = 1;
	  let noteGroupSequence = 1;

  return {
    notes,
    noteGroups,
    prisma: {
      workspace: {
        findFirst: async ({ where }: any) =>
          where.id === "workspace-1" && where.userId === "user-1"
            ? { id: "workspace-1", userId: "user-1" }
            : null,
      },
      noteGroup: {
        findFirst: async ({ where }: any) => {
          const group = noteGroups.get(where.id);
          if (!group) return null;
          if (where.workspaceId && group.workspaceId !== where.workspaceId) return null;
          return group;
        },
        findMany: async ({ where }: any) =>
          Array.from(noteGroups.values()).filter((group) => {
            if (where?.workspaceId && group.workspaceId !== where.workspaceId) return false;
            if (where?.id?.in && !where.id.in.includes(group.id)) return false;
            return true;
          }),
	        update: async ({ where, data }: any) => {
	          const existing = noteGroups.get(where.id);
	          assert.ok(existing, "expected existing note group");
	          const row = { ...existing, ...data };
	          noteGroups.set(where.id, row);
	          return row;
	        },
	        create: async ({ data }: any) => {
	          const id = data.id ?? `server-group-${noteGroupSequence++}`;
	          const row = {
	            id,
	            workspaceId: data.workspaceId,
	            title: data.title,
	            order: data.order ?? 0,
	          };
	          noteGroups.set(id, row);
	          return row;
	        },
	        delete: async ({ where }: any) => {
	          const existing = noteGroups.get(where.id);
	          noteGroups.delete(where.id);
	          return existing;
	        },
	      },
      note: {
        findFirst: async ({ where }: any) => notes.get(where.id) ?? null,
        findMany: async ({ where }: any) =>
          Array.from(notes.values()).filter((note) => {
            if (where?.workspaceId && note.workspaceId !== where.workspaceId) return false;
            if (where?.id?.in && !where.id.in.includes(note.id)) return false;
            return true;
          }),
        create: async ({ data }: any) => {
          const id = data.id ?? `server-note-${noteSequence++}`;
          const row = {
            id,
            workspaceId: data.workspaceId,
            groupId: data.groupId ?? null,
            title: data.title,
            content: data.content,
            tags: data.tags,
            order: data.order ?? 0,
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
      $transaction: async <T>(fn: (tx: any) => Promise<T>) =>
        fn({
	          note: {
	            updateMany: async ({ where, data }: any) => {
	              for (const [id, existing] of notes) {
	                if (where.workspaceId && existing.workspaceId !== where.workspaceId) continue;
	                if (where.groupId !== undefined && existing.groupId !== where.groupId) continue;
	                notes.set(id, { ...existing, ...data, updatedAt: new Date() });
	              }
	              return { count: notes.size };
	            },
	            update: async ({ where, data }: any) => {
	              const existing = notes.get(where.id);
	              assert.ok(existing, "expected existing note");
	              const row = { ...existing, ...data, updatedAt: new Date() };
	              notes.set(where.id, row);
              return row;
            },
          },
          noteGroup: {
	            update: async ({ where, data }: any) => {
	              const existing = noteGroups.get(where.id);
	              assert.ok(existing, "expected existing note group");
	              const row = { ...existing, ...data };
	              noteGroups.set(where.id, row);
	              return row;
	            },
	            delete: async ({ where }: any) => {
	              const existing = noteGroups.get(where.id);
	              noteGroups.delete(where.id);
	              return existing;
	            },
	          },
	        }),
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

function fakeSplitNotesState(input: {
  isSplit?: boolean;
  primaryNoteId?: string | null;
  secondaryNoteId?: string | null;
  secondaryPosition?: SplitPosition;
  activePane?: ActivePane;
} = {}) {
  const isSplit = ref(input.isSplit ?? false);
  const primaryNoteId = ref<string | null>(input.primaryNoteId ?? null);
  const secondaryNoteId = ref<string | null>(input.secondaryNoteId ?? null);
  const secondaryPosition = ref<SplitPosition>(input.secondaryPosition ?? "right");
  const activePane = ref<ActivePane>(input.activePane ?? "primary");

  return {
    isSplit,
    primaryNoteId,
    secondaryNoteId,
    secondaryPosition,
    activePane,
    setPrimaryNote: (noteId: string | null) => {
      primaryNoteId.value = noteId;
    },
    setSecondaryNote: (noteId: string) => {
      if (!isSplit.value) return;
      secondaryNoteId.value = noteId;
    },
    openSplit: (noteId: string, position: SplitPosition = "right") => {
      if (!primaryNoteId.value || primaryNoteId.value === noteId) return;
      secondaryNoteId.value = noteId;
      secondaryPosition.value = position;
      isSplit.value = true;
      activePane.value = "primary";
    },
    setActivePane: (pane: ActivePane) => {
      activePane.value = pane;
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
  const { notes, prisma } = fakeNotesPrisma();

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
          title: "Draft title",
          content: "Draft note",
          metadata: { color: "blue" },
        },
      ],
    },
  });

  assert.deepEqual(result.applied, ["temp-note-1"]);
  assert.equal(result.idMap["temp-note-1"], "server-note-1");
  assert.equal(notes.get("server-note-1")?.title, "Draft title");
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

test("workspace note normalization uses the default empty template", () => {
  assert.equal(normalizeWorkspaceNoteContent(""), DEFAULT_WORKSPACE_NOTE_HTML);
  assert.equal(normalizeWorkspaceNoteContent(undefined), DEFAULT_WORKSPACE_NOTE_HTML);
});

test("workspace note normalization prepends an empty title heading for legacy content", () => {
  assert.equal(
    normalizeWorkspaceNoteContent("<p>Legacy body</p>"),
    "<h1></h1><p>Legacy body</p>",
  );
});

test("workspace note normalization keeps the first heading and upgrades it to h1", () => {
  assert.equal(
    normalizeWorkspaceNoteContent("<h3>Legacy title</h3><p>Body</p>"),
    "<h1>Legacy title</h1><p>Body</p>",
  );
});

test("workspace note title extraction falls back when the first heading is empty", () => {
  assert.equal(extractWorkspaceNoteTitle("<h1></h1><p>Body</p>"), TITLE_FALLBACK);
  assert.equal(extractWorkspaceNoteTitle("<p>Body only</p>"), TITLE_FALLBACK);
});

test("workspace note title extraction reads and decodes the first heading text", () => {
  assert.equal(
    extractWorkspaceNoteTitle("<h2>Alpha &amp; Beta</h2><p>Body</p>"),
    "Alpha & Beta",
  );
});

test("workspace note title normalization prefers explicit titles and otherwise derives from content", () => {
  assert.equal(
    normalizeWorkspaceNoteTitle("  Explicit Title  ", "<h1>Ignored</h1><p>Body</p>"),
    "Explicit Title",
  );
  assert.equal(
    normalizeWorkspaceNoteTitle(undefined, "<h1>Derived Title</h1><p>Body</p>"),
    "Derived Title",
  );
  assert.equal(normalizeWorkspaceNoteTitle("", "<p>No heading</p>"), TITLE_FALLBACK);
});

test("note contracts accept legacy records without title", () => {
  const created = CreateNoteDTO.parse({
    workspaceId: "workspace-1",
    content: DEFAULT_WORKSPACE_NOTE_HTML,
  });
  const updated = UpdateNoteDTO.parse({
    content: "<h1>Updated</h1><p>Body</p>",
  });
  const pending = PendingNoteChangeSchema.parse({
    id: "temp-note-2",
    operation: "upsert",
    updatedAt: Date.now(),
    localVersion: 1,
    workspaceId: "workspace-1",
    content: DEFAULT_WORKSPACE_NOTE_HTML,
  });

  assert.equal(created.title, undefined);
  assert.equal(updated.title, undefined);
  assert.equal(pending.title, undefined);
});

test("note contracts accept group IDs while preserving legacy reorder payloads", () => {
  const created = CreateNoteDTO.parse({
    workspaceId: "workspace-1",
    groupId: "group-1",
    content: DEFAULT_WORKSPACE_NOTE_HTML,
  });
  const updated = UpdateNoteDTO.parse({
    groupId: null,
    content: "<h1>Updated</h1><p>Body</p>",
  });
  const legacyReorder = ReorderNotesDTO.parse({
    workspaceId: "workspace-1",
    noteOrders: [{ id: "note-1", order: 0 }],
  });
  const groupedReorder = ReorderNotesDTO.parse({
    workspaceId: "workspace-1",
    noteOrders: [{ id: "note-1", groupId: "group-1", order: 0 }],
  });

  assert.equal(created.groupId, "group-1");
  assert.equal(updated.groupId, null);
  assert.equal(legacyReorder.noteOrders[0]?.groupId, undefined);
  assert.equal(groupedReorder.noteOrders[0]?.groupId, "group-1");
});

test("note group contracts accept create, rename, and reorder payloads", () => {
  const created = CreateNoteGroupDTO.parse({
    workspaceId: "workspace-1",
    title: "  Research  ",
  });
  const updated = UpdateNoteGroupDTO.parse({ title: "  Inbox  " });
  const reordered = ReorderNoteGroupsDTO.parse({
    workspaceId: "workspace-1",
    groupOrders: [
      { id: "group-2", order: 0 },
      { id: "group-1", order: 1 },
    ],
  });

  assert.equal(created.title, "Research");
  assert.equal(updated.title, "Inbox");
  assert.deepEqual(reordered.groupOrders.map((group) => group.id), ["group-2", "group-1"]);
});

test("workspace text draft commit normalizes content and extracts title on commit", () => {
  const commit = buildWorkspaceTextDraftCommit("<h2>Draft Title</h2><p>Body</p>");

  assert.equal(commit.title, "Draft Title");
  assert.equal(commit.content, "<h1>Draft Title</h1><p>Body</p>");
});

test("workspace text draft commit preserves legacy body with fallback title", () => {
  const commit = buildWorkspaceTextDraftCommit("<p>Legacy body</p>");

  assert.equal(commit.title, TITLE_FALLBACK);
  assert.equal(commit.content, "<h1></h1><p>Legacy body</p>");
});

test("notes editor save state favors conflicts, drafts, local saves, and synced labels", () => {
  assert.equal(
    resolveEditorSaveState({ hasLocalDraft: true, error: "Server rejected update" }),
    "conflict",
  );
  assert.equal(resolveEditorSaveState({ hasLocalDraft: true, isLoading: true }), "editing");
  assert.equal(resolveEditorSaveState({ hasLocalDraft: true }), "editing");
  assert.equal(resolveEditorSaveState({ hasLocalDraft: false, isDirty: true }), "saved-local");
  assert.equal(resolveEditorSaveState({ hasLocalDraft: false, isLoading: true }), "syncing");
  assert.equal(saveStateLabel(resolveEditorSaveState({ hasLocalDraft: false })), "Synced");
});

test("workspace note sync derives fallback title when payload omits it", async () => {
  const { notes, prisma } = fakeNotesPrisma();

  await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-3",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          content: "<h1>Derived title</h1><p>Body</p>",
        },
      ],
    },
  });

  assert.equal(notes.get("server-note-1")?.title, "Derived title");
});

test("workspace note sync preserves group IDs on create and update", async () => {
  const { notes, prisma } = fakeNotesPrisma();

  await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-4",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          groupId: "group-1",
          content: "<h1>Grouped note</h1><p>Body</p>",
        },
      ],
    },
  });

  assert.equal(notes.get("server-note-1")?.groupId, "group-1");

  await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "server-note-1",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 2,
          workspaceId: "workspace-1",
          groupId: null,
          content: "<h1>Ungrouped again</h1><p>Body</p>",
        },
      ],
    },
  });

  assert.equal(notes.get("server-note-1")?.groupId, null);
});

test("note layout contracts accept layout-only sync requests", () => {
  const layout = NoteLayoutChangeSchema.parse({
    workspaceId: "workspace-1",
    updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
    notes: [
      { id: "note-1", groupId: "group-1", order: 0 },
      { id: "note-2", groupId: null, order: 0 },
    ],
    groups: [{ id: "group-1", order: 0 }],
  });
  const request = NotesSyncRequestSchema.parse({ layoutChange: layout });

  assert.equal(layout.id, "workspace-1");
  assert.deepEqual(request.changes, []);
  assert.equal(request.layoutChange?.notes[0]?.groupId, "group-1");
});

test("workspace note layout applies note moves and group order without touching content", async () => {
  const { notes, noteGroups, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "One",
    content: "<h1>One</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  notes.set("note-2", {
    id: "note-2",
    workspaceId: "workspace-1",
    groupId: "group-1",
    title: "Two",
    content: "<h1>Two</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const beforeContent = notes.get("note-1")?.content;
  const result = await applyWorkspaceNoteLayout({
    prisma,
    userId: "user-1",
    layout: {
      id: "workspace-1",
      workspaceId: "workspace-1",
      updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
      localVersion: 2,
      notes: [
        { id: "note-2", groupId: null, order: 0 },
        { id: "note-1", groupId: "group-1", order: 0 },
      ],
      groups: [{ id: "group-1", order: 3 }],
    },
  });

  assert.equal(result.layoutApplied, true);
  assert.equal(notes.get("note-1")?.groupId, "group-1");
  assert.equal(notes.get("note-1")?.order, 0);
  assert.equal(notes.get("note-1")?.content, beforeContent);
  assert.equal(notes.get("note-2")?.groupId, null);
  assert.equal(noteGroups.get("group-1")?.order, 3);
});

test("workspace note layout rejects foreign note groups", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "One",
    content: "<h1>One</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  await assert.rejects(
    () =>
      applyWorkspaceNoteLayout({
        prisma,
        userId: "user-1",
        layout: {
          id: "workspace-1",
          workspaceId: "workspace-1",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 1,
          notes: [{ id: "note-1", groupId: "foreign-group", order: 0 }],
          groups: [],
        },
      }),
    /Some note groups do not belong/,
  );
});

test("workspace note sync applies layout changes after content changes", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "One",
    content: "<h1>One</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [],
      layoutChange: {
        id: "workspace-1",
        workspaceId: "workspace-1",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 2,
        notes: [{ id: "note-1", groupId: "group-1", order: 0 }],
        groups: [{ id: "group-1", order: 0 }],
      },
    },
  });

  assert.equal(result.layoutApplied, true);
  assert.equal(result.layoutConflict, false);
  assert.equal(notes.get("note-1")?.groupId, "group-1");
  assert.deepEqual(result.applied, []);
});

test("workspace note sync remaps temp IDs before applying layout", async () => {
  const { notes, prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-with-layout",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          content: "<h1>Temp layout</h1><p>Body</p>",
        },
      ],
      layoutChange: {
        id: "workspace-1",
        workspaceId: "workspace-1",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 2,
        notes: [{ id: "temp-note-with-layout", groupId: "group-1", order: 0 }],
        groups: [{ id: "group-1", order: 0 }],
      },
    },
  });

  assert.equal(result.idMap["temp-note-with-layout"], "server-note-1");
  assert.equal(result.layoutApplied, true);
  assert.equal(result.layoutConflict, false);
  assert.equal(notes.get("server-note-1")?.groupId, "group-1");
});

test("workspace note sync maps temp group IDs before content and layout", async () => {
  const { notes, noteGroups, prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-in-temp-group",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          groupId: "temp-group-1",
          content: "<h1>Grouped note</h1><p>Body</p>",
        },
      ],
      groupChanges: [
        {
          id: "temp-group-1",
          operation: "create",
          workspaceId: "workspace-1",
          title: "Client group",
          order: 1,
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
        },
      ],
      layoutChange: {
        id: "workspace-1",
        workspaceId: "workspace-1",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 2,
        notes: [{ id: "temp-note-in-temp-group", groupId: "temp-group-1", order: 0 }],
        groups: [
          { id: "group-1", order: 0 },
          { id: "temp-group-1", order: 1 },
        ],
      },
    },
  });

  const serverGroupId = result.groupIdMap["temp-group-1"];
  assert.ok(serverGroupId);
  assert.equal(noteGroups.get(serverGroupId)?.title, "Client group");
  assert.equal(notes.get("server-note-1")?.groupId, serverGroupId);
  assert.equal(result.layoutApplied, true);
});

test("workspace note sync deletes groups by moving notes to ungrouped first", async () => {
  const { notes, noteGroups, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: "group-1",
    title: "Grouped",
    content: "<h1>Grouped</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [],
      groupChanges: [
        {
          id: "group-1",
          operation: "delete",
          workspaceId: "workspace-1",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 1,
        },
      ],
    },
  });

  assert.deepEqual(result.groupApplied, ["group-1"]);
  assert.equal(noteGroups.has("group-1"), false);
  assert.equal(notes.get("note-1")?.groupId, null);
});

test("notes layout controller types support semantic layout commands and statuses", () => {
  const command: NotesLayoutCommand = {
    type: "MOVE_NOTE",
    noteId: "note-1",
    toGroupId: null,
    toIndex: 0,
  };
  const status: NotesLayoutStatus = "queued";

  assert.equal(command.type, "MOVE_NOTE");
  assert.equal(status, "queued");
});

test("notes layout canonicalization creates contiguous per-group orders", () => {
  const layout = buildCanonicalNoteLayout([
    { id: "note-3", groupId: "group-1", order: 9 },
    { id: "note-1", groupId: null, order: 2 },
    { id: "note-2", groupId: "group-1", order: 0 },
  ] as any);

  assert.deepEqual(layout, [
    { id: "note-2", groupId: "group-1", order: 0 },
    { id: "note-3", groupId: "group-1", order: 1 },
    { id: "note-1", groupId: null, order: 0 },
  ]);
});

test("notes split click opens split from the current note without touching layout", () => {
  const splitNotes = fakeSplitNotesState({ primaryNoteId: null });
  let currentNoteId = "note-1";
  const controller = createNotesSplitInteractionController({
    splitNotes: splitNotes as any,
    getCurrentNoteId: () => currentNoteId,
    setCurrentNoteId: (noteId) => {
      currentNoteId = noteId;
    },
  });

  controller.execute({ type: "CLICK_SPLIT", noteId: "note-2" });

  assert.equal(splitNotes.isSplit.value, true);
  assert.equal(splitNotes.primaryNoteId.value, "note-1");
  assert.equal(splitNotes.secondaryNoteId.value, "note-2");
  assert.equal(splitNotes.secondaryPosition.value, "right");
  assert.equal(splitNotes.activePane.value, "secondary");
  assert.equal(currentNoteId, "note-2");
});

test("notes split click replaces the active pane without duplicating the other pane", () => {
  const splitNotes = fakeSplitNotesState({
    isSplit: true,
    primaryNoteId: "note-1",
    secondaryNoteId: "note-2",
    secondaryPosition: "right",
    activePane: "secondary",
  });
  let currentNoteId = "note-2";
  const controller = createNotesSplitInteractionController({
    splitNotes: splitNotes as any,
    getCurrentNoteId: () => currentNoteId,
    setCurrentNoteId: (noteId) => {
      currentNoteId = noteId;
    },
  });

  controller.execute({ type: "CLICK_SPLIT", noteId: "note-3" });

  assert.equal(splitNotes.primaryNoteId.value, "note-1");
  assert.equal(splitNotes.secondaryNoteId.value, "note-3");
  assert.equal(splitNotes.activePane.value, "secondary");
  assert.equal(currentNoteId, "note-3");

  controller.execute({ type: "CLICK_SPLIT", noteId: "note-1" });

  assert.equal(splitNotes.primaryNoteId.value, "note-1");
  assert.equal(splitNotes.secondaryNoteId.value, "note-3");
  assert.equal(currentNoteId, "note-3");
});

test("notes split drop targets the visual side independently from note selection", () => {
  const splitNotes = fakeSplitNotesState({
    isSplit: true,
    primaryNoteId: "note-1",
    secondaryNoteId: "note-2",
    secondaryPosition: "right",
    activePane: "secondary",
  });
  let currentNoteId = "note-2";
  const controller = createNotesSplitInteractionController({
    splitNotes: splitNotes as any,
    getCurrentNoteId: () => currentNoteId,
    setCurrentNoteId: (noteId) => {
      currentNoteId = noteId;
    },
  });

  controller.startSplitDrag("note-3");
  controller.setHoveredZone("left");
  controller.execute({ type: "DROP_SPLIT", noteId: "note-3", position: "left" });

  assert.equal(splitNotes.primaryNoteId.value, "note-3");
  assert.equal(splitNotes.secondaryNoteId.value, "note-2");
  assert.equal(splitNotes.activePane.value, "primary");
  assert.equal(controller.isSplitDragging.value, true);
  assert.equal(controller.hoveredSplitZone.value, "left");
  assert.equal(currentNoteId, "note-3");

  controller.endSplitDrag();

  assert.equal(controller.isSplitDragging.value, false);
  assert.equal(controller.hoveredSplitZone.value, null);
  assert.equal(controller.draggedSplitNoteId.value, null);
});

test("workspace note sync reports layout conflicts separately from content changes", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "One",
    content: "<h1>One</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    order: 0,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [],
      layoutChange: {
        id: "workspace-1",
        workspaceId: "workspace-1",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 2,
        notes: [{ id: "note-1", groupId: "missing-group", order: 0 }],
        groups: [],
      },
    },
  });

  assert.equal(result.layoutApplied, false);
  assert.equal(result.layoutConflict, true);
  assert.equal(notes.get("note-1")?.groupId, null);
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

test("board item sync contract accepts minimal delete records", () => {
  const parsed = BoardItemsSyncRequestSchema.parse([
    {
      id: "board-missing",
      operation: "delete",
      updatedAt: Date.now(),
      localVersion: 1,
    },
  ]);

  assert.equal(parsed[0]?.operation, "delete");
  assert.equal(parsed[0]?.id, "board-missing");
});

test("board item sync contract accepts numeric offline upserts", () => {
  const now = Date.now();
  const parsed = BoardItemsSyncRequestSchema.parse([
    {
      id: "temp-board-2",
      operation: "upsert",
      workspaceId: "workspace-1",
      columnId: null,
      content: "Offline task",
      tags: [],
      order: 0,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  assert.equal(parsed[0]?.operation, "upsert");
  assert.equal(parsed[0]?.content, "Offline task");
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

test("quotaHeaders returns plain HTTP header data", () => {
  assert.deepEqual(
    quotaHeaders({
      tier: "FREE",
      generationsUsed: 4,
      generationsQuota: 10,
      remaining: 6,
      creditBalance: 1,
      creditSpent: false,
    }),
    {
      "x-subscription-tier": "FREE",
      "x-generations-used": "4",
      "x-generations-quota": "10",
      "x-generations-remaining": "6",
    },
  );
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

test("gateway cache hit consumes quota and returns cached payload metadata", async () => {
  const consumed: string[] = [];

  const result = await completeGatewayCacheHit({
    quotaPort: {
      getStatus: async () => {
        throw new Error("not used");
      },
      consumeGeneration: async (userId: string) => {
        consumed.push(userId);
        return {
          tier: "FREE",
          generationsUsed: 2,
          generationsQuota: 10,
          remaining: 8,
          creditBalance: 0,
          creditSpent: false,
        };
      },
    },
    userId: "user-1",
    requestId: "request-1",
    task: "flashcards",
    cachedValue: {
      task: "flashcards",
      modelId: "model-a",
      provider: "provider-a",
      flashcards: [{ front: "Q", back: "A" }],
    },
    itemCount: 1,
    tokenEstimate: 12,
    requestStartTime: Date.now(),
  });

  assert.deepEqual(consumed, ["user-1"]);
  assert.equal(result.response.cached, true);
  assert.equal(result.response.selectedModelId, "model-a");
  assert.equal(result.response.provider, "provider-a");
  assert.equal(result.response.task, "flashcards");
  assert.equal(result.response.flashcards.length, 1);
  assert.equal(result.updatedQuota.remaining, 8);
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
