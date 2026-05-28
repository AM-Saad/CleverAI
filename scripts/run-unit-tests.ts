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
  createNotesLayoutController,
  type NotesLayoutCommand,
  type NotesLayoutStatus,
} from "../app/features/notes/composables/notesLayoutController";
import { createNotesSyncCoordinator } from "../app/features/notes/composables/notesSyncCoordinator";
import { createNotesSyncRuntime } from "../app/features/notes/composables/notesSyncRuntime";
import { createNotesConflictResolver } from "../app/features/notes/composables/notesConflictResolver";
import { createNotesCommandService } from "../app/features/notes/composables/notesCommandService";
import { createNotesContentQueue } from "../app/features/notes/composables/notesContentQueue";
import { createNotesGroupCommandService } from "../app/features/notes/composables/notesGroupCommandService";
import { createNotesMemoryStore } from "../app/features/notes/composables/notesMemoryStore";
import { createNotesSyncEngine } from "../app/features/notes/composables/notesSyncEngine";
import { createNotesTempId } from "../app/features/notes/composables/tempIds";
import { createClientTempId } from "../app/utils/local-first/tempIds";
import {
  createLocalFirstErrorPolicy,
  isLocalFirstConflict,
} from "../app/utils/local-first/errorPolicy";
import type { LocalFirstConflictRecord } from "../app/utils/local-first/types";
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
import { useSplitNotes, type ActivePane, type SplitPosition } from "../app/composables/ui/useSplitNotes";
import { normalizeShapeTransform } from "../app/utils/canvas/geometry";
import { parseLexicalEntry } from "../server/modules/language-learning/domain/lexicalEntry";
import { parseLanguageStoryResponse } from "../server/modules/language-learning/domain/storyResponse";
import { listLanguageWords } from "../server/modules/language-learning/application/listLanguageWords";
import { createLanguageLearningRuntime } from "../app/features/language-learning/composables/languageLearningRuntime";
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
            version: data.version ?? 1,
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          };
          notes.set(id, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const existing = notes.get(where.id);
          assert.ok(existing, "expected existing note");
          const row = {
            ...existing,
            ...data,
            version:
              data.version?.increment !== undefined
                ? (existing.version ?? 1) + data.version.increment
                : data.version ?? existing.version,
            updatedAt: new Date(),
          };
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
	              const row = {
	                ...existing,
	                ...data,
	                version:
	                  data.version?.increment !== undefined
	                    ? (existing.version ?? 1) + data.version.increment
	                    : data.version ?? existing.version,
	                updatedAt: new Date(),
	              };
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

function createRealSplitNotes(validIds = ["note-1", "note-2", "note-3"]) {
  return useSplitNotes(`unit-${Math.random().toString(36).slice(2)}`, () => new Set(validIds));
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeNotesLayoutRuntime(
  initialNotes: any[],
  groupLayout: Array<{ id: string; order: number }> = [
    { id: "group-1", order: 0 },
    { id: "group-2", order: 1 },
  ],
) {
  const notes = ref(new Map(initialNotes.map((note) => [note.id, { ...note }])));
  const savedNotes: any[][] = [];
  let savedLayout: any | null = null;
  let registeredBackgroundSync = 0;
  let pendingChanged = 0;
  let syncRequested = 0;

  const controller = createNotesLayoutController({
    workspaceId: "workspace-1",
    notes: notes as any,
    localRepository: {
      save: async (note: any) => {
        savedNotes.push([note]);
      },
      saveMany: async (items: any[]) => {
        savedNotes.push(items);
      },
      delete: async () => {},
      loadByWorkspace: async () => Array.from(notes.value.values()),
    } as any,
    layoutQueue: {
      load: async () => savedLayout,
      save: async (layout: any) => {
        savedLayout = layout;
      },
      remove: async () => {
        savedLayout = null;
      },
      registerBackgroundSync: async () => {
        registeredBackgroundSync++;
      },
    } as any,
    getGroupLayout: () => groupLayout,
    onLayoutPendingChanged: async () => {
      pendingChanged++;
    },
    requestSync: () => {
      syncRequested++;
    },
  });

  return {
    controller,
    notes,
    savedNotes,
    get savedLayout() {
      return savedLayout;
    },
    get registeredBackgroundSync() {
      return registeredBackgroundSync;
    },
    get pendingChanged() {
      return pendingChanged;
    },
    get syncRequested() {
      return syncRequested;
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
  assert.deepEqual(result.appliedNotes, [{
    id: "temp-note-1",
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
  }]);
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
    version: 2,
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
          serverVersion: 1,
          workspaceId: "workspace-1",
          content: "Client stale note",
        },
      ],
    },
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, [{
    id: "note-1",
    reason: "VERSION_MISMATCH",
    serverVersion: 2,
    clientServerVersion: 1,
    serverSnapshot: {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: null,
      title: undefined,
      content: "Server note",
      tags: [],
      noteType: "TEXT",
      metadata: undefined,
      version: 2,
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
  }]);
});

test("workspace note sync returns fresh versions for repeated same-client edits", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    title: "First",
    content: "<h1>First</h1><p>Body</p>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    version: 1,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const first = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "note-1",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 1,
          serverVersion: 1,
          workspaceId: "workspace-1",
          content: "<h1>Second</h1><p>Body</p>",
        },
      ],
    },
  });

  assert.deepEqual(first.applied, ["note-1"]);
  assert.equal(first.appliedNotes[0]?.version, 2);
  assert.equal(notes.get("note-1")?.version, 2);

  const second = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "note-1",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-03T00:00:00.000Z"),
          localVersion: 2,
          serverVersion: first.appliedNotes[0]?.version,
          workspaceId: "workspace-1",
          content: "<h1>Third</h1><p>Body</p>",
        },
      ],
    },
  });

  assert.deepEqual(second.conflicts, []);
  assert.deepEqual(second.applied, ["note-1"]);
  assert.equal(second.appliedNotes[0]?.version, 3);
});

test("notes sync coordinator stores fresh applied note versions locally", async () => {
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      title: "Local",
      content: "<h1>Local</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      isDirty: true,
      isLoading: true,
      error: null,
    }],
  ]));
  const saved = new Map<string, any>();
  const coordinator = createNotesSyncCoordinator({
    workspaceId: "workspace-1",
    notes,
    localRepository: {
      save: async (note: any) => {
        saved.set(note.id, note);
      },
      saveMany: async (items: any[]) => {
        for (const note of items) saved.set(note.id, note);
      },
      delete: async (id: string) => {
        saved.delete(id);
      },
      loadByWorkspace: async () => Array.from(saved.values()),
    } as any,
    layoutQueue: {
      load: async () => null,
      save: async () => {},
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    pendingQueue: {
      add: async () => {},
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
  });

  await coordinator.applySyncResult({
    applied: ["note-1"],
    appliedNotes: [{
      id: "note-1",
      version: 2,
      updatedAt: "2026-01-02T00:00:00.000Z",
    }],
    conflicts: [],
    idMap: {},
    noteIdMap: {},
    groupApplied: [],
    groupConflicts: [],
    groupIdMap: {},
    errors: [],
    layoutApplied: false,
    layoutConflict: false,
  });

  assert.equal(notes.value.get("note-1")?.version, 2);
  assert.equal(notes.value.get("note-1")?.isDirty, false);
  assert.equal(saved.get("note-1")?.version, 2);
});

test("notes sync coordinator rebases version conflicts for retry", async () => {
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      title: "Local",
      content: "<h1>Local</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      isDirty: true,
      isLoading: true,
      error: null,
    }],
  ]));
  const pending = new Map<string, any>([
    ["note-1", {
      id: "note-1",
      operation: "upsert",
      updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
      localVersion: 1,
      serverVersion: 1,
      workspaceId: "workspace-1",
      content: "<h1>Local</h1>",
    }],
  ]);
  const saved = new Map<string, any>();
  const coordinator = createNotesSyncCoordinator({
    workspaceId: "workspace-1",
    notes,
    localRepository: {
      save: async (note: any) => {
        saved.set(note.id, note);
      },
      saveMany: async (items: any[]) => {
        for (const note of items) saved.set(note.id, note);
      },
      delete: async (id: string) => {
        saved.delete(id);
      },
      loadByWorkspace: async () => Array.from(saved.values()),
    } as any,
    layoutQueue: {
      load: async () => null,
      save: async () => {},
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        pending.set(change.id, change);
      },
      load: async () => Array.from(pending.values()),
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
  });

  await coordinator.applySyncResult({
    applied: [],
    appliedNotes: [],
    conflicts: [{
      id: "note-1",
      reason: "VERSION_MISMATCH",
      resolution: "RETRY_LOCAL_WINS",
      serverVersion: 2,
      clientServerVersion: 1,
    }],
    idMap: {},
    noteIdMap: {},
    groupApplied: [],
    groupConflicts: [],
    groupIdMap: {},
    errors: [],
    layoutApplied: false,
    layoutConflict: false,
  });

  assert.equal(notes.value.get("note-1")?.version, 2);
  assert.equal(saved.get("note-1")?.version, 2);
  assert.equal(pending.get("note-1")?.serverVersion, 2);
  assert.equal(notes.value.get("note-1")?.isDirty, true);
});

test("notes conflict resolver stores local and server snapshots and blocks resend", async () => {
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      title: "Local",
      content: "<h1>Local</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      isDirty: true,
      isLoading: true,
      error: null,
    }],
  ]));
  const pending = new Map<string, any>([
    ["note-1", {
      id: "note-1",
      operation: "upsert",
      updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
      localVersion: 1,
      serverVersion: 1,
      workspaceId: "workspace-1",
      content: "<h1>Local</h1>",
    }],
  ]);
  const conflicts = new Map<string, any>();
  const saved = new Map<string, any>();
  const resolver = createNotesConflictResolver({
    workspaceId: "workspace-1",
    notes,
    conflictRepository: {
      save: async (conflict: any) => {
        conflicts.set(conflict.id, conflict);
      },
      load: async () => Array.from(conflicts.values()),
      remove: async (ids: string[]) => {
        ids.forEach((id) => conflicts.delete(id));
      },
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        pending.set(change.id, change);
      },
      load: async () => Array.from(pending.values()),
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    localRepository: {
      save: async (note: any) => {
        saved.set(note.id, note);
      },
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
  });

  const recorded = await resolver.recordContentConflicts({
    applied: [],
    appliedNotes: [],
    conflicts: [{
      id: "note-1",
      reason: "VERSION_MISMATCH",
      serverVersion: 2,
      clientServerVersion: 1,
      serverSnapshot: {
        id: "note-1",
        workspaceId: "workspace-1",
        title: "Server",
        content: "<h1>Server</h1>",
        version: 2,
      },
    }],
    idMap: {},
    noteIdMap: {},
    groupApplied: [],
    groupConflicts: [],
    groupIdMap: {},
    errors: [],
    layoutApplied: false,
    layoutConflict: false,
  });

  assert.equal(recorded, 1);
  assert.equal(conflicts.size, 1);
  assert.equal(pending.get("note-1")?.conflicted, true);
  assert.equal(notes.value.get("note-1")?.error?.includes("Sync conflict detected"), true);
  assert.equal(saved.get("note-1")?.version, 2);
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

test("workspace note normalization removes extra empty title-like headings", () => {
  assert.equal(
    normalizeWorkspaceNoteContent("<h1>Title</h1><p>Body</p><h1></h1>"),
    "<h1>Title</h1><p>Body</p><p></p>",
  );
  assert.equal(
    normalizeWorkspaceNoteContent("<h1>Title</h1><h1>Section</h1>"),
    "<h1>Title</h1><h2>Section</h2>",
  );
});

test("workspace note normalization repairs obvious fragmented single-character paragraphs", () => {
  assert.equal(
    normalizeWorkspaceNoteContent("<h1>A</h1><p>Sss</p><p>s</p><p><br></p><p>a</p><p>s</p><p>a</p><p>s</p>"),
    "<h1>A</h1><p>Sss</p><p>sasas</p>",
  );
});

test("workspace note normalization preserves short intentional single-character paragraphs", () => {
  assert.equal(
    normalizeWorkspaceNoteContent("<h1>A</h1><p>x</p><p>y</p><p>Body</p>"),
    "<h1>A</h1><p>x</p><p>y</p><p>Body</p>",
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

test("workspace note sync creates groups from queued local changes", async () => {
  const { noteGroups, prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [],
      groupChanges: [
        {
          id: "temp-group-created-locally",
          operation: "create",
          workspaceId: "workspace-1",
          title: "Local Group",
          order: 1,
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
        },
      ],
    },
  });

  const serverGroupId = result.groupIdMap["temp-group-created-locally"];
  assert.ok(serverGroupId);
  assert.deepEqual(result.groupApplied, ["temp-group-created-locally"]);
  assert.equal(noteGroups.get(serverGroupId)?.title, "Local Group");
  assert.equal(noteGroups.get(serverGroupId)?.order, 1);
});

test("workspace note sync renames groups from queued local changes", async () => {
  const { noteGroups, prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [],
      groupChanges: [
        {
          id: "group-1",
          operation: "rename",
          workspaceId: "workspace-1",
          title: "Renamed Group",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 2,
        },
      ],
    },
  });

  assert.deepEqual(result.groupApplied, ["group-1"]);
  assert.equal(noteGroups.get("group-1")?.title, "Renamed Group");
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

test("workspace note layout skips foreign note groups", async () => {
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

  await applyWorkspaceNoteLayout({
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
  });

  assert.equal(notes.get("note-1")?.groupId, null);
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

test("workspace note sync persists multiple temp notes in a new temp group layout", async () => {
  const { notes, noteGroups, prisma } = fakeNotesPrisma();

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "temp-note-a",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:00.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          groupId: "temp-group-batch",
          content: "<h1>Second visual note</h1><p>Body</p>",
        },
        {
          id: "temp-note-b",
          operation: "upsert",
          updatedAt: Date.parse("2026-01-01T00:00:01.000Z"),
          localVersion: 1,
          workspaceId: "workspace-1",
          groupId: "temp-group-batch",
          content: "<h1>First visual note</h1><p>Body</p>",
        },
      ],
      groupChanges: [
        {
          id: "temp-group-batch",
          operation: "create",
          workspaceId: "workspace-1",
          title: "Batch group",
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
        notes: [
          { id: "temp-note-b", groupId: "temp-group-batch", order: 0 },
          { id: "temp-note-a", groupId: "temp-group-batch", order: 1 },
        ],
        groups: [
          { id: "group-1", order: 0 },
          { id: "temp-group-batch", order: 1 },
        ],
      },
    },
  });

  const serverGroupId = result.groupIdMap["temp-group-batch"];
  const firstServerNoteId = result.idMap["temp-note-b"];
  const secondServerNoteId = result.idMap["temp-note-a"];

  assert.ok(serverGroupId);
  assert.equal(noteGroups.get(serverGroupId)?.order, 1);
  assert.equal(notes.get(firstServerNoteId)?.groupId, serverGroupId);
  assert.equal(notes.get(firstServerNoteId)?.order, 0);
  assert.equal(notes.get(secondServerNoteId)?.groupId, serverGroupId);
  assert.equal(notes.get(secondServerNoteId)?.order, 1);
  assert.equal(result.layoutApplied, true);
  assert.equal(result.layoutConflict, false);
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

test("notes layout move queues layout only without dirtying content", async () => {
  const runtime = fakeNotesLayoutRuntime([
    {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: null,
      order: 0,
      title: "One",
      content: "<h1>One</h1><p>Body</p>",
      isDirty: false,
    },
    {
      id: "note-2",
      workspaceId: "workspace-1",
      groupId: "group-1",
      order: 0,
      title: "Two",
      content: "<h1>Two</h1><p>Body</p>",
      isDirty: false,
    },
  ]);

  const result = await runtime.controller.apply({
    type: "MOVE_NOTE",
    noteId: "note-1",
    toGroupId: "group-1",
    toIndex: 1,
  });

  assert.equal(result, true);
  assert.equal(runtime.notes.value.get("note-1")?.groupId, "group-1");
  assert.equal(runtime.notes.value.get("note-1")?.order, 1);
  assert.equal(runtime.notes.value.get("note-1")?.isDirty, false);
  await flushAsyncWork();
  assert.equal(runtime.savedLayout?.notes.length, 2);
  assert.deepEqual(runtime.savedLayout?.groups, [
    { id: "group-1", order: 0 },
    { id: "group-2", order: 1 },
  ]);
  assert.equal(runtime.registeredBackgroundSync, 1);
  assert.equal(runtime.syncRequested, 1);
});

test("notes layout latest snapshot overwrites older pending layout", async () => {
  const runtime = fakeNotesLayoutRuntime([
    { id: "note-1", workspaceId: "workspace-1", groupId: null, order: 0, isDirty: false },
    { id: "note-2", workspaceId: "workspace-1", groupId: null, order: 1, isDirty: false },
    { id: "note-3", workspaceId: "workspace-1", groupId: "group-1", order: 0, isDirty: false },
  ]);

  await runtime.controller.apply({
    type: "MOVE_NOTE",
    noteId: "note-1",
    toGroupId: "group-1",
    toIndex: 1,
  });
  await runtime.controller.apply({
    type: "MOVE_NOTE",
    noteId: "note-2",
    toGroupId: "group-1",
    toIndex: 0,
  });
  await flushAsyncWork();

  assert.equal(runtime.savedLayout?.localVersion, 2);
  assert.deepEqual(runtime.savedLayout?.notes, [
    { id: "note-2", groupId: "group-1", order: 0 },
    { id: "note-3", groupId: "group-1", order: 1 },
    { id: "note-1", groupId: "group-1", order: 2 },
  ]);
});

test("notes layout queues already-applied layout for new local notes", async () => {
  const runtime = fakeNotesLayoutRuntime([
    { id: "note-1", workspaceId: "workspace-1", groupId: "group-1", order: 0, isDirty: false },
    { id: "temp-note-created-in-group", workspaceId: "workspace-1", groupId: "group-1", order: 1, isDirty: true },
  ]);

  const result = await runtime.controller.queueNoteLayout([
    { id: "note-1", groupId: "group-1", order: 0 },
    { id: "temp-note-created-in-group", groupId: "group-1", order: 1 },
  ]);

  assert.equal(result, true);
  await flushAsyncWork();
  assert.deepEqual(runtime.savedLayout?.notes, [
    { id: "note-1", groupId: "group-1", order: 0 },
    { id: "temp-note-created-in-group", groupId: "group-1", order: 1 },
  ]);
  assert.equal(runtime.registeredBackgroundSync, 1);
});

test("notes layout snapshots use the current group layout instead of stale queued groups", async () => {
  const runtime = fakeNotesLayoutRuntime(
    [
      { id: "note-1", workspaceId: "workspace-1", groupId: "temp-group-fresh", order: 0, isDirty: true },
    ],
    [
      { id: "group-1", order: 0 },
      { id: "temp-group-fresh", order: 1 },
    ],
  );

  await runtime.controller.queueNoteLayout([
    { id: "note-1", groupId: "group-1", order: 0 },
  ]);
  await runtime.controller.queueNoteLayout([
    { id: "note-1", groupId: "temp-group-fresh", order: 0 },
  ]);
  await flushAsyncWork();

  assert.deepEqual(runtime.savedLayout?.groups, [
    { id: "group-1", order: 0 },
    { id: "temp-group-fresh", order: 1 },
  ]);
});

test("notes command service updates editor memory before durable save resolves", async () => {
  let releaseSave: (() => void) | null = null;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let saveStarted = false;
  let queuedContent: any = null;
  const note = {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Old",
    content: "<h1>Old</h1><p>Body</p>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    metadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    isLoading: false,
    error: null,
  };
  const notes = ref(new Map<string, any>([[note.id, note]]));
  const service = createNotesCommandService({
    memoryStore: createNotesMemoryStore(notes as any),
    localRepository: {
      save: async () => {
        saveStarted = true;
        await saveGate;
      },
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
    pendingQueue: {
      add: async () => {},
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    layoutController: {
      status: ref("idle"),
      apply: async () => true,
      queueNoteLayout: async () => true,
    } as any,
    registerBackgroundSync: async () => {},
    requestSync: () => {},
  });

  const result = await service.updateNoteContent({
    id: "note-1",
    note: {
      ...note,
      title: "Live title",
      content: "<h1>Live title</h1><p>Updated</p>",
    },
    queueContentSave: (id, content, title) => {
      queuedContent = { id, content, title };
    },
  });

  assert.equal(result, true);
  assert.equal(notes.value.get("note-1")?.title, "Live title");
  assert.equal(notes.value.get("note-1")?.content, "<h1>Live title</h1><p>Updated</p>");
  assert.equal(notes.value.get("note-1")?.isDirty, true);
  assert.equal(saveStarted, true);
  assert.equal(queuedContent, null);

  releaseSave?.();
  await flushAsyncWork();
  assert.deepEqual(queuedContent, {
    id: "note-1",
    content: "<h1>Live title</h1><p>Updated</p>",
    title: "Live title",
  });
});

test("notes command service creates notes inside groups before queue persistence resolves", async () => {
  let releaseSave: (() => void) | null = null;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const notes = ref(new Map<string, any>());
  let queuedCreate: any = null;
  let queuedLayout = false;
  const service = createNotesCommandService({
    memoryStore: createNotesMemoryStore(notes as any),
    localRepository: {
      save: async () => {
        await saveGate;
      },
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        queuedCreate = change;
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    layoutController: {
      status: ref("idle"),
      apply: async () => true,
      queueNoteLayout: async () => {
        queuedLayout = true;
        return true;
      },
    } as any,
    registerBackgroundSync: async () => {},
    requestSync: () => {},
  });

  const id = await service.createNote({
    workspaceId: "workspace-1",
    groupId: "group-1",
    content: DEFAULT_WORKSPACE_NOTE_HTML,
  });

  assert.ok(id?.startsWith("temp-"));
  assert.equal(notes.value.get(id!)?.groupId, "group-1");
  assert.equal(notes.value.get(id!)?.order, 0);
  assert.equal(queuedCreate, null);

  releaseSave?.();
  await flushAsyncWork();
  assert.equal(queuedCreate?.id, id);
  assert.equal(queuedCreate?.groupId, "group-1");
  assert.equal(queuedLayout, true);
});

test("notes content queue flushes all pending note saves and requests sync once per note", async () => {
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: null,
      title: "One",
      content: "<h1>One</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      localVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDirty: false,
      isLoading: false,
      error: null,
    }],
    ["note-2", {
      id: "note-2",
      workspaceId: "workspace-1",
      groupId: "group-1",
      title: "Two",
      content: "<h1>Two</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      localVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDirty: false,
      isLoading: false,
      error: null,
    }],
  ]));
  const queued: any[] = [];
  let syncRequests = 0;
  const queue = createNotesContentQueue({
    workspaceId: "workspace-1",
    notes: notes as any,
    pendingQueue: {
      add: async (change: any) => {
        queued.push(change);
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    isVerifiedOnline: ref(true),
    requestSync: () => {
      syncRequests++;
    },
    debounceMs: 1000,
    flushEditorDrafts: async () => {},
  });

  queue.queueContentSave("note-1", "<h1>One live</h1>", "One live");
  queue.queueContentSave("note-2", "<h1>Two live</h1>", "Two live");
  await queue.flushDrafts();

  assert.deepEqual(queued.map((change) => change.id).sort(), ["note-1", "note-2"]);
  assert.equal(notes.value.get("note-1")?.isDirty, true);
  assert.equal(notes.value.get("note-2")?.isDirty, true);
  assert.equal(syncRequests, 2);
});

test("notes content queue keeps offline edits durable without requesting page sync", async () => {
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: null,
      title: "One",
      content: "<h1>One</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDirty: false,
      isLoading: false,
      error: null,
    }],
  ]));
  let backgroundSyncRegistered = 0;
  let syncRequests = 0;
  const queue = createNotesContentQueue({
    workspaceId: "workspace-1",
    notes: notes as any,
    pendingQueue: {
      add: async () => {},
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {
        backgroundSyncRegistered++;
      },
    },
    isVerifiedOnline: ref(false),
    requestSync: () => {
      syncRequests++;
    },
    flushEditorDrafts: async () => {},
  });

  const saved = await queue.queueContentSaveNow("note-1", "<h1>Offline</h1>", "Offline");

  assert.equal(saved, true);
  assert.equal(notes.value.get("note-1")?.isDirty, true);
  assert.equal(backgroundSyncRegistered, 1);
  assert.equal(syncRequests, 0);
});

test("notes group command service updates drawer memory before durable save resolves", async () => {
  let releaseSave: (() => void) | null = null;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const groups = ref(new Map<string, any>());
  let queuedGroup: any = null;
  const service = createNotesGroupCommandService({
    workspaceId: "workspace-1",
    groups: groups as any,
    groupQueue: {
      add: async (change: any) => {
        queuedGroup = change;
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    layoutQueue: {
      save: async () => {},
      load: async () => null,
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    getOrderedGroups: () => Array.from(groups.value.values()),
    saveGroup: async () => {
      await saveGate;
    },
    saveGroups: async () => {},
    deleteGroupLocal: async () => {},
    registerBackgroundSync: async () => {},
    scheduleSync: () => {},
    setError: () => {},
  });

  const id = service.createGroup("Immediate group");

  assert.ok(id?.startsWith("temp-group-"));
  assert.equal(groups.value.get(id!)?.title, "Immediate group");
  assert.equal(groups.value.get(id!)?.order, 0);
  assert.equal(queuedGroup, null);

  releaseSave?.();
  await flushAsyncWork();
  assert.equal(queuedGroup?.id, id);
  assert.equal(queuedGroup?.operation, "create");
});

test("notes sync engine reruns when work is requested during an in-flight sync", async () => {
  let releaseFirstDrain: (() => void) | null = null;
  const firstDrainGate = new Promise<void>((resolve) => {
    releaseFirstDrain = resolve;
  });
  let drainCount = 0;
  const engine = createNotesSyncEngine({
    drainWorkspace: async () => {
      drainCount++;
      if (drainCount === 1) {
        await firstDrainGate;
      }
      return true;
    },
  });

  const firstRun = engine.syncWorkspace("workspace-1", "background");
  const secondRun = engine.syncWorkspace("workspace-1", "background");

  assert.equal(firstRun, secondRun);
  assert.equal(drainCount, 1);

  releaseFirstDrain?.();
  await firstRun;

  assert.equal(drainCount, 2);
});

test("notes sync runtime drains queues in deterministic order", async () => {
  const events: string[] = [];
  const pendingChanges = [{
    id: "note-1",
    operation: "upsert",
    updatedAt: Date.now(),
    localVersion: 1,
    workspaceId: "workspace-1",
    title: "Local",
    content: "<h1>Local</h1>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
  }];
  const pendingGroups = [{
    id: "group-1",
    operation: "rename",
    workspaceId: "workspace-1",
    title: "Group",
    updatedAt: Date.now(),
    localVersion: 1,
  }];
  const pendingLayout = {
    id: "workspace-1",
    workspaceId: "workspace-1",
    updatedAt: Date.now(),
    localVersion: 1,
    notes: [{ id: "note-1", groupId: "group-1", order: 0 }],
    groups: [{ id: "group-1", order: 0 }],
  };
  const notes = ref(new Map<string, any>([
    ["note-1", {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: "group-1",
      title: "Local",
      content: "<h1>Local</h1>",
      tags: [],
      order: 0,
      noteType: "TEXT",
      metadata: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDirty: true,
      isLoading: false,
      error: null,
    }],
  ]));
  const layoutPendingCount = ref(0);
  const layoutStatus = ref<any>("idle");
  let syncPayload: any = null;
  let layoutRemoved = false;

  const runtime = createNotesSyncRuntime({
    workspaceId: "workspace-1",
    notes: notes as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount,
    layoutStatus,
    noteIdAliases: ref(new Map()),
    localRepository: {
      save: async () => {},
      saveMany: async () => {},
      loadByWorkspace: async () => [],
      delete: async () => {},
    } as any,
    pendingQueue: {
      add: async () => {},
      load: async () => pendingChanges as any,
      remove: async (ids: string[]) => {
        events.push(`content-remove:${ids.join(",")}`);
      },
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
      load: async () => pendingGroups as any,
      remove: async (ids: string[]) => {
        events.push(`group-remove:${ids.join(",")}`);
      },
      registerBackgroundSync: async () => {},
    },
    layoutQueue: {
      save: async () => {},
      load: async () => (layoutRemoved ? null : pendingLayout as any),
      remove: async (workspaceId: string) => {
        layoutRemoved = true;
        events.push(`layout-remove:${workspaceId}`);
      },
      registerBackgroundSync: async () => {},
    },
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {
        events.push("apply-result");
      },
    },
    conflictResolver: {
      hasConflicts: async () => false,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => {
        events.push("record-conflicts");
        return 0;
      },
    },
    networkMonitor: {
      isVerifiedOnline: ref(true),
    },
    notesApi: {
      getByWorkspace: async () => ({ success: true, data: [] }),
      sync: async (payload: any) => {
        events.push("api-sync");
        syncPayload = payload;
        return {
          success: true,
          data: {
            applied: ["note-1"],
            appliedNotes: [],
            conflicts: [],
            idMap: {},
            noteIdMap: {},
            groupApplied: ["group-1"],
            groupConflicts: [],
            groupIdMap: {},
            errors: [],
            layoutApplied: true,
            layoutConflict: false,
          },
        };
      },
    },
    flushDrafts: async () => {
      events.push("flush-drafts");
    },
    resetSyncRetry: () => {
      events.push("reset-retry");
    },
    scheduleSyncRetry: () => {
      events.push("schedule-retry");
    },
    hydrateLocalGroups: async () => {},
  });

  const synced = await runtime.syncPendingChanges("manual");

  assert.equal(synced, true);
  assert.equal(syncPayload.changes.length, 1);
  assert.equal(syncPayload.groupChanges.length, 1);
  assert.equal(syncPayload.layoutChange.workspaceId, "workspace-1");
  assert.deepEqual(events, [
    "flush-drafts",
    "api-sync",
    "reset-retry",
    "apply-result",
    "record-conflicts",
    "content-remove:note-1",
    "group-remove:group-1",
    "layout-remove:workspace-1",
  ]);
  assert.equal(layoutStatus.value, "synced");
  assert.equal(layoutPendingCount.value, 0);
});

test("notes temp IDs are unique for fast repeated note and group creation", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    ids.add(createNotesTempId("temp"));
    ids.add(createNotesTempId("temp-group"));
  }

  assert.equal(ids.size, 200);
  assert.ok(Array.from(ids).every((id) => id.startsWith("temp-")));
});

test("shared local-first temp IDs are unique and scoped", () => {
  const ids = new Set<string>();
  const noteId = createClientTempId("note");
  const groupId = createClientTempId("note-group");
  const boardItemId = createClientTempId("board-item");

  for (let i = 0; i < 100; i++) {
    ids.add(createClientTempId("note"));
    ids.add(createClientTempId("note-group"));
  }

  assert.equal(ids.size, 200);
  assert.ok(noteId.startsWith("temp-"));
  assert.ok(groupId.startsWith("temp-group-"));
  assert.ok(boardItemId.startsWith("temp-board-item-"));
});

test("shared local-first retry policy retries transient failures and stops at the cap", async () => {
  const scheduled: Array<{ attempt: number; delay: number }> = [];
  const callbacks: Array<() => void> = [];
  let terminalFailures = 0;
  const policy = createLocalFirstErrorPolicy({
    maxAttempts: 2,
    baseDelay: 1,
    jitterPct: 0,
    setTimeoutFn: ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      scheduled.push({ attempt: scheduled.length + 1, delay: delay ?? 0 });
      return callbacks.length as any;
    }) as typeof setTimeout,
    clearTimeoutFn: (() => {}) as typeof clearTimeout,
  });

  policy.scheduleRetry({
    workspaceId: "workspace-1",
    retry: () => {},
    onTerminalFailure: () => {
      terminalFailures++;
    },
  });
  policy.scheduleRetry({
    workspaceId: "workspace-1",
    retry: () => {},
    onTerminalFailure: () => {
      terminalFailures++;
    },
  });
  policy.scheduleRetry({
    workspaceId: "workspace-1",
    retry: () => {},
    onTerminalFailure: () => {
      terminalFailures++;
    },
  });

  assert.equal(policy.attempts(), 2);
  assert.equal(scheduled.length, 2);
  assert.equal(terminalFailures, 1);
});

test("shared local-first conflict records preserve local and server snapshots", () => {
  const conflict: LocalFirstConflictRecord = {
    id: "workspace-1:content:note-1",
    workspaceId: "workspace-1",
    scope: "content",
    entityId: "note-1",
    reason: "VERSION_MISMATCH",
    createdAt: 1,
    updatedAt: 2,
    localSnapshot: { title: "Local" },
    serverSnapshot: { title: "Server" },
    serverVersion: 3,
    clientServerVersion: 2,
  };

  assert.deepEqual(conflict.localSnapshot, { title: "Local" });
  assert.deepEqual(conflict.serverSnapshot, { title: "Server" });
  assert.equal(isLocalFirstConflict("VERSION_MISMATCH"), true);
  assert.equal(isLocalFirstConflict("network timeout"), false);
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

test("canvas transform normalization bakes rect scale into dimensions once", () => {
  const shape: any = {
    id: "shape-1",
    type: "rect",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    scaleX: 1,
    scaleY: 1,
  };

  normalizeShapeTransform(shape, {
    scaleX: () => 0.5,
    scaleY: () => 2,
    width: () => 100,
    height: () => 50,
  });

  assert.equal(shape.width, 50);
  assert.equal(shape.height, 100);
  assert.equal(shape.scaleX, 1);
  assert.equal(shape.scaleY, 1);
});

test("canvas transform normalization preserves circle shape with uniform radius", () => {
  const shape: any = {
    id: "shape-1",
    type: "circle",
    x: 10,
    y: 20,
    radius: 40,
    scaleX: 1,
    scaleY: 1,
  };

  normalizeShapeTransform(shape, {
    scaleX: () => 0.25,
    scaleY: () => 4,
    radius: () => 40,
  });

  assert.equal(shape.radius, 40);
  assert.equal(shape.scaleX, 1);
  assert.equal(shape.scaleY, 1);
});

test("useSplitNotes maps visual activation to the correct logical pane", () => {
  const rightSecondary = createRealSplitNotes();
  rightSecondary.setPrimaryNote("note-1");
  rightSecondary.openSplit("note-2", "right");

  rightSecondary.activateRight();
  assert.equal(rightSecondary.activePane.value, "secondary");
  assert.equal(rightSecondary.activePaneSide.value, "right");

  rightSecondary.activateLeft();
  assert.equal(rightSecondary.activePane.value, "primary");
  assert.equal(rightSecondary.activePaneSide.value, "left");

  const leftSecondary = createRealSplitNotes();
  leftSecondary.setPrimaryNote("note-1");
  leftSecondary.openSplit("note-2", "left");

  leftSecondary.activateLeft();
  assert.equal(leftSecondary.activePane.value, "secondary");
  assert.equal(leftSecondary.activePaneSide.value, "left");

  leftSecondary.activateRight();
  assert.equal(leftSecondary.activePane.value, "primary");
  assert.equal(leftSecondary.activePaneSide.value, "right");
});

test("useSplitNotes swap keeps note identity active while moving visual side", () => {
  const splitNotes = createRealSplitNotes();
  splitNotes.setPrimaryNote("note-1");
  splitNotes.openSplit("note-2", "right");
  splitNotes.setActivePane("secondary");

  assert.equal(splitNotes.rightNoteId.value, "note-2");
  assert.equal(splitNotes.activePaneSide.value, "right");

  splitNotes.swapPanes();

  assert.equal(splitNotes.leftNoteId.value, "note-2");
  assert.equal(splitNotes.rightNoteId.value, "note-1");
  assert.equal(splitNotes.activePane.value, "secondary");
  assert.equal(splitNotes.activePaneSide.value, "left");
});

test("useSplitNotes closing panes returns the surviving note and restores single view", () => {
  const closePrimary = createRealSplitNotes();
  closePrimary.setPrimaryNote("note-1");
  closePrimary.openSplit("note-2", "right");

  const promotedNoteId = closePrimary.closePane("primary");

  assert.equal(promotedNoteId, "note-2");
  assert.equal(closePrimary.isSplit.value, false);
  assert.equal(closePrimary.primaryNoteId.value, "note-2");
  assert.equal(closePrimary.secondaryNoteId.value, null);
  assert.equal(closePrimary.activePane.value, "primary");

  const closeSecondary = createRealSplitNotes();
  closeSecondary.setPrimaryNote("note-1");
  closeSecondary.openSplit("note-2", "right");

  const primaryNoteId = closeSecondary.closePane("secondary");

  assert.equal(primaryNoteId, "note-1");
  assert.equal(closeSecondary.isSplit.value, false);
  assert.equal(closeSecondary.primaryNoteId.value, "note-1");
  assert.equal(closeSecondary.secondaryNoteId.value, null);
  assert.equal(closeSecondary.activePane.value, "primary");
});

test("useSplitNotes refuses duplicate note assignments across split panes", () => {
  const splitNotes = createRealSplitNotes();
  splitNotes.setPrimaryNote("note-1");
  splitNotes.openSplit("note-2", "right");

  splitNotes.setSecondaryNote("note-1");

  assert.equal(splitNotes.primaryNoteId.value, "note-1");
  assert.equal(splitNotes.secondaryNoteId.value, "note-2");
  assert.equal(splitNotes.activePane.value, "primary");

  splitNotes.setPrimaryNote("note-2");

  assert.equal(splitNotes.primaryNoteId.value, "note-1");
  assert.equal(splitNotes.secondaryNoteId.value, "note-2");
  assert.equal(splitNotes.activePane.value, "secondary");
});

test("workspace note sync skips missing layout groups without touching content", async () => {
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

  assert.equal(result.layoutApplied, true);
  assert.equal(result.layoutConflict, false);
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

test("language lexical parser validates JSON before callers finalize generation", () => {
  assert.throws(() => parseLexicalEntry("not-json", "hola"));

  const entry = parseLexicalEntry(
    JSON.stringify({
      translation: "hello",
      detectedLang: "es",
      partOfSpeech: "interjection",
      meanings: [{ definition: "greeting", translation: "hello" }],
      examples: [{ text: "Hola, Ana", translation: "Hello, Ana" }],
    }),
    "hola",
  );

  assert.equal(entry.translation, "hello");
  assert.equal(entry.detectedLang, "es");
  assert.equal(entry.meanings[0]?.definition, "greeting");
});

test("language story parser rejects incomplete LLM story responses", () => {
  assert.throws(() =>
    parseLanguageStoryResponse(JSON.stringify({ storyText: "Only text" })),
  );

  const story = parseLanguageStoryResponse(
    JSON.stringify({
      storyText: "Hola Ana.",
      sentences: [
        {
          text: "Hola Ana.",
          clozeWord: "Hola",
          clozeBlank: "____ Ana.",
          clozeIndex: 0,
        },
      ],
    }),
  );

  assert.equal(story.storyText, "Hola Ana.");
  assert.equal(story.sentences[0]?.clozeWord, "Hola");
});

test("language words listing paginates after hasStory filtering", async () => {
  const rows = [
    {
      id: "word-without-story",
      userId: "user-1",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      stories: [],
    },
    {
      id: "word-with-story",
      userId: "user-1",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      stories: [{ id: "story-1", storyText: "Story", sentences: [] }],
    },
    {
      id: "older-word-with-story",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      stories: [{ id: "story-2", storyText: "Older story", sentences: [] }],
    },
  ];

  const prisma = {
    languageWord: {
      findMany: async ({ where, take }: any) => {
        if (where?.category?.not === null) return [];
        const cursorDate = where?.createdAt?.lt
          ? new Date(where.createdAt.lt)
          : null;
        return rows
          .filter((row) => !cursorDate || row.createdAt < cursorDate)
          .slice(0, take);
      },
    },
  };

  const result = await listLanguageWords({
    prisma,
    userId: "user-1",
    hasStory: true,
    limit: 1,
  });

  assert.deepEqual(
    result.words.map((word: any) => word.id),
    ["word-with-story"],
  );
  assert.equal(result.nextCursor, "2026-01-02T00:00:00.000Z");
});

test("language runtime owns word-bank fetch filters and language scoping", async () => {
  const calls: any[] = [];
  const runtime = createLanguageLearningRuntime({
    api: {
      getWords: async (params: any) => {
        calls.push(params);
        return {
          success: true,
          data: {
            words: [
              {
                id: "word-1",
                word: "hola",
                translation: "hello",
                translationLang: "en",
                sourceLang: "es",
                sourceType: "manual",
                status: "captured",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
            nextCursor: "cursor-1",
            categories: ["greeting"],
          },
        };
      },
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 1, due: 0, enrolled: 0, mastered: 0 },
      }),
    },
  });

  runtime.setPreferences({
    id: "prefs-1",
    userId: "user-1",
    enabled: true,
    targetLanguage: "es",
    nativeLanguage: "en",
    autoEnroll: true,
    sessionCardLimit: 12,
    showConsent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  runtime.setWordFilters({
    status: "captured",
    category: "greeting",
    hasStory: true,
    search: "hol",
  });

  await runtime.fetchWords();

  assert.equal(calls[0].targetLanguage, "es");
  assert.equal(calls[0].nativeLanguage, "en");
  assert.equal(calls[0].status, "captured");
  assert.equal(calls[0].category, "greeting");
  assert.equal(calls[0].hasStory, true);
  assert.equal(runtime.words.value[0]?.word, "hola");
  assert.deepEqual(runtime.categories.value, ["greeting"]);
  assert.equal(runtime.hasMore.value, true);
});

test("language runtime mutates word-bank memory after enroll and delete", async () => {
  const runtime = createLanguageLearningRuntime({
    api: {
      getWords: async () => ({
        success: true,
        data: {
          words: [
            {
              id: "word-1",
              word: "hola",
              translation: "hello",
              translationLang: "en",
              sourceLang: "es",
              sourceType: "manual",
              status: "captured",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          nextCursor: null,
          categories: [],
        },
      }),
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 1, due: 0, enrolled: 1, mastered: 0 },
      }),
    },
  });

  await runtime.fetchWords();
  await runtime.enrollWord("word-1");
  assert.equal(runtime.words.value[0]?.status, "enrolled");

  await runtime.deleteWord("word-1");
  assert.deepEqual(runtime.words.value, []);
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
