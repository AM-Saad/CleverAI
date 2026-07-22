import assert from "node:assert/strict";
import {
  IDBKeyRange as FakeIDBKeyRange,
  indexedDB as fakeIndexedDB,
} from "fake-indexeddb";
import { effectScope, ref, shallowRef } from "vue";
import { calculateSM2 } from "../server/modules/review/domain/sm2";
import {
  projectOfflineReviewInterval,
  reviewGradeForKey,
  REVIEW_GRADE_BY_KEY,
} from "../shared/utils/sm2";
import {
  gradeReviewCard,
  isRetryableReviewGradeError,
} from "../server/modules/review/application/gradeReviewCard";
import { syncBoardItems } from "../server/modules/board/application/syncBoardItems";
import { persistBoardItemOrders } from "../server/modules/board/application/persistBoardItemOrders";
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
import { BoardItemsSyncRequestSchema } from "../shared/utils/boardItem.contract";
import {
  WorkspaceExternalRefSchema,
  WorkspaceImportMappingSummarySchema,
} from "../shared/utils/workspaceIntegration.contract";
import { isDuplicateKeyError } from "../server/modules/integrations/infrastructure/integrationRepository";
import {
  CreateNoteDTO,
  NoteSchema,
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
import {
  buildNoteCollabRoomName,
  parseNoteCollabRoomName,
  signNoteCollabToken,
  verifyNoteCollabToken,
} from "../server/modules/notes/collab/noteCollab";
import { createNotesConflictResolver } from "../app/features/notes/composables/notesConflictResolver";
import { createNotesCommandService } from "../app/features/notes/composables/notesCommandService";
import { createNotesContentQueue } from "../app/features/notes/composables/notesContentQueue";
import { useNoteDraft } from "../app/features/notes/composables/useNoteDraft";
import { useQuickNoteCapture } from "../app/features/notes/composables/useQuickNoteCapture";
import { useQuickBoardItemCapture } from "../app/features/board/composables/useQuickBoardItemCapture";
import { createNotesGroupCommandService } from "../app/features/notes/composables/notesGroupCommandService";
import { createNotesMemoryStore } from "../app/features/notes/composables/notesMemoryStore";
import { createNotesSyncEngine } from "../app/features/notes/composables/notesSyncEngine";
import { createNotesTempId } from "../app/features/notes/composables/tempIds";
import { createClientTempId } from "../app/utils/local-first/tempIds";
import {
  createLocalFirstErrorPolicy,
  isLocalFirstConflict,
} from "../app/utils/local-first/errorPolicy";
import { useDoubleTapConfirm } from "../app/composables/shared/useDoubleTapConfirm";
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
import {
  useSplitNotes,
  type ActivePane,
  type SplitPosition,
} from "../app/composables/ui/useSplitNotes";
import { normalizeShapeTransform } from "../app/utils/canvas/geometry";
import { parseLexicalEntry } from "../server/modules/language-learning/domain/lexicalEntry";
import { parseLanguageStoryResponse } from "../server/modules/language-learning/domain/storyResponse";
import {
  languageStoryPrompt,
  translationPrompt,
} from "../server/utils/llm/languagePrompts";
import { listLanguageWords } from "../server/modules/language-learning/application/listLanguageWords";
import { LanguageWordsResponseSchema } from "../shared/utils/language.contract";
import { maybeAutoEnrollLanguageWord } from "../server/modules/language-learning/application/autoEnrollLanguageWord";
import { saveLanguageWord } from "../server/modules/language-learning/application/saveLanguageWord";
import { createLanguageLearningRuntime } from "../app/features/language-learning/composables/languageLearningRuntime";
import FetchFactory from "../app/services/FetchFactory";
import { PrismaLanguageReviewRepository } from "../server/modules/language-learning/infrastructure/PrismaLanguageReviewRepository";
import type {
  ReviewCardRecord,
  ReviewRepository,
  UpdateReviewCardInput,
} from "../server/modules/review/ports/ReviewRepository";
import type { XpPort } from "../server/modules/review/ports/XpPort";
import type { BoardItemState } from "../app/features/board/composables/useBoardItemsStore";
import {
  boardItemPayloadForFields,
  changedBoardItemFields,
} from "../app/features/board/composables/boardItemMutation";
import {
  OfflineSyncRequestSchema,
  OfflineSyncResultSchema,
} from "../shared/utils/offline-sync.contract";
import { calculateOfflineSM2 } from "../shared/utils/sm2";
import { orderOfflineMutations } from "../shared/utils/offline-mutation-order";
import { positionBetween } from "../shared/utils/position-key";
import {
  formatDateKey,
  occurrenceKey as dailyOccurrenceKey,
  recurrenceMatchesDate,
} from "../shared/utils/daily-recurrence";
import { placementStateAfterMove } from "../shared/utils/daily-placement";
import { projectLocalDay } from "../app/features/daily/domain/projectLocalDay";
import {
  autoResolveEquivalentNoteConflicts,
  type DailyLocalSnapshot,
} from "../app/features/daily/repositories/dailyLocalRepository";
import { createKeyedAsyncDebounce } from "../app/utils/keyedAsyncDebounce";
import { useDebounce } from "../app/utils/debounce";
import { DB_CONFIG } from "../app/utils/constants/pwa";
import {
  applySyncResult,
  claimOfflineMutations,
  commitOfflineMutation,
  getOfflineEntity,
  getOfflineSyncMetadata,
  listOfflineConflicts,
  listOfflineMutations,
  listOfflineEntities,
  putOfflineEntities,
  recoverInterruptedMutations,
  remapOfflineIds,
  resolveOfflineConflict,
  updateOfflineSyncMetadata,
} from "../app/utils/offline-v2/repository";
import {
  loadNotesFromIndexedDB,
  getAllRecords,
  acknowledgePendingNoteChange,
  deleteNoteFromIndexedDB,
  deletePendingNoteChanges,
  loadPendingNoteChanges,
  openUnifiedDB,
  putRecord,
  queueNoteChange,
  reconcileNotesWorkspaceProjection,
  reconcileOfflineV2NoteIds,
  reconcileOfflineV2NoteGroupIds,
  saveNoteToIndexedDB,
} from "../app/utils/idb";
import {
  loadBoardItemsProjection,
  migrateLegacyBoardProjection,
  putBoardProjectionRecord,
  reconcileBoardRelationsForItem,
  reconcileBoardWorkspaceProjection,
} from "../app/features/board/repositories/boardOfflineRepository";

if (!(globalThis as any).indexedDB)
  (globalThis as any).indexedDB = fakeIndexedDB;
if (!(globalThis as any).IDBKeyRange)
  (globalThis as any).IDBKeyRange = FakeIDBKeyRange;

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

function test(name: string, run: TestCase["run"]) {
  tests.push({ name, run });
}

function notesSyncSuccess(overrides: Record<string, unknown> = {}) {
  return {
    success: true as const,
    data: {
      applied: [],
      appliedNotes: [],
      conflicts: [],
      idMap: {},
      noteIdMap: {},
      replayedCreates: [],
      groupApplied: [],
      groupConflicts: [],
      groupIdMap: {},
      replayedGroupCreates: [],
      errors: [],
      layoutApplied: false,
      layoutConflict: false,
      ...overrides,
    },
  };
}

test("Daily recurrence clamps missing month days to the last day", () => {
  const monthly = {
    frequency: "MONTHLY" as const,
    interval: 1,
    monthDay: 31,
    missingDayPolicy: "LAST_DAY" as const,
    ends: "NEVER" as const,
  };
  assert.equal(
    recurrenceMatchesDate("2027-01-31", monthly, "2027-02-28"),
    true,
  );
  assert.equal(
    recurrenceMatchesDate("2028-01-31", monthly, "2028-02-29"),
    true,
  );
  assert.equal(
    recurrenceMatchesDate("2027-01-31", monthly, "2027-02-27"),
    false,
  );
});

test("Daily recurrence honors weekday, interval, and occurrence count", () => {
  const weekly = {
    frequency: "WEEKLY" as const,
    interval: 2,
    weekdays: ["MONDAY" as const],
    missingDayPolicy: "LAST_DAY" as const,
    ends: "AFTER_COUNT" as const,
    count: 3,
  };
  assert.equal(recurrenceMatchesDate("2026-07-06", weekly, "2026-07-20"), true);
  assert.equal(recurrenceMatchesDate("2026-07-06", weekly, "2026-08-03"), true);
  assert.equal(
    recurrenceMatchesDate("2026-07-06", weekly, "2026-08-17"),
    false,
  );
});

test("Daily calendar labels do not shift across local timezones", () => {
  assert.equal(
    formatDateKey("2026-07-22", "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    "Wednesday, July 22",
  );
  assert.equal(formatDateKey("not-a-date", "en-US"), "not-a-date");
});

test("moving an action preserves its completion state", () => {
  assert.equal(placementStateAfterMove("OPEN"), "ACTIVE");
  assert.equal(placementStateAfterMove("COMPLETED"), "COMPLETED");
});

test("Opening a future Daily date projects virtual items without creating records", () => {
  const snapshot: DailyLocalSnapshot = {
    notes: [],
    actionItems: [
      {
        id: "series-1",
        userId: "user-1",
        title: "Practice",
        description: null,
        timingMode: "ALL_DAY",
        startDate: "2026-07-20",
        localTime: null,
        timezone: "Africa/Cairo",
        recurrence: {
          frequency: "DAILY",
          interval: 1,
          missingDayPolicy: "LAST_DAY",
          ends: "NEVER",
        },
        lifecycle: "ACTIVE",
        createdAt: "2026-07-20T00:00:00.000Z",
        updatedAt: "2026-07-20T00:00:00.000Z",
      },
    ],
    occurrences: [],
    placements: [],
  };
  const projection = projectLocalDay(snapshot, "2026-08-01");
  assert.equal(projection.items.length, 1);
  assert.equal(projection.items[0]?.virtual, true);
  assert.equal(
    projection.items[0]?.occurrenceKey,
    dailyOccurrenceKey("series-1", "2026-08-01"),
  );
  assert.equal(snapshot.occurrences.length, 0);
});

test("an equivalent daily note conflict is auto-resolved without user interruption", async () => {
  const accountId = `account-${Date.now()}-${Math.random()}-daily-note-converge`;
  const noteId = `daily-note-${accountId}`;
  const mutation = {
    id: `note-upsert-${accountId}`,
    entity: "dailyNote" as const,
    operation: "dailyNote.upsert",
    entityId: noteId,
    changedFields: ["content"],
    payload: {
      id: noteId,
      dateKey: "2026-07-22",
      content: { type: "doc", content: [{ type: "text", text: "same" }] },
    },
    dependsOn: [],
    occurredAt: "2026-07-22T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 1,
  };
  await commitOfflineMutation({
    accountId,
    mutation,
    localRecord: {
      entity: "dailyNote",
      entityId: noteId,
      version: 1,
      data: { id: noteId, content: mutation.payload.content },
    },
  });
  await applySyncResult({
    accountId,
    mutation: { ...mutation, accountId, updatedAt: Date.now() },
    result: {
      status: "conflict",
      entity: "dailyNote",
      entityId: noteId,
      conflict: {
        serverVersion: 2,
        overlappingFields: ["content"],
        // A second device (or a retried save) landed identical content.
        serverSnapshot: {
          id: noteId,
          content: { type: "doc", content: [{ type: "text", text: "same" }] },
        },
        reason: "The same fields changed on another device.",
      },
    },
  });
  assert.equal((await listOfflineConflicts(accountId)).length, 1);

  await autoResolveEquivalentNoteConflicts(accountId);

  assert.equal((await listOfflineConflicts(accountId)).length, 0);
  assert.equal((await listOfflineMutations(accountId)).length, 0);
});

test("a genuinely conflicting daily note is left for the user to resolve", async () => {
  const accountId = `account-${Date.now()}-${Math.random()}-daily-note-diverge`;
  const noteId = `daily-note-${accountId}`;
  const mutation = {
    id: `note-upsert-${accountId}`,
    entity: "dailyNote" as const,
    operation: "dailyNote.upsert",
    entityId: noteId,
    changedFields: ["content"],
    payload: {
      id: noteId,
      dateKey: "2026-07-22",
      content: { type: "doc", content: [{ type: "text", text: "mine" }] },
    },
    dependsOn: [],
    occurredAt: "2026-07-22T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 1,
  };
  await commitOfflineMutation({
    accountId,
    mutation,
    localRecord: {
      entity: "dailyNote",
      entityId: noteId,
      version: 1,
      data: { id: noteId, content: mutation.payload.content },
    },
  });
  await applySyncResult({
    accountId,
    mutation: { ...mutation, accountId, updatedAt: Date.now() },
    result: {
      status: "conflict",
      entity: "dailyNote",
      entityId: noteId,
      conflict: {
        serverVersion: 2,
        overlappingFields: ["content"],
        serverSnapshot: {
          id: noteId,
          content: { type: "doc", content: [{ type: "text", text: "theirs" }] },
        },
        reason: "The same fields changed on another device.",
      },
    },
  });
  assert.equal((await listOfflineConflicts(accountId)).length, 1);

  await autoResolveEquivalentNoteConflicts(accountId);

  assert.equal((await listOfflineConflicts(accountId)).length, 1);
  assert.equal((await listOfflineMutations(accountId)).length, 1);
});

test("offline-v2 contract keeps mutations replayable and ordered", () => {
  const parsed = OfflineSyncRequestSchema.parse({
    clientId: "device-a",
    mutations: [
      {
        id: "mutation-a",
        entity: "review",
        operation: "review.grade",
        entityId: "review-a",
        changedFields: ["reviewState"],
        payload: { cardId: "review-a", grade: 4 },
        dependsOn: [],
        occurredAt: "2026-07-09T20:00:00.000Z",
        createdAt: 1,
        attempts: 0,
        status: "pending",
        sequence: true,
      },
    ],
  });
  assert.equal(parsed.mutations[0]?.sequence, true);
  assert.equal(parsed.mutations[0]?.status, "pending");
});

test("offline-v2 results carry revisions for indirectly changed Board rows", () => {
  const result = OfflineSyncResultSchema.parse({
    id: "delete-column-1",
    status: "applied",
    entity: "boardColumn",
    entityId: "column-1",
    version: 3,
    canonical: { id: "column-1", deleted: true },
    related: [
      {
        entity: "boardItem",
        entityId: "item-1",
        version: 8,
        canonical: { id: "item-1", columnId: null, order: 0, position: "V" },
      },
    ],
  });
  assert.equal(result.related?.[0]?.version, 8);
  assert.equal(result.related?.[0]?.canonical?.columnId, null);
});

test("Board item patches contain exactly the fields that changed", () => {
  const previous = {
    id: "item-exact-patch",
    workspaceId: "workspace-exact-patch",
    columnId: "column-a",
    content: "Before",
    tags: ["one"],
    dueDate: null,
    attachments: [],
    order: 10,
    position: "V",
  } as unknown as BoardItemState;
  const next = {
    ...previous,
    content: "After",
    tags: ["one", "two"],
  };
  const fields = changedBoardItemFields(previous, next);
  assert.deepEqual(fields, ["content", "tags"]);
  assert.deepEqual(boardItemPayloadForFields(next, fields), {
    content: "After",
    tags: ["one", "two"],
  });
});

test("offline SM-2 calculation matches the server default policy", () => {
  assert.deepEqual(
    calculateOfflineSM2({
      currentEF: 2.5,
      currentInterval: 1,
      currentRepetitions: 1,
      grade: 4,
    }),
    calculateSM2({
      currentEF: 2.5,
      currentInterval: 1,
      currentRepetitions: 1,
      grade: 4,
    }),
  );
});

test("offline mutation ordering is dependency-first and rejects cycles", () => {
  const { ordered, cyclic } = orderOfflineMutations([
    { id: "child", createdAt: 2, dependsOn: ["parent"] },
    { id: "parent", createdAt: 3, dependsOn: [] },
    { id: "cycle-a", createdAt: 4, dependsOn: ["cycle-b"] },
    { id: "cycle-b", createdAt: 5, dependsOn: ["cycle-a"] },
  ]);
  assert.deepEqual(
    ordered.map((mutation) => mutation.id),
    ["parent", "child"],
  );
  assert.deepEqual(
    cyclic.map((mutation) => mutation.id),
    ["cycle-a", "cycle-b"],
  );
});

test("position keys remain ordered through repeated midpoint inserts", () => {
  let upper: string | undefined;
  for (let i = 0; i < 100; i++) {
    const next = positionBetween(undefined, upper);
    if (upper) assert.ok(next < upper, `${next} should sort before ${upper}`);
    upper = next;
  }
});

test("keyed async debounce does not let one board item cancel another", async () => {
  const calls: string[] = [];
  const debouncer = createKeyedAsyncDebounce(async (id: string) => {
    calls.push(id);
  }, 5);
  debouncer.schedule("item-a");
  debouncer.schedule("item-b");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(calls.sort(), ["item-a", "item-b"]);
});

test("keyed async debounce reruns once when an item changes during save", async () => {
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  const debouncer = createKeyedAsyncDebounce(async () => {
    calls += 1;
    if (calls === 1) await firstBlocked;
  }, 1);
  const running = debouncer.flush("item-a");
  debouncer.schedule("item-a");
  debouncer.schedule("item-a");
  releaseFirst();
  await running;
  assert.equal(calls, 2);
});

test("shared debounce enforces a maximum wait during continuous input", () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  let calls = 0;

  globalThis.setTimeout = ((callback: () => void, delay = 0) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    timers.delete(id as unknown as number);
  }) as typeof clearTimeout;

  try {
    const scope = effectScope();
    const debounced = scope.run(() =>
      useDebounce(
        () => {
          calls++;
        },
        700,
        2_500,
      ),
    )!;

    debounced.debouncedFunc();
    debounced.debouncedFunc();
    debounced.debouncedFunc();

    const maxWaitTimer = Array.from(timers.values()).find(
      (timer) => timer.delay === 2_500,
    );
    assert.ok(maxWaitTimer);
    assert.equal(calls, 0);

    maxWaitTimer.callback();
    assert.equal(calls, 1);
    assert.equal(timers.size, 0);
    scope.stop();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("offline outbox cancels dependent local children when its local workspace is deleted", async () => {
  const accountId = `account-${Date.now()}-cascade`;
  const parent = {
    id: `workspace-create-${accountId}`,
    entity: "workspace" as const,
    operation: "workspace.create",
    entityId: `local:workspace-${accountId}`,
    changedFields: ["title"],
    payload: { title: "Draft" },
    dependsOn: [],
    occurredAt: "2026-07-10T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({
    accountId,
    mutation: parent,
    localRecord: {
      entity: "workspace",
      entityId: parent.entityId,
      version: 0,
      data: { id: parent.entityId, title: "Draft" },
    },
  });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...parent,
      id: `material-create-${accountId}`,
      entity: "material",
      operation: "material.create",
      entityId: `local:material-${accountId}`,
      workspaceId: parent.entityId,
      changedFields: ["title", "content"],
      payload: {
        workspaceId: parent.entityId,
        title: "Child",
        content: "Local",
      },
      dependsOn: [parent.id],
      createdAt: parent.createdAt + 1,
    },
    localRecord: {
      entity: "material",
      entityId: `local:material-${accountId}`,
      workspaceId: parent.entityId,
      version: 0,
      data: {
        id: `local:material-${accountId}`,
        workspaceId: parent.entityId,
        title: "Child",
        content: "Local",
      },
    },
  });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...parent,
      id: `workspace-delete-${accountId}`,
      operation: "workspace.delete",
      changedFields: ["deleted"],
      payload: {},
      createdAt: parent.createdAt + 2,
    },
  });
  assert.equal((await listOfflineMutations(accountId)).length, 0);
});

test("cancelling a local parent restores dependent canonical projections", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const accountId = `account-dependent-rollback-${suffix}`;
  const columnId = `local:column-${suffix}`;
  const itemId = `item-${suffix}`;
  const columnCreate = {
    id: `column-create-${suffix}`,
    entity: "boardColumn" as const,
    operation: "boardColumn.create",
    entityId: columnId,
    workspaceId: "workspace-1",
    changedFields: ["name"],
    payload: { workspaceId: "workspace-1", name: "Draft" },
    dependsOn: [],
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({
    accountId,
    mutation: columnCreate,
    localRecord: {
      entity: "boardColumn",
      entityId: columnId,
      workspaceId: "workspace-1",
      version: 0,
      data: { id: columnId, workspaceId: "workspace-1", name: "Draft" },
    },
  });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...columnCreate,
      id: `item-update-${suffix}`,
      entity: "boardItem",
      operation: "boardItem.update",
      entityId: itemId,
      baseVersion: 4,
      changedFields: ["columnId"],
      payload: { columnId },
      rollbackData: {
        id: itemId,
        workspaceId: "workspace-1",
        columnId: "column-old",
        content: "Keep me",
      },
      dependsOn: [columnCreate.id],
      createdAt: columnCreate.createdAt + 1,
    },
    localRecord: {
      entity: "boardItem",
      entityId: itemId,
      workspaceId: "workspace-1",
      version: 4,
      data: {
        id: itemId,
        workspaceId: "workspace-1",
        columnId,
        content: "Keep me",
      },
    },
  });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...columnCreate,
      id: `column-delete-${suffix}`,
      operation: "boardColumn.delete",
      changedFields: ["deleted"],
      payload: {},
      createdAt: columnCreate.createdAt + 2,
    },
  });

  assert.equal((await listOfflineMutations(accountId)).length, 0);
  const restored = await getOfflineEntity<{
    columnId: string;
    content: string;
  }>(accountId, "boardItem", itemId);
  assert.equal(restored?.data.columnId, "column-old");
  assert.equal(restored?.data.content, "Keep me");
  assert.equal(restored?.version, 4);
});

test("offline id remap converts a create queued during in-flight creation into an update", async () => {
  const accountId = `account-${Date.now()}-inflight-create`;
  const tempId = createClientTempId("board-item");
  const original = {
    id: `create-${accountId}`,
    entity: "boardItem" as const,
    operation: "boardItem.create",
    entityId: tempId,
    workspaceId: "workspace-1",
    changedFields: ["content"],
    payload: { workspaceId: "workspace-1", content: "First" },
    dependsOn: [],
    occurredAt: "2026-07-12T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "syncing" as const,
    sequence: false,
  };
  await commitOfflineMutation({ accountId, mutation: original });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...original,
      id: `later-${accountId}`,
      payload: { workspaceId: "workspace-1", content: "Edited while syncing" },
      status: "pending",
      createdAt: original.createdAt + 1,
    },
  });

  await remapOfflineIds(
    accountId,
    { [tempId]: "server-board-item-1" },
    {
      serverVersion: 7,
      mutationId: original.id,
    },
  );

  const mutations = await listOfflineMutations(accountId);
  const acknowledged = mutations.find(
    (mutation) => mutation.id === original.id,
  );
  const later = mutations.find(
    (mutation) => mutation.id === `later-${accountId}`,
  );
  assert.equal(acknowledged?.operation, "boardItem.create");
  assert.equal(acknowledged?.entityId, "server-board-item-1");
  assert.equal(later?.operation, "boardItem.update");
  assert.equal(later?.entityId, "server-board-item-1");
  assert.equal(later?.baseVersion, 7);
});

test("offline outbox atomically claims the latest coalesced payload revision", async () => {
  const accountId = `account-${Date.now()}-atomic-claim`;
  const entityId = `board-item-${accountId}`;
  const original = {
    id: `first-${accountId}`,
    entity: "boardItem" as const,
    operation: "boardItem.update",
    entityId,
    changedFields: ["content"],
    payload: { content: "First" },
    dependsOn: [],
    occurredAt: "2026-07-13T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 3,
  };
  await commitOfflineMutation({ accountId, mutation: original });
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...original,
      id: `second-${accountId}`,
      payload: { content: "Latest" },
      createdAt: original.createdAt + 1,
    },
  });

  const claimed = await claimOfflineMutations({
    accountId,
    ids: [original.id],
    claimToken: `claim-${accountId}`,
  });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]?.payload.content, "Latest");
  assert.equal(claimed[0]?.localRevision, 2);
  assert.equal(claimed[0]?.status, "syncing");
});

test("a stale acknowledgement preserves and rebases a newer same-entity edit", async () => {
  const accountId = `account-${Date.now()}-stale-ack`;
  const entityId = `board-item-${accountId}`;
  const original = {
    id: `first-${accountId}`,
    entity: "boardItem" as const,
    operation: "boardItem.update",
    entityId,
    changedFields: ["content"],
    payload: { content: "Sent" },
    dependsOn: [],
    occurredAt: "2026-07-13T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 3,
  };
  await commitOfflineMutation({
    accountId,
    mutation: original,
    localRecord: {
      entity: "boardItem",
      entityId,
      version: 3,
      data: { id: entityId, content: "Sent" },
    },
  });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [original.id],
    claimToken: `claim-${accountId}`,
  });
  assert.ok(claimed);
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...original,
      id: `later-${accountId}`,
      payload: { content: "Newer" },
      createdAt: original.createdAt + 1,
    },
    localRecord: {
      entity: "boardItem",
      entityId,
      version: 3,
      data: { id: entityId, content: "Newer" },
    },
  });

  await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "applied",
      entity: "boardItem",
      entityId,
      version: 4,
      canonical: { id: entityId, content: "Sent" },
    },
  });

  const remaining = await listOfflineMutations(accountId);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.payload.content, "Newer");
  assert.equal(remaining[0]?.baseVersion, 4);
  const local = await getOfflineEntity<{ id: string; content: string }>(
    accountId,
    "boardItem",
    entityId,
  );
  assert.equal(local?.data.content, "Newer");
  assert.equal(local?.version, 4);
});

test("a related Board revision rebases pending item work without overwriting it", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const accountId = `account-related-${suffix}`;
  const workspaceId = `workspace-related-${suffix}`;
  const columnId = `column-related-${suffix}`;
  const itemId = `item-related-${suffix}`;
  const deleteMutation = {
    id: `delete-column-${suffix}`,
    entity: "boardColumn" as const,
    operation: "boardColumn.delete",
    entityId: columnId,
    workspaceId,
    baseVersion: 2,
    changedFields: ["deleted"],
    payload: {},
    dependsOn: [],
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({ accountId, mutation: deleteMutation });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [deleteMutation.id],
    claimToken: `claim-related-${suffix}`,
  });
  assert.ok(claimed);
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...deleteMutation,
      id: `edit-item-${suffix}`,
      entity: "boardItem",
      operation: "boardItem.update",
      entityId: itemId,
      baseVersion: 4,
      changedFields: ["content"],
      payload: { content: "Newer local text" },
      createdAt: deleteMutation.createdAt + 1,
      status: "pending",
    },
    localRecord: {
      entity: "boardItem",
      entityId: itemId,
      workspaceId,
      version: 4,
      data: {
        id: itemId,
        workspaceId,
        columnId,
        content: "Newer local text",
      },
    },
  });
  await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "applied",
      entity: "boardColumn",
      entityId: columnId,
      version: 3,
      canonical: { id: columnId, deleted: true },
      related: [
        {
          entity: "boardItem",
          entityId: itemId,
          version: 5,
          canonical: {
            id: itemId,
            workspaceId,
            columnId: null,
            content: "Server text",
          },
        },
      ],
    },
  });

  const remaining = await listOfflineMutations(accountId);
  const itemMutation = remaining.find(
    (mutation) => mutation.entityId === itemId,
  );
  assert.equal(itemMutation?.baseVersion, 5);
  const local = await getOfflineEntity<{ content: string }>(
    accountId,
    "boardItem",
    itemId,
  );
  assert.equal(local?.version, 5);
  assert.equal(local?.data.content, "Newer local text");
});

test("a related offline tombstone removes a cascaded language review", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const accountId = `account-language-delete-${suffix}`;
  const wordId = `word-language-delete-${suffix}`;
  const reviewId = `review-language-delete-${suffix}`;
  await putOfflineEntities([
    {
      id: `${accountId}:languageReview:${reviewId}`,
      accountId,
      entity: "languageReview",
      entityId: reviewId,
      version: 2,
      updatedAt: Date.now(),
      data: { id: reviewId, wordId, nextReviewAt: new Date().toISOString() },
    },
  ]);
  const mutation = {
    id: `delete-language-word-${suffix}`,
    entity: "languageWord" as const,
    operation: "languageWord.delete",
    entityId: wordId,
    baseVersion: 2,
    changedFields: ["deleted"],
    payload: {},
    dependsOn: [],
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({ accountId, mutation });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [mutation.id],
    claimToken: `claim-language-delete-${suffix}`,
  });
  assert.ok(claimed);

  await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "applied",
      entity: "languageWord",
      entityId: wordId,
      version: 3,
      canonical: { id: wordId, deleted: true },
      related: [
        {
          entity: "languageReview",
          entityId: reviewId,
          version: 3,
          canonical: { id: reviewId, deleted: true },
        },
      ],
    },
  });

  const visible = await listOfflineEntities(accountId, "languageReview");
  const tombstone = await getOfflineEntity(
    accountId,
    "languageReview",
    reviewId,
  );
  assert.equal(visible.length, 0);
  assert.equal(tombstone?.deleted, true);
});

test("a definitive V2 rejection restores the pre-command snapshot", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const accountId = `account-rollback-${suffix}`;
  const entityId = `note-rollback-${suffix}`;
  const mutationId = `mutation-rollback-${suffix}`;
  await commitOfflineMutation({
    accountId,
    mutation: {
      id: mutationId,
      entity: "note",
      operation: "note.update",
      entityId,
      workspaceId: "workspace-rollback",
      baseVersion: 3,
      changedFields: ["content"],
      payload: { content: "New" },
      rollbackData: {
        id: entityId,
        workspaceId: "workspace-rollback",
        content: "Old",
      },
      dependsOn: [],
      occurredAt: new Date().toISOString(),
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
      sequence: false,
    },
    localRecord: {
      entity: "note",
      entityId,
      workspaceId: "workspace-rollback",
      version: 3,
      data: { id: entityId, workspaceId: "workspace-rollback", content: "New" },
    },
  });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [mutationId],
    claimToken: "rollback-claim",
  });
  assert.ok(claimed);
  await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "rejected",
      entity: "note",
      entityId,
      message: "Invalid note",
    },
  });

  const restored = await getOfflineEntity<any>(accountId, "note", entityId);
  assert.equal(restored?.data.content, "Old");
  assert.equal(restored?.deleted, false);
  const [rejected] = await listOfflineMutations(accountId);
  assert.equal(rejected?.status, "rejected");
});

test("a live outbox lease cannot be stolen by recovery or a second sync owner", async () => {
  const accountId = `account-${Date.now()}-lease`;
  const mutation = {
    id: `material-${accountId}`,
    entity: "material" as const,
    operation: "material.update",
    entityId: `material-${accountId}`,
    changedFields: ["title"],
    payload: { title: "Draft" },
    dependsOn: [],
    occurredAt: "2026-07-13T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 1,
  };
  await commitOfflineMutation({ accountId, mutation });
  const first = await claimOfflineMutations({
    accountId,
    ids: [mutation.id],
    claimToken: `first-${accountId}`,
  });
  const second = await claimOfflineMutations({
    accountId,
    ids: [mutation.id],
    claimToken: `second-${accountId}`,
  });
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(await recoverInterruptedMutations(accountId), 0);
  assert.equal(
    (await listOfflineMutations(accountId))[0]?.claimToken,
    `first-${accountId}`,
  );
});

test("choosing the server conflict snapshot replaces local data atomically", async () => {
  const accountId = `account-${Date.now()}-conflict`;
  const mutation = {
    id: `workspace-update-${accountId}`,
    entity: "workspace" as const,
    operation: "workspace.update",
    entityId: `workspace-${accountId}`,
    changedFields: ["title"],
    payload: { title: "Mine" },
    dependsOn: [],
    occurredAt: "2026-07-10T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
    baseVersion: 1,
  };
  await commitOfflineMutation({
    accountId,
    mutation,
    localRecord: {
      entity: "workspace",
      entityId: mutation.entityId,
      version: 1,
      data: { id: mutation.entityId, title: "Mine" },
    },
  });
  await applySyncResult({
    accountId,
    mutation: { ...mutation, accountId, updatedAt: Date.now() },
    result: {
      status: "conflict",
      entity: "workspace",
      entityId: mutation.entityId,
      conflict: {
        serverVersion: 2,
        overlappingFields: ["title"],
        serverSnapshot: { id: mutation.entityId, title: "Server" },
        reason: "Same field",
      },
    },
  });
  await resolveOfflineConflict({
    accountId,
    mutationId: mutation.id,
    strategy: "keep-server",
  });
  const current = await getOfflineEntity<{ id: string; title: string }>(
    accountId,
    "workspace",
    mutation.entityId,
  );
  assert.equal(current?.data.title, "Server");
  assert.equal((await listOfflineMutations(accountId)).length, 0);
});

test("an interrupted sync is recovered and per-account sync metadata survives reload", async () => {
  const accountId = `account-${Date.now()}-recovery`;
  const mutation = {
    id: `material-${accountId}`,
    entity: "material" as const,
    operation: "material.create",
    entityId: `local:material-${accountId}`,
    workspaceId: `workspace-${accountId}`,
    changedFields: ["title", "content"],
    payload: {
      workspaceId: `workspace-${accountId}`,
      title: "Draft",
      content: "Offline",
    },
    dependsOn: [],
    occurredAt: "2026-07-10T00:00:00.000Z",
    createdAt: Date.now(),
    attempts: 0,
    status: "syncing" as const,
    sequence: false,
  };
  await commitOfflineMutation({
    accountId,
    mutation,
    localRecord: {
      entity: "material",
      entityId: mutation.entityId,
      workspaceId: mutation.workspaceId,
      version: 0,
      data: { id: mutation.entityId, ...mutation.payload },
    },
  });
  assert.equal(await recoverInterruptedMutations(accountId), 1);
  assert.equal((await listOfflineMutations(accountId))[0]?.status, "retry");
  await updateOfflineSyncMetadata(accountId, {
    lastAttemptAt: 10,
    lastSuccessfulSyncAt: 9,
  });
  const metadata = await getOfflineSyncMetadata(accountId);
  assert.equal(metadata?.accountId, accountId);
  assert.equal(metadata?.lastAttemptAt, 10);
  assert.equal(metadata?.lastSuccessfulSyncAt, 9);
});

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
  // Models the GradeRequest.requestId unique constraint so idempotency can be
  // exercised inside the same transaction as the schedule mutation.
  const claimedRequestIds = new Set<string>();
  const gradeRequest = {
    create: async ({ data }: any) => {
      if (claimedRequestIds.has(data.requestId)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      claimedRequestIds.add(data.requestId);
      return { id: `gr-${claimedRequestIds.size}`, ...data };
    },
  };
  return {
    gradeRequest,
    $transaction: async <T>(fn: (tx: any) => Promise<T>) =>
      fn({ gradeRequest }),
  };
}

function fakeNotesPrisma() {
  const notes = new Map<string, any>();
  const noteCollabDocuments = new Map<string, any>();
  const noteGroups = new Map<string, any>([
    [
      "group-1",
      { id: "group-1", workspaceId: "workspace-1", title: "Group 1", order: 0 },
    ],
  ]);
  let noteSequence = 1;
  let noteGroupSequence = 1;

  return {
    notes,
    noteCollabDocuments,
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
          if (where.workspaceId && group.workspaceId !== where.workspaceId)
            return null;
          return group;
        },
        findMany: async ({ where }: any) =>
          Array.from(noteGroups.values()).filter((group) => {
            if (where?.workspaceId && group.workspaceId !== where.workspaceId)
              return false;
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
            if (where?.workspaceId && note.workspaceId !== where.workspaceId)
              return false;
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
                : (data.version ?? existing.version),
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
      noteCollabDocument: {
        findUnique: async ({ where }: any) =>
          noteCollabDocuments.get(where.noteId) ?? null,
      },
      $transaction: async <T>(fn: (tx: any) => Promise<T>) =>
        fn({
          note: {
            updateMany: async ({ where, data }: any) => {
              for (const [id, existing] of notes) {
                if (
                  where.workspaceId &&
                  existing.workspaceId !== where.workspaceId
                )
                  continue;
                if (
                  where.groupId !== undefined &&
                  existing.groupId !== where.groupId
                )
                  continue;
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
                    : (data.version ?? existing.version),
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

function fakeSplitNotesState(
  input: {
    isSplit?: boolean;
    primaryNoteId?: string | null;
    secondaryNoteId?: string | null;
    secondaryPosition?: SplitPosition;
    activePane?: ActivePane;
  } = {},
) {
  const isSplit = ref(input.isSplit ?? false);
  const primaryNoteId = ref<string | null>(input.primaryNoteId ?? null);
  const secondaryNoteId = ref<string | null>(input.secondaryNoteId ?? null);
  const secondaryPosition = ref<SplitPosition>(
    input.secondaryPosition ?? "right",
  );
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
  return useSplitNotes(
    `unit-${Math.random().toString(36).slice(2)}`,
    () => new Set(validIds),
  );
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
  const notes = ref(
    new Map(initialNotes.map((note) => [note.id, { ...note }])),
  );
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
          transaction?.metadata?.[metadataKey] === metadataFilter.equals,
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
                      ? existing.generationsUsed +
                        data.generationsUsed.increment
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
                (item) => item.materialId === where.materialId,
              );
              for (const item of toDelete) flashcards.delete(item.id);
              return { count: toDelete.length };
            },
            create: async ({ data, select }: any) => {
              const id = `flashcard-${flashcardSequence++}`;
              const record = { id, ...data };
              flashcards.set(id, record);
              if (select?.id) return { id };
              return record;
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
                (item) => item.materialId === where.materialId,
              );
              for (const item of toDelete) questions.delete(item.id);
              return { count: toDelete.length };
            },
            create: async ({ data, select }: any) => {
              const id = `question-${questionSequence++}`;
              const record = { id, ...data };
              questions.set(id, record);
              if (select?.id) return { id };
              return record;
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
                  review.resourceType !== where.resourceType,
              );
              reviews.splice(0, reviews.length, ...filtered);
              return { count: before - reviews.length };
            },
            createMany: async ({ data }: any) => {
              reviews.push(...data);
              return { count: data.length };
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
          return workspace && workspace.userId === where.userId
            ? workspace
            : null;
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

test("review grade labels use one canonical SM-2 mapping", () => {
  assert.deepEqual(REVIEW_GRADE_BY_KEY, {
    again: "1",
    hard: "3",
    good: "4",
    easy: "5",
  });
  assert.equal(reviewGradeForKey("again"), REVIEW_GRADE_BY_KEY.again);
  assert.equal(reviewGradeForKey("hard"), REVIEW_GRADE_BY_KEY.hard);
  assert.equal(reviewGradeForKey("good"), REVIEW_GRADE_BY_KEY.good);
  assert.equal(reviewGradeForKey("easy"), REVIEW_GRADE_BY_KEY.easy);
});

test("review interval previews match the schedule committed by shared SM-2", () => {
  const state = {
    easeFactor: 2.3,
    intervalDays: 12,
    repetitions: 4,
  };

  for (const key of Object.keys(REVIEW_GRADE_BY_KEY) as Array<
    keyof typeof REVIEW_GRADE_BY_KEY
  >) {
    const committed = calculateSM2({
      currentEF: state.easeFactor,
      currentInterval: state.intervalDays,
      currentRepetitions: state.repetitions,
      grade: Number(REVIEW_GRADE_BY_KEY[key]),
    });
    assert.equal(
      projectOfflineReviewInterval(
        {
          currentEF: state.easeFactor,
          currentInterval: state.intervalDays,
          currentRepetitions: state.repetitions,
        },
        key,
      ),
      committed.intervalDays,
    );
  }
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

test("shared review grading is idempotent for a repeated requestId", async () => {
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
  const prisma = fakePrismaForReview();
  const args = {
    prisma,
    repository,
    xpPort: new FakeXpPort(),
    userId: "user-1",
    cardId: "review-1",
    grade: 4,
    requestId: "request-1",
    xpSource: "review",
  } as const;

  const first = await gradeReviewCard({ ...args });
  const second = await gradeReviewCard({ ...args });

  // First call applies the grade and awards XP.
  assert.equal(first.xpEarned, 7);
  // Replay returns persisted state with no extra XP...
  assert.equal(second.xpEarned, 0);
  // ...and the SM-2 mutation ran exactly once (repetitions did not advance twice).
  assert.equal(repository.record?.repetitions, 1);
});

test("shared review grading retries closed transaction writes", async () => {
  assert.equal(
    isRetryableReviewGradeError(
      new Error(
        "Transaction API error: Transaction already closed: Could not perform operation.",
      ),
    ),
    true,
  );

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
  let xpAwards = 0;
  const xpPort: XpPort = {
    async awardReviewXp() {
      xpAwards++;
      return 7;
    },
    async awardEnrollXp() {
      return 3;
    },
  };
  const claimedRequestIds = new Set<string>();
  let creates = 0;
  let transactions = 0;
  const gradeRequest = {
    create: async ({ data }: any) => {
      creates++;
      if (claimedRequestIds.has(data.requestId)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      claimedRequestIds.add(data.requestId);
      return { id: `gr-${creates}`, ...data };
    },
  };
  const prisma = {
    gradeRequest,
    $transaction: async <T>(fn: (tx: any) => Promise<T>) => {
      transactions++;
      if (transactions === 1) {
        throw new Error(
          "Transaction API error: Transaction already closed: Could not perform operation.",
        );
      }
      return fn({ gradeRequest });
    },
  };

  const result = await gradeReviewCard({
    prisma,
    repository,
    xpPort,
    userId: "user-1",
    cardId: "review-1",
    grade: 4,
    requestId: "request-retry-1",
    xpSource: "review",
    attempts: 2,
  });

  assert.equal(result.xpEarned, 7);
  assert.equal(repository.record?.repetitions, 1);
  assert.equal(xpAwards, 1);
  assert.equal(transactions, 2);
  assert.equal(creates, 1);
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
  assert.deepEqual(result.appliedNotes, [
    {
      id: "temp-note-1",
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(notes.get("server-note-1")?.title, "Draft title");
  assert.deepEqual(result.conflicts, []);
});

test("workspace note sync replays temp creates without duplicate server rows", async () => {
  const { notes, noteGroups, prisma } = fakeNotesPrisma();
  const receipts = new Map<string, any>();
  prisma.offlineMutationReceipt = {
    findUnique: async ({ where }: any) =>
      receipts.get(
        `${where.userId_mutationId.userId}:${where.userId_mutationId.mutationId}`,
      ) ?? null,
    create: async ({ data }: any) => {
      const key = `${data.userId}:${data.mutationId}`;
      if (receipts.has(key)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      const row = { id: `receipt-${receipts.size + 1}`, ...data };
      receipts.set(key, row);
      return row;
    },
  };
  prisma.$transaction = async <T>(fn: (tx: any) => Promise<T>) => fn(prisma);
  const request = {
    groupChanges: [
      {
        id: "temp-group-retry",
        operation: "create" as const,
        workspaceId: "workspace-1",
        title: "Retry group",
        order: 1,
        updatedAt: 100,
        localVersion: 1,
      },
    ],
    changes: [
      {
        id: "temp-note-retry",
        operation: "upsert" as const,
        updatedAt: 100,
        localVersion: 1,
        workspaceId: "workspace-1",
        groupId: "temp-group-retry",
        title: "Retry note",
        content: "<h1>Retry note</h1>",
      },
    ],
  };

  const first = await syncWorkspaceNotes({ prisma, userId: "user-1", request });
  const second = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request,
  });

  assert.equal(notes.size, 1);
  assert.equal(noteGroups.size, 2);
  assert.equal(second.idMap["temp-note-retry"], first.idMap["temp-note-retry"]);
  assert.equal(
    second.groupIdMap["temp-group-retry"],
    first.groupIdMap["temp-group-retry"],
  );
  assert.deepEqual(second.replayedCreates, ["temp-note-retry"]);
  assert.deepEqual(second.replayedGroupCreates, ["temp-group-retry"]);
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

test("workspace note sync reports delete conflicts for newer collaborative body edits", async () => {
  const { notes, noteCollabDocuments, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Server note",
    content: "Server body",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    version: 1,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  noteCollabDocuments.set("note-1", {
    noteId: "note-1",
    workspaceId: "workspace-1",
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  });

  const result = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request: {
      changes: [
        {
          id: "note-1",
          operation: "delete",
          updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
          localVersion: 1,
          serverVersion: 1,
        },
      ],
    },
  });

  assert.deepEqual(result.applied, []);
  assert.equal(result.conflicts[0]?.reason, "DELETE_REMOTE_BODY_EDIT");
  assert.equal(notes.has("note-1"), true);
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
  assert.deepEqual(result.conflicts, [
    {
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
    },
  ]);
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

test("workspace note sync acknowledges an identical retry after a lost response", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-retry", {
    id: "note-retry",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Before",
    content: "<h1>Before</h1>",
    tags: ["study"],
    noteType: "TEXT",
    metadata: { color: "blue", nested: { b: 2, a: 1 } },
    version: 1,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const request = {
    changes: [
      {
        id: "note-retry",
        operation: "upsert" as const,
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        serverVersion: 1,
        workspaceId: "workspace-1",
        groupId: null,
        title: "After",
        content: "<h1>After</h1>",
        tags: ["study"],
        noteType: "TEXT",
        metadata: { nested: { a: 1, b: 2 }, color: "blue" },
      },
    ],
  };

  const first = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request,
  });
  const replay = await syncWorkspaceNotes({
    prisma,
    userId: "user-1",
    request,
  });

  assert.deepEqual(first.conflicts, []);
  assert.equal(first.appliedNotes[0]?.version, 2);
  assert.deepEqual(replay.conflicts, []);
  assert.deepEqual(replay.applied, ["note-retry"]);
  assert.equal(replay.appliedNotes[0]?.version, 2);
  assert.equal(notes.get("note-retry")?.version, 2);
});

test("workspace note processing failures stay retryable instead of becoming conflicts", async () => {
  const { notes, prisma } = fakeNotesPrisma();
  notes.set("note-1", {
    id: "note-1",
    workspaceId: "workspace-1",
    title: "First",
    content: "<h1>First</h1>",
    tags: [],
    noteType: "TEXT",
    metadata: null,
    version: 1,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  prisma.note.update = async () => {
    throw new Error("temporary database failure");
  };

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
          content: "<h1>Second</h1>",
        },
      ],
    },
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.errors[0]?.scope, "content");
  assert.equal(result.errors[0]?.id, "note-1");
});

test("notes sync coordinator stores fresh applied note versions locally", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
    ]),
  );
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
    appliedNotes: [
      {
        id: "note-1",
        version: 2,
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
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

test("notes sync coordinator advances memory version while retaining a newer edit", async () => {
  const sent = {
    id: "note-retained-version",
    operation: "upsert" as const,
    updatedAt: 100,
    localVersion: 1,
    serverVersion: 1,
    workspaceId: "workspace-1",
    title: "First",
    content: "<h1>First</h1>",
  };
  const newer = {
    ...sent,
    updatedAt: 200,
    localVersion: 2,
    title: "Second",
    content: "<h1>Second</h1>",
  };
  const notes = ref(
    new Map<string, any>([
      [
        sent.id,
        {
          ...newer,
          groupId: null,
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
        },
      ],
    ]),
  );
  const coordinator = createNotesSyncCoordinator({
    workspaceId: "workspace-1",
    notes,
    localRepository: {
      save: async () => {},
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
    layoutQueue: {
      load: async () => null,
      save: async () => {},
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    pendingQueue: {
      add: async () => {},
      load: async () => [newer],
      remove: async () => {},
      acknowledge: async (_sent: any, acknowledgement: any) => ({
        ...newer,
        serverVersion: acknowledgement.serverVersion,
      }),
      registerBackgroundSync: async () => {},
    } as any,
  });

  await coordinator.applySyncResult(
    {
      ...notesSyncSuccess().data,
      applied: [sent.id],
      appliedNotes: [{ id: sent.id, version: 2 }],
    },
    [sent],
  );

  assert.equal(notes.value.get(sent.id)?.version, 2);
  assert.equal(notes.value.get(sent.id)?.content, newer.content);
  assert.equal(notes.value.get(sent.id)?.isDirty, true);
});

test("notes sync coordinator leaves version conflicts to resolver", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
    ]),
  );
  const pending = new Map<string, any>([
    [
      "note-1",
      {
        id: "note-1",
        operation: "upsert",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        serverVersion: 1,
        workspaceId: "workspace-1",
        content: "<h1>Local</h1>",
      },
    ],
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
    conflicts: [
      {
        id: "note-1",
        reason: "VERSION_MISMATCH",
        resolution: "RETRY_LOCAL_WINS",
        serverVersion: 2,
        clientServerVersion: 1,
      },
    ],
    idMap: {},
    noteIdMap: {},
    groupApplied: [],
    groupConflicts: [],
    groupIdMap: {},
    errors: [],
    layoutApplied: false,
    layoutConflict: false,
  });

  assert.equal(notes.value.get("note-1")?.version, 1);
  assert.equal(saved.has("note-1"), false);
  assert.equal(pending.get("note-1")?.serverVersion, 1);
  assert.equal(notes.value.get("note-1")?.isDirty, true);
});

test("notes sync coordinator remaps a newer temp edit instead of acknowledging it away", async () => {
  const tempId = "temp-note-race";
  const serverId = "server-note-race";
  const sent = {
    id: tempId,
    operation: "upsert",
    updatedAt: 100,
    localVersion: 1,
    workspaceId: "workspace-1",
    title: "First",
    content: "<h1>First</h1>",
    tags: [],
    noteType: "TEXT",
    order: 0,
  } as any;
  const newer = {
    ...sent,
    updatedAt: 200,
    localVersion: 2,
    title: "Newer",
    content: "<h1>Newer</h1>",
  };
  const note = {
    ...newer,
    groupId: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: true,
    isLoading: false,
    error: null,
  };
  const notes = ref(new Map<string, any>([[tempId, note]]));
  const pending = new Map<string, any>([[tempId, newer]]);
  const saved = new Map<string, any>([[tempId, note]]);
  const coordinator = createNotesSyncCoordinator({
    workspaceId: "workspace-1",
    notes,
    localRepository: {
      save: async (value: any) => {
        saved.set(value.id, value);
      },
      saveMany: async () => {},
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
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    } as any,
  });

  await coordinator.applySyncResult(
    {
      ...notesSyncSuccess().data,
      applied: [tempId],
      appliedNotes: [{ id: tempId, version: 2 }],
      idMap: { [tempId]: serverId },
      noteIdMap: { [tempId]: serverId },
    },
    [sent],
  );

  assert.equal(notes.value.has(tempId), false);
  assert.equal(notes.value.get(serverId)?.content, newer.content);
  assert.equal(notes.value.get(serverId)?.isDirty, true);
  assert.equal(pending.has(tempId), false);
  assert.equal(pending.get(serverId)?.operation, "upsert");
  assert.equal(pending.get(serverId)?.serverVersion, 2);
  assert.equal(saved.has(tempId), false);
  assert.equal(saved.get(serverId)?.isDirty, true);
});

test("notes outbox acknowledgement atomically remaps a newer temp revision", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const workspaceId = `workspace-note-ack-${suffix}`;
  const tempId = `temp-note-ack-${suffix}`;
  const serverId = `server-note-ack-${suffix}`;
  const sent = {
    id: tempId,
    operation: "upsert" as const,
    updatedAt: 100,
    localVersion: 1,
    workspaceId,
    title: "F",
    content: "<h1>F</h1>",
  };

  await queueNoteChange(sent);
  const actualSent = (await loadPendingNoteChanges(workspaceId))[0]!;
  await queueNoteChange({
    ...actualSent,
    updatedAt: 200,
    title: "FIX",
    content: "<h1>FIX</h1>",
  });

  const retained = await acknowledgePendingNoteChange(actualSent, {
    remapToId: serverId,
    serverVersion: 2,
  });
  const remaining = await loadPendingNoteChanges(workspaceId);

  assert.equal(retained?.id, serverId);
  assert.equal(retained?.title, "FIX");
  assert.equal(
    remaining.some((change) => change.id === tempId),
    false,
  );
  assert.equal(
    remaining.find((change) => change.id === serverId)?.content,
    "<h1>FIX</h1>",
  );
  assert.equal(
    remaining.find((change) => change.id === serverId)?.serverVersion,
    2,
  );
  await deletePendingNoteChanges([tempId, serverId]);
});

test("notes delete acknowledgement removes the outbox and cache row atomically", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const workspaceId = `workspace-note-delete-atomic-${suffix}`;
  const noteId = `note-delete-atomic-${suffix}`;
  const note = {
    id: noteId,
    workspaceId,
    groupId: null,
    title: "Delete atomically",
    content: "<h1>Delete atomically</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT" as const,
    metadata: undefined,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    isLoading: false,
    error: null,
  };
  await saveNoteToIndexedDB(note);
  await queueNoteChange({
    id: noteId,
    operation: "delete",
    updatedAt: Date.now(),
    localVersion: 1,
    serverVersion: 3,
    workspaceId,
    rollbackData: note,
  });
  const sent = (await loadPendingNoteChanges(workspaceId))[0]!;

  await acknowledgePendingNoteChange(sent, {
    localMutation: { type: "delete", id: noteId },
  });

  assert.equal((await loadPendingNoteChanges(workspaceId)).length, 0);
  assert.equal((await loadNotesFromIndexedDB(workspaceId)).length, 0);
});

test("notes outbox keeps the freshest server base and advances cache atomically", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const workspaceId = `workspace-note-version-chain-${suffix}`;
  const noteId = `note-version-chain-${suffix}`;
  const note = {
    id: noteId,
    workspaceId,
    groupId: null,
    title: "First",
    content: "<h1>First</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT" as const,
    metadata: undefined,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: true,
    isLoading: false,
    error: null,
  };
  await saveNoteToIndexedDB(note);
  await queueNoteChange({
    id: noteId,
    operation: "upsert",
    updatedAt: 100,
    localVersion: 1,
    serverVersion: 1,
    workspaceId,
    title: note.title,
    content: note.content,
  });
  const sent = (await loadPendingNoteChanges(workspaceId))[0]!;
  await queueNoteChange({
    ...sent,
    updatedAt: 200,
    serverVersion: 2,
    title: "Second",
    content: "<h1>Second</h1>",
  });
  await queueNoteChange({
    ...sent,
    updatedAt: 300,
    serverVersion: 1,
    title: "Third",
    content: "<h1>Third</h1>",
  });

  const beforeAck = (await loadPendingNoteChanges(workspaceId))[0]!;
  assert.equal(beforeAck.serverVersion, 2);
  const retained = await acknowledgePendingNoteChange(sent, {
    serverVersion: 2,
    localMutation: {
      type: "advance",
      id: noteId,
      serverVersion: 2,
    },
  });
  const cached = (await loadNotesFromIndexedDB(workspaceId))[0]!;

  assert.equal(retained?.serverVersion, 2);
  assert.equal(cached.version, 2);
  assert.equal(cached.isDirty, true);
  await deletePendingNoteChanges([noteId]);
  await deleteNoteFromIndexedDB(noteId);
});

test("notes server projection purges stale rows and preserves current outbox work", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const workspaceId = `workspace-note-projection-${suffix}`;
  const makeNote = (id: string, title: string, isDirty = false) => ({
    id,
    workspaceId,
    groupId: null,
    title,
    content: `<h1>${title}</h1>`,
    tags: [],
    order: 0,
    noteType: "TEXT" as const,
    metadata: undefined,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty,
    isLoading: false,
    error: null,
  });
  const stale = makeNote(`stale-${suffix}`, "Stale local row");
  const pendingUpsert = makeNote(
    `temp-pending-${suffix}`,
    "Pending local create",
    true,
  );
  const pendingDelete = makeNote(`delete-${suffix}`, "Pending delete", true);
  const serverNote = makeNote(`server-${suffix}`, "Canonical server row");
  await Promise.all([
    saveNoteToIndexedDB(stale),
    saveNoteToIndexedDB(pendingUpsert),
    saveNoteToIndexedDB(pendingDelete),
  ]);
  await queueNoteChange({
    id: pendingUpsert.id,
    operation: "upsert",
    updatedAt: Date.now(),
    localVersion: 1,
    workspaceId,
    title: pendingUpsert.title,
    content: pendingUpsert.content,
    tags: [],
    noteType: "TEXT",
    order: 0,
  });
  await queueNoteChange({
    id: pendingDelete.id,
    operation: "delete",
    updatedAt: Date.now(),
    localVersion: 1,
    serverVersion: 1,
    workspaceId,
    rollbackData: pendingDelete,
  });

  const projection = await reconcileNotesWorkspaceProjection(workspaceId, [
    serverNote,
    pendingDelete,
  ]);
  const ids = new Set(projection.map((note) => note.id));
  const storedIds = new Set(
    (await loadNotesFromIndexedDB(workspaceId)).map((note) => note.id),
  );

  assert.deepEqual(ids, new Set([serverNote.id, pendingUpsert.id]));
  assert.deepEqual(storedIds, ids);
  assert.equal(
    projection.find((note) => note.id === pendingUpsert.id)?.isDirty,
    true,
  );

  await deletePendingNoteChanges([pendingUpsert.id, pendingDelete.id]);
  await reconcileNotesWorkspaceProjection(workspaceId, []);
});

test("a stale temp editor save resolves to the canonical id behind acknowledgement", async () => {
  const workspaceId = "workspace-temp-save-after-ack";
  const tempId = "temp-save-after-ack";
  const serverId = "server-save-after-ack";
  const sent = {
    id: tempId,
    operation: "upsert",
    updatedAt: 100,
    localVersion: 1,
    workspaceId,
    title: "F",
    content: "<h1>F</h1>",
  } as any;
  const tempNote = {
    ...sent,
    groupId: null,
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
  };
  const notes = ref(new Map<string, any>([[tempId, tempNote]]));
  const pending = new Map<string, any>([[tempId, sent]]);
  const saved = new Map<string, any>([[tempId, tempNote]]);
  const aliases = new Map<string, string>();
  let releaseCanonicalSave: (() => void) | null = null;
  const canonicalSaveGate = new Promise<void>((resolve) => {
    releaseCanonicalSave = resolve;
  });
  let canonicalSaveStarted = false;
  const localRepository = {
    save: async (value: any) => {
      if (value.id === serverId && !canonicalSaveStarted) {
        canonicalSaveStarted = true;
        await canonicalSaveGate;
      }
      saved.set(value.id, value);
    },
    saveMany: async () => {},
    delete: async (id: string) => {
      saved.delete(id);
    },
    loadByWorkspace: async () => Array.from(saved.values()),
  } as any;
  const pendingQueue = {
    add: async (change: any) => pending.set(change.id, change),
    load: async () => Array.from(pending.values()),
    remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
    registerBackgroundSync: async () => {},
  } as any;
  const coordinator = createNotesSyncCoordinator({
    workspaceId,
    notes,
    localRepository,
    layoutQueue: {
      load: async () => null,
      save: async () => {},
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    pendingQueue,
    onNoteIdRemapped: (from, to) => aliases.set(from, to),
  });
  const service = createNotesCommandService({
    memoryStore: createNotesMemoryStore(notes as any),
    localRepository,
    pendingQueue,
    registerBackgroundSync: async () => {},
    requestSync: () => {},
    resolveNoteId: (id) => aliases.get(id) ?? id,
  });

  const acknowledgement = coordinator.applySyncResult(
    {
      ...notesSyncSuccess().data,
      applied: [tempId],
      appliedNotes: [{ id: tempId, version: 2 }],
      idMap: { [tempId]: serverId },
      noteIdMap: { [tempId]: serverId },
    },
    [sent],
  );
  while (!canonicalSaveStarted) await flushAsyncWork();

  const staleEditorSave = service.updateNoteContent({
    id: tempId,
    note: {
      ...tempNote,
      title: "FIX",
      content: "<h1>FIX</h1>",
    },
    queueContentSave: async (id, content, title) => {
      pending.set(id, {
        ...sent,
        id,
        title,
        content,
        localVersion: 2,
        serverVersion: 2,
      });
      return true;
    },
  });
  releaseCanonicalSave?.();
  await Promise.all([acknowledgement, staleEditorSave]);

  assert.equal(notes.value.has(tempId), false);
  assert.equal(notes.value.get(serverId)?.title, "FIX");
  assert.equal(saved.has(tempId), false);
  assert.equal(saved.get(serverId)?.content, "<h1>FIX</h1>");
  assert.equal(pending.has(tempId), false);
  assert.equal(pending.get(serverId)?.title, "FIX");
});

test("notes sync coordinator purges an acknowledged delete and restores a conflicted delete", async () => {
  const note = {
    id: "note-delete-ack",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Keep until ack",
    content: "<h1>Keep until ack</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    metadata: null,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    isLoading: false,
    error: null,
  };
  const makeDelete = (id: string) =>
    ({
      id,
      operation: "delete",
      updatedAt: 100,
      localVersion: 1,
      serverVersion: 3,
      workspaceId: "workspace-1",
      rollbackData: { ...note, id },
    }) as any;
  const pending = new Map<string, any>();
  const saved = new Map<string, any>();
  const notes = ref(new Map<string, any>());
  const coordinator = createNotesSyncCoordinator({
    workspaceId: "workspace-1",
    notes,
    localRepository: {
      save: async (value: any) => {
        saved.set(value.id, value);
      },
      saveMany: async () => {},
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
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    } as any,
  });

  const acknowledged = makeDelete("note-delete-ack");
  pending.set(acknowledged.id, acknowledged);
  saved.set(acknowledged.id, note);
  await coordinator.applySyncResult(
    {
      ...notesSyncSuccess().data,
      applied: [acknowledged.id],
    },
    [acknowledged],
  );
  assert.equal(pending.has(acknowledged.id), false);
  assert.equal(saved.has(acknowledged.id), false);

  const conflicted = makeDelete("note-delete-conflict");
  pending.set(conflicted.id, conflicted);
  await coordinator.applySyncResult(
    {
      ...notesSyncSuccess().data,
      conflicts: [
        { id: conflicted.id, reason: "VERSION_MISMATCH", serverVersion: 4 },
      ],
    },
    [conflicted],
  );
  assert.equal(notes.value.get(conflicted.id)?.content, note.content);
  assert.equal(notes.value.get(conflicted.id)?.isDirty, true);
  assert.equal(saved.has(conflicted.id), true);
  assert.equal(pending.has(conflicted.id), true);
});

test("notes conflict resolver stores local and server snapshots and blocks resend", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
    ]),
  );
  const pending = new Map<string, any>([
    [
      "note-1",
      {
        id: "note-1",
        operation: "upsert",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        serverVersion: 1,
        workspaceId: "workspace-1",
        content: "<h1>Local</h1>",
      },
    ],
  ]);
  const conflicts = new Map<string, any>();
  const conflictState = ref(new Map<string, any>());
  const saved = new Map<string, any>();
  const resolver = createNotesConflictResolver({
    workspaceId: "workspace-1",
    notes,
    conflicts: conflictState,
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
    conflicts: [
      {
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
      },
    ],
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
  assert.equal(conflictState.value.get("note-1")?.serverVersion, 2);
  assert.equal(pending.get("note-1")?.conflicted, true);
  assert.equal(
    notes.value.get("note-1")?.error?.includes("Sync conflict detected"),
    true,
  );
  assert.equal(saved.get("note-1")?.version, 2);
});

test("notes conflict resolver clears a replay conflict when both sides already match", async () => {
  const localNote = {
    id: "note-replay",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Converged",
    content: "<h1>Converged</h1><p>Body</p>",
    tags: ["study"],
    order: 0,
    noteType: "TEXT",
    metadata: { color: "blue" },
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    isDirty: true,
    isLoading: true,
    error: null,
  };
  const notes = ref(new Map<string, any>([[localNote.id, localNote]]));
  const pending = new Map<string, any>([
    [
      localNote.id,
      {
        id: localNote.id,
        operation: "upsert",
        updatedAt: localNote.updatedAt.getTime(),
        localVersion: 1,
        serverVersion: 1,
        workspaceId: localNote.workspaceId,
        groupId: null,
        title: localNote.title,
        content: localNote.content,
        tags: localNote.tags,
        noteType: localNote.noteType,
        metadata: localNote.metadata,
      },
    ],
  ]);
  const storedConflicts = new Map<string, any>();
  const conflictState = ref(new Map<string, any>());
  const saved = new Map<string, any>();
  const resolver = createNotesConflictResolver({
    workspaceId: "workspace-1",
    notes,
    conflicts: conflictState,
    conflictRepository: {
      save: async (conflict: any) => storedConflicts.set(conflict.id, conflict),
      load: async () => Array.from(storedConflicts.values()),
      remove: async (ids: string[]) =>
        ids.forEach((id) => storedConflicts.delete(id)),
    } as any,
    pendingQueue: {
      add: async (change: any) => pending.set(change.id, change),
      load: async () => Array.from(pending.values()),
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    } as any,
    localRepository: {
      save: async (note: any) => saved.set(note.id, note),
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
  });

  const recorded = await resolver.recordContentConflicts({
    ...notesSyncSuccess().data,
    conflicts: [
      {
        id: localNote.id,
        reason: "VERSION_MISMATCH",
        serverVersion: 2,
        clientServerVersion: 1,
        serverSnapshot: {
          id: localNote.id,
          workspaceId: localNote.workspaceId,
          groupId: null,
          title: localNote.title,
          content: localNote.content,
          tags: localNote.tags,
          noteType: localNote.noteType,
          metadata: localNote.metadata,
          version: 2,
          updatedAt: "2026-01-03T00:00:00.000Z",
        },
      },
    ],
  });

  assert.equal(recorded, 0);
  assert.equal(pending.has(localNote.id), false);
  assert.equal(storedConflicts.size, 0);
  assert.equal(conflictState.value.size, 0);
  assert.equal(notes.value.get(localNote.id)?.version, 2);
  assert.equal(notes.value.get(localNote.id)?.isDirty, false);
  assert.equal(saved.get(localNote.id)?.error, null);
});

test("notes conflict resolver keep-local queues overwrite against latest server version", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
          id: "note-1",
          workspaceId: "workspace-1",
          title: "Local",
          content: "<h1>Local</h1>",
          tags: [],
          order: 0,
          noteType: "TEXT",
          metadata: null,
          version: 2,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          isDirty: true,
          isLoading: false,
          error:
            "Sync conflict detected. Resolve local and server versions before syncing this note.",
        },
      ],
    ]),
  );
  const pending = new Map<string, any>([
    [
      "note-1",
      {
        id: "note-1",
        operation: "upsert",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        serverVersion: 2,
        workspaceId: "workspace-1",
        title: "Local",
        content: "<h1>Local</h1>",
        conflicted: true,
      },
    ],
  ]);
  const storedConflicts = new Map<string, any>([
    [
      "workspace-1:content:note-1",
      {
        id: "workspace-1:content:note-1",
        workspaceId: "workspace-1",
        scope: "content",
        entityId: "note-1",
        reason: "VERSION_MISMATCH",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        localSnapshot: pending.get("note-1"),
        serverSnapshot: {
          id: "note-1",
          workspaceId: "workspace-1",
          content: "<h1>Server</h1>",
          version: 2,
        },
        serverVersion: 2,
        clientServerVersion: 1,
      },
    ],
  ]);
  const conflictState = ref(
    new Map<string, any>([
      ["note-1", storedConflicts.get("workspace-1:content:note-1")],
    ]),
  );
  const saved = new Map<string, any>();
  const resolver = createNotesConflictResolver({
    workspaceId: "workspace-1",
    notes,
    conflicts: conflictState,
    conflictRepository: {
      save: async (conflict: any) => storedConflicts.set(conflict.id, conflict),
      load: async () => Array.from(storedConflicts.values()),
      remove: async (ids: string[]) =>
        ids.forEach((id) => storedConflicts.delete(id)),
    } as any,
    pendingQueue: {
      add: async (change: any) => pending.set(change.id, change),
      load: async () => Array.from(pending.values()),
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    } as any,
    localRepository: {
      save: async (note: any) => saved.set(note.id, note),
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
  });

  const resolved = await resolver.resolveContentConflict(
    "note-1",
    "keep-local",
  );

  assert.equal(resolved, true);
  assert.equal(pending.get("note-1")?.conflicted, false);
  assert.equal(pending.get("note-1")?.serverVersion, 2);
  assert.equal(pending.get("note-1")?.content, "<h1>Local</h1>");
  assert.equal(conflictState.value.has("note-1"), false);
  assert.equal(storedConflicts.size, 0);
  assert.equal(saved.get("note-1")?.error, null);
});

test("notes conflict resolver keep-server drops pending local change", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
          isLoading: false,
          error:
            "Sync conflict detected. Resolve local and server versions before syncing this note.",
        },
      ],
    ]),
  );
  const pending = new Map<string, any>([
    [
      "note-1",
      {
        id: "note-1",
        operation: "upsert",
        workspaceId: "workspace-1",
        conflicted: true,
      },
    ],
  ]);
  const conflictRecord = {
    id: "workspace-1:content:note-1",
    workspaceId: "workspace-1",
    scope: "content",
    entityId: "note-1",
    reason: "VERSION_MISMATCH",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    localSnapshot: pending.get("note-1"),
    serverSnapshot: {
      id: "note-1",
      workspaceId: "workspace-1",
      title: "Server",
      content: "<h1>Server</h1>",
      tags: ["remote"],
      version: 3,
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
    serverVersion: 3,
    clientServerVersion: 1,
  };
  const storedConflicts = new Map<string, any>([
    [conflictRecord.id, conflictRecord],
  ]);
  const conflictState = ref(new Map<string, any>([["note-1", conflictRecord]]));
  const saved = new Map<string, any>();
  const resolver = createNotesConflictResolver({
    workspaceId: "workspace-1",
    notes,
    conflicts: conflictState,
    conflictRepository: {
      save: async (conflict: any) => storedConflicts.set(conflict.id, conflict),
      load: async () => Array.from(storedConflicts.values()),
      remove: async (ids: string[]) =>
        ids.forEach((id) => storedConflicts.delete(id)),
    } as any,
    pendingQueue: {
      add: async (change: any) => pending.set(change.id, change),
      load: async () => Array.from(pending.values()),
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    } as any,
    localRepository: {
      save: async (note: any) => saved.set(note.id, note),
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
  });

  const resolved = await resolver.resolveContentConflict(
    "note-1",
    "keep-server",
  );

  assert.equal(resolved, true);
  assert.equal(pending.has("note-1"), false);
  assert.equal(notes.value.get("note-1")?.content, "<h1>Server</h1>");
  assert.equal(notes.value.get("note-1")?.isDirty, false);
  assert.equal(conflictState.value.has("note-1"), false);
  assert.equal(saved.get("note-1")?.version, 3);
});

test("workspace note normalization uses the default empty template", () => {
  assert.equal(normalizeWorkspaceNoteContent(""), DEFAULT_WORKSPACE_NOTE_HTML);
  assert.equal(
    normalizeWorkspaceNoteContent(undefined),
    DEFAULT_WORKSPACE_NOTE_HTML,
  );
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
    normalizeWorkspaceNoteContent(
      "<h1>A</h1><p>Sss</p><p>s</p><p><br></p><p>a</p><p>s</p><p>a</p><p>s</p>",
    ),
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
  assert.equal(
    extractWorkspaceNoteTitle("<h1></h1><p>Body</p>"),
    TITLE_FALLBACK,
  );
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
    normalizeWorkspaceNoteTitle(
      "  Explicit Title  ",
      "<h1>Ignored</h1><p>Body</p>",
    ),
    "Explicit Title",
  );
  assert.equal(
    normalizeWorkspaceNoteTitle(undefined, "<h1>Derived Title</h1><p>Body</p>"),
    "Derived Title",
  );
  assert.equal(
    normalizeWorkspaceNoteTitle("", "<p>No heading</p>"),
    TITLE_FALLBACK,
  );
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
  assert.deepEqual(
    reordered.groupOrders.map((group) => group.id),
    ["group-2", "group-1"],
  );
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
  const commit = buildWorkspaceTextDraftCommit(
    "<h2>Draft Title</h2><p>Body</p>",
  );

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
    resolveEditorSaveState({
      hasLocalDraft: true,
      error: "Server rejected update",
    }),
    "conflict",
  );
  assert.equal(
    resolveEditorSaveState({ hasLocalDraft: true, isLoading: true }),
    "editing",
  );
  assert.equal(resolveEditorSaveState({ hasLocalDraft: true }), "editing");
  assert.equal(
    resolveEditorSaveState({ hasLocalDraft: false, isDirty: true }),
    "saved-local",
  );
  assert.equal(
    resolveEditorSaveState({ hasLocalDraft: false, isLoading: true }),
    "syncing",
  );
  assert.equal(
    saveStateLabel(resolveEditorSaveState({ hasLocalDraft: false })),
    "Synced",
  );
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
        notes: [
          { id: "temp-note-in-temp-group", groupId: "temp-group-1", order: 0 },
        ],
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
    {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: null,
      order: 0,
      isDirty: false,
    },
    {
      id: "note-2",
      workspaceId: "workspace-1",
      groupId: null,
      order: 1,
      isDirty: false,
    },
    {
      id: "note-3",
      workspaceId: "workspace-1",
      groupId: "group-1",
      order: 0,
      isDirty: false,
    },
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
    {
      id: "note-1",
      workspaceId: "workspace-1",
      groupId: "group-1",
      order: 0,
      isDirty: false,
    },
    {
      id: "temp-note-created-in-group",
      workspaceId: "workspace-1",
      groupId: "group-1",
      order: 1,
      isDirty: true,
    },
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
      {
        id: "note-1",
        workspaceId: "workspace-1",
        groupId: "temp-group-fresh",
        order: 0,
        isDirty: true,
      },
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
    registerBackgroundSync: async () => {},
    requestSync: () => {},
  });

  let resolved: boolean | null = null;
  const updatePromise = service
    .updateNoteContent({
      id: "note-1",
      note: {
        ...note,
        title: "Live title",
        content: "<h1>Live title</h1><p>Updated</p>",
      },
      queueContentSave: async (id, content, title) => {
        queuedContent = { id, content, title };
        return true;
      },
    })
    .then((result) => {
      resolved = result;
      return result;
    });

  await flushAsyncWork();
  assert.equal(notes.value.get("note-1")?.title, "Live title");
  assert.equal(
    notes.value.get("note-1")?.content,
    "<h1>Live title</h1><p>Updated</p>",
  );
  assert.equal(notes.value.get("note-1")?.isDirty, true);
  assert.equal(saveStarted, true);
  assert.equal(queuedContent, null);
  assert.equal(resolved, null);

  releaseSave?.();
  const result = await updatePromise;
  assert.equal(result, true);
  assert.deepEqual(queuedContent, {
    id: "note-1",
    content: "<h1>Live title</h1><p>Updated</p>",
    title: "Live title",
  });
});

test("note response contract normalizes legacy null positions", () => {
  const parsed = NoteSchema.parse({
    id: "note-legacy",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Legacy note",
    content: "<h1>Legacy note</h1>",
    tags: [],
    order: 3,
    position: null,
    noteType: "TEXT",
    metadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(parsed.position, undefined);
});

test("note draft finalize shares an in-flight commit and skips durable revisions", async () => {
  let releaseUpdate: (() => void) | null = null;
  const updateGate = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  let updateCount = 0;
  const sourceId = ref<string | null>("note-draft-1");
  const note = {
    id: "note-draft-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Old",
    content: "<h1>Old</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    metadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
  };
  const notes = ref(new Map<string, any>([[note.id, note]]));
  const store = shallowRef({
    notes,
    resolveNoteId: (id: string | null) => id,
    applyNoteDraft: (id: string, patch: Record<string, unknown>) => {
      const current = notes.value.get(id);
      if (!current) return false;
      notes.value.set(id, { ...current, ...patch });
      return true;
    },
    updateNote: async (id: string, next: any) => {
      updateCount += 1;
      await updateGate;
      notes.value.set(id, next);
      return true;
    },
  } as any);
  const scope = effectScope();
  const draft = scope.run(() => useNoteDraft(store, sourceId))!;

  // An unchanged, already-durable note does not generate an update on close.
  await draft.commitNow();
  assert.equal(updateCount, 0);

  draft.onTitle("Changed once");
  const debouncedCommit = draft.commitNow();
  const finalizeCommit = draft.commitNow();
  await flushAsyncWork();
  assert.equal(updateCount, 1);

  releaseUpdate?.();
  await Promise.all([debouncedCommit, finalizeCommit]);
  await draft.commitNow();
  assert.equal(updateCount, 1);
  scope.stop();
});

test("quick note capture includes the first input in one durable create", async () => {
  const notes = ref(new Map<string, any>());
  const creates: any[] = [];
  let updateCount = 0;
  const store = shallowRef({
    notes,
    resolveNoteId: (id: string) => id,
    createNote: async (
      content: string,
      tags: string[],
      noteType: string,
      metadata: unknown,
      title: string | undefined,
      groupId: string | null,
      options: { deferSync?: boolean } | undefined,
    ) => {
      const id = "temp-quick-note-1";
      creates.push({
        content,
        tags,
        noteType,
        metadata,
        title,
        groupId,
        options,
      });
      notes.value.set(id, {
        id,
        workspaceId: "workspace-quick-capture",
        groupId,
        title: title ?? TITLE_FALLBACK,
        content,
        tags,
        order: 0,
        noteType,
        metadata: metadata ?? null,
        version: 1,
        isDirty: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return id;
    },
    applyNoteDraft: (id: string, patch: Record<string, unknown>) => {
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
    },
    updateNote: async (id: string, patch: Record<string, unknown>) => {
      updateCount += 1;
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
      return true;
    },
    deleteNote: async (id: string) => {
      notes.value.delete(id);
      return true;
    },
    syncPendingChanges: async () => true,
  } as any);
  const scope = effectScope();
  const capture = scope.run(() => useQuickNoteCapture(store))!;

  await capture.begin("group-quick-capture");
  capture.onTitle("Captured immediately");
  await flushAsyncWork();
  await capture.finalize();

  assert.equal(creates.length, 1);
  assert.equal(creates[0]?.title, "Captured immediately");
  assert.equal(creates[0]?.groupId, "group-quick-capture");
  assert.equal(creates[0]?.options?.deferSync, true);
  assert.equal(updateCount, 0);
  scope.stop();
});

test("opening a deferred quick note in the full editor starts its sync", async () => {
  const notes = ref(new Map<string, any>());
  let syncCount = 0;
  const store = shallowRef({
    notes,
    resolveNoteId: (id: string) => id,
    createNote: async (
      content: string,
      tags: string[],
      noteType: string,
      metadata: unknown,
      title: string | undefined,
    ) => {
      const id = "temp-open-full";
      notes.value.set(id, {
        id,
        workspaceId: "workspace-quick-capture",
        groupId: null,
        title: title ?? TITLE_FALLBACK,
        content,
        tags,
        order: 0,
        noteType,
        metadata: metadata ?? null,
        version: 1,
        isDirty: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return id;
    },
    applyNoteDraft: () => true,
    updateNote: async () => true,
    deleteNote: async () => true,
    syncPendingChanges: async () => {
      syncCount++;
      return true;
    },
  } as any);
  const scope = effectScope();
  const capture = scope.run(() => useQuickNoteCapture(store))!;

  await capture.begin();
  capture.onTitle("Open me");
  await flushAsyncWork();
  capture.markFinalized();
  await capture.commitNow();
  capture.requestSync();
  await flushAsyncWork();

  assert.equal(syncCount, 1);
  scope.stop();
});

test("quick note capture settles the previous create before a new session", async () => {
  const notes = ref(new Map<string, any>());
  const pendingCreates: Array<{
    title: string | undefined;
    resolve: (id: string) => void;
  }> = [];
  const store = shallowRef({
    notes,
    resolveNoteId: (id: string) => id,
    createNote: async (
      content: string,
      tags: string[],
      noteType: string,
      metadata: unknown,
      title: string | undefined,
      groupId: string | null,
    ) =>
      new Promise<string>((resolve) => {
        pendingCreates.push({
          title,
          resolve: (id: string) => {
            notes.value.set(id, {
              id,
              workspaceId: "workspace-quick-capture-race",
              groupId,
              title: title ?? TITLE_FALLBACK,
              content,
              tags,
              order: 0,
              noteType,
              metadata: metadata ?? null,
              version: 1,
              isDirty: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            resolve(id);
          },
        });
      }),
    applyNoteDraft: (id: string, patch: Record<string, unknown>) => {
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
    },
    updateNote: async () => true,
    deleteNote: async (id: string) => {
      notes.value.delete(id);
      return true;
    },
    syncPendingChanges: async () => true,
  } as any);
  const scope = effectScope();
  const capture = scope.run(() => useQuickNoteCapture(store))!;

  await capture.begin();
  capture.onTitle("Old session");
  const beginCurrent = capture.begin();
  await flushAsyncWork();
  assert.equal(pendingCreates.length, 1);

  pendingCreates[0]!.resolve("temp-old-session");
  await beginCurrent;
  capture.onTitle("Current session");
  assert.equal(pendingCreates.length, 2);

  pendingCreates[1]!.resolve("temp-current-session");
  await flushAsyncWork();
  assert.equal(capture.created.value, true);
  assert.equal(capture.noteId.value, "temp-current-session");
  assert.equal(pendingCreates[0]?.title, "Old session");
  assert.equal(pendingCreates[1]?.title, "Current session");
  scope.stop();
});

test("quick note capture cannot let an old finalize clear a reopened session", async () => {
  const notes = ref(new Map<string, any>());
  const createIds: string[] = [];
  let releaseUpdate: (() => void) | null = null;
  let updateStarted: (() => void) | null = null;
  const updateGate = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  const updateHasStarted = new Promise<void>((resolve) => {
    updateStarted = resolve;
  });
  const store = shallowRef({
    notes,
    resolveNoteId: (id: string) => id,
    createNote: async (
      content: string,
      tags: string[],
      noteType: string,
      metadata: unknown,
      title: string | undefined,
      groupId: string | null,
    ) => {
      const id = `temp-session-${createIds.length + 1}`;
      createIds.push(id);
      notes.value.set(id, {
        id,
        workspaceId: "workspace-session-barrier",
        groupId,
        title: title ?? TITLE_FALLBACK,
        content,
        tags,
        order: 0,
        noteType,
        metadata: metadata ?? null,
        version: 1,
        isDirty: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return id;
    },
    applyNoteDraft: (id: string, patch: Record<string, unknown>) => {
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
    },
    updateNote: async (id: string, patch: Record<string, unknown>) => {
      updateStarted?.();
      await updateGate;
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
      return true;
    },
    deleteNote: async (id: string) => {
      notes.value.delete(id);
      return true;
    },
    syncPendingChanges: async () => true,
  } as any);
  const scope = effectScope();
  const capture = scope.run(() => useQuickNoteCapture(store))!;

  await capture.begin();
  capture.onTitle("First session");
  await flushAsyncWork();
  capture.onTitle("First session revised");
  const oldFinalize = capture.finalize();
  await updateHasStarted;

  let reopened = false;
  const reopen = capture.begin().then(() => {
    reopened = true;
  });
  await flushAsyncWork();
  assert.equal(reopened, false);

  releaseUpdate?.();
  await Promise.all([oldFinalize, reopen]);
  capture.onTitle("Second session");
  await flushAsyncWork();
  capture.onTitle("Second session continued");
  await flushAsyncWork();

  assert.deepEqual(createIds, ["temp-session-1", "temp-session-2"]);
  assert.equal(capture.noteId.value, "temp-session-2");
  scope.stop();
});

test("quick note capture pins its workspace store through sheet close", async () => {
  const notes = ref(new Map<string, any>());
  let syncCount = 0;
  const pinnedStore = {
    notes,
    resolveNoteId: (id: string) => id,
    createNote: async (
      content: string,
      tags: string[],
      noteType: string,
      metadata: unknown,
      title: string | undefined,
      groupId: string | null,
    ) => {
      const id = "temp-pinned-workspace";
      notes.value.set(id, {
        id,
        workspaceId: "workspace-pinned-capture",
        groupId,
        title: title ?? TITLE_FALLBACK,
        content,
        tags,
        order: 0,
        noteType,
        metadata: metadata ?? null,
        version: 1,
        isDirty: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return id;
    },
    applyNoteDraft: (id: string, patch: Record<string, unknown>) => {
      const note = notes.value.get(id);
      if (note) notes.value.set(id, { ...note, ...patch });
    },
    updateNote: async () => true,
    deleteNote: async (id: string) => {
      notes.value.delete(id);
      return true;
    },
    syncPendingChanges: async () => {
      syncCount += 1;
      return true;
    },
  };
  const store = shallowRef<any>(pinnedStore);
  const scope = effectScope();
  const capture = scope.run(() => useQuickNoteCapture(store))!;

  await capture.begin();
  capture.onTitle("Pinned workspace capture");
  await flushAsyncWork();
  store.value = null;
  await capture.finalize();

  assert.equal(syncCount, 1);
  assert.equal(notes.value.size, 1);
  assert.equal(notes.value.has("temp-pinned-workspace"), true);
  scope.stop();
});

test("quick board capture settles its previous create before reopening", async () => {
  const items = ref(new Map<string, any>());
  const pendingCreates: Array<{
    content: string;
    resolve: (id: string) => void;
  }> = [];
  const store = shallowRef({
    items,
    resolveItemId: (id: string) => id,
    createItem: async (
      content: string,
      tags: string[],
      columnId: string | null,
      dueDate: string | null,
    ) =>
      new Promise<string>((resolve) => {
        pendingCreates.push({
          content,
          resolve: (id: string) => {
            items.value.set(id, {
              id,
              workspaceId: "workspace-board-session",
              content,
              tags,
              columnId,
              dueDate,
              attachments: [],
              order: 0,
              position: "a0",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            resolve(id);
          },
        });
      }),
    updateItem: async () => true,
    moveItemToColumn: async () => true,
    deleteItem: async (id: string) => {
      items.value.delete(id);
      return true;
    },
  } as any);
  const scope = effectScope();
  const defaultColumnId = ref<string | null>(null);
  const capture = scope.run(() =>
    useQuickBoardItemCapture(store, defaultColumnId),
  )!;

  await capture.begin();
  capture.onContent("Old board session");
  const beginCurrent = capture.begin();
  await flushAsyncWork();
  assert.equal(pendingCreates.length, 1);

  pendingCreates[0]!.resolve("temp-board-old");
  await beginCurrent;
  capture.onContent("Current board session");
  assert.equal(pendingCreates.length, 2);
  pendingCreates[1]!.resolve("temp-board-current");
  await flushAsyncWork();

  assert.equal(capture.itemId.value, "temp-board-current");
  assert.deepEqual(
    pendingCreates.map((create) => create.content),
    ["Old board session", "Current board session"],
  );
  scope.stop();
});

test("quick board capture does not mark a revision durable before flushing the store", async () => {
  const items = ref(new Map<string, any>());
  let flushes = 0;
  let updates = 0;
  const store = shallowRef({
    items,
    resolveItemId: (id: string) => id,
    createItem: async (
      content: string,
      tags: string[],
      columnId: string | null,
      dueDate: string | null,
    ) => {
      const id = "temp-board-durable-boundary";
      items.value.set(id, {
        id,
        workspaceId: "workspace-board-durable-boundary",
        columnId,
        content,
        tags,
        dueDate,
        attachments: [],
        order: 0,
        position: "V",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return id;
    },
    updateItem: async (id: string, item: any) => {
      updates += 1;
      items.value.set(id, item);
      return true;
    },
    flushItem: async () => {
      flushes += 1;
    },
    moveItemToColumn: async () => true,
    deleteItem: async () => true,
  } as any);
  const scope = effectScope();
  const capture = scope.run(() =>
    useQuickBoardItemCapture(store, ref<string | null>(null)),
  )!;
  await capture.begin();
  capture.onPayload({
    content: "First",
    tags: [],
    columnId: null,
    dueDate: null,
  });
  await flushAsyncWork();
  capture.onPayload({
    content: "Second",
    tags: [],
    columnId: null,
    dueDate: null,
  });
  assert.equal(await capture.commitNow(), true);
  assert.equal(updates, 1);
  assert.equal(flushes, 1);
  assert.equal(
    items.value.get("temp-board-durable-boundary")?.content,
    "Second",
  );
  capture.onPayload({
    content: "Second",
    tags: [],
    columnId: null,
    dueDate: null,
  });
  assert.equal(await capture.commitNow(), true);
  assert.equal(updates, 1);
  assert.equal(flushes, 1);
  scope.stop();
});

test("notes command service waits for durable create queue before returning new note id", async () => {
  let releaseSave: (() => void) | null = null;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  const notes = ref(new Map<string, any>());
  let queuedCreate: any = null;
  let resolvedId: string | null = null;
  let syncRequests = 0;
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
    registerBackgroundSync: async () => {},
    requestSync: () => {
      syncRequests += 1;
    },
  });

  const createPromise = service
    .createNote({
      workspaceId: "workspace-1",
      groupId: "group-1",
      content: DEFAULT_WORKSPACE_NOTE_HTML,
      deferSync: true,
    })
    .then((id) => {
      resolvedId = id;
      return id;
    });

  await flushAsyncWork();
  const tempId = Array.from(notes.value.keys())[0];
  assert.ok(tempId?.startsWith("temp-"));
  assert.equal(notes.value.get(tempId!)?.groupId, "group-1");
  assert.equal(notes.value.get(tempId!)?.order, 0);
  assert.equal(queuedCreate, null);
  assert.equal(resolvedId, null);

  releaseSave?.();
  const id = await createPromise;
  assert.equal(queuedCreate?.id, id);
  assert.equal(queuedCreate?.groupId, "group-1");
  assert.equal(queuedCreate?.order, 0);
  assert.equal(syncRequests, 0);
});

test("offline-v2 note create reconciliation remaps the Notes view cache", async () => {
  const workspaceId = `workspace-remap-${Date.now()}`;
  const tempId = `temp-note-remap-${Date.now()}`;
  const serverId = `server-note-remap-${Date.now()}`;
  const now = new Date();
  await saveNoteToIndexedDB({
    id: tempId,
    workspaceId,
    groupId: null,
    title: "Local note",
    content: "<h1>Local note</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    version: 1,
    createdAt: now,
    updatedAt: now,
    isDirty: true,
  } as any);
  await reconcileOfflineV2NoteIds({ [tempId]: serverId }, 7, {
    workspaceId,
    groupId: null,
    title: "Local note",
    content: "<h1>Local note</h1>",
    tags: [],
    metadata: null,
    order: 0,
  });

  const notes = await loadNotesFromIndexedDB(workspaceId);
  assert.equal(
    notes.some((note) => note.id === tempId),
    false,
  );
  assert.equal(notes.find((note) => note.id === serverId)?.version, 7);
  assert.equal(notes.find((note) => note.id === serverId)?.isDirty, false);
});

test("offline-v2 note group reconciliation remaps group and note view caches", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const workspaceId = `workspace-group-remap-${suffix}`;
  const tempGroupId = `temp-group-${suffix}`;
  const serverGroupId = `server-group-${suffix}`;
  const noteId = `note-group-remap-${suffix}`;
  const db = await openUnifiedDB();
  await putRecord(db, DB_CONFIG.STORES.NOTE_GROUPS as any, {
    id: tempGroupId,
    workspaceId,
    title: "Local group",
    order: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await saveNoteToIndexedDB({
    id: noteId,
    workspaceId,
    groupId: tempGroupId,
    title: "Grouped",
    content: "<h1>Grouped</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);
  await reconcileOfflineV2NoteGroupIds({ [tempGroupId]: serverGroupId }, 6);

  const groups = await getAllRecords<any>(
    db,
    DB_CONFIG.STORES.NOTE_GROUPS as any,
  );
  const notes = await loadNotesFromIndexedDB(workspaceId);
  assert.equal(
    groups.some((group) => group.id === tempGroupId),
    false,
  );
  assert.equal(groups.find((group) => group.id === serverGroupId)?.version, 6);
  assert.equal(
    notes.find((note) => note.id === noteId)?.groupId,
    serverGroupId,
  );
});

test("notes command service does not return an ID for a non-durable create", async () => {
  const notes = ref(new Map<string, any>());
  let queued = false;
  const service = createNotesCommandService({
    memoryStore: createNotesMemoryStore(notes as any),
    localRepository: {
      save: async () => {
        throw new Error("storage unavailable");
      },
      saveMany: async () => {},
      delete: async () => {},
      loadByWorkspace: async () => [],
    } as any,
    pendingQueue: {
      add: async () => {
        queued = true;
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    registerBackgroundSync: async () => {},
    requestSync: () => {},
  });

  const id = await service.createNote({
    workspaceId: "workspace-failed-create",
    content: DEFAULT_WORKSPACE_NOTE_HTML,
  });
  assert.equal(id, null);
  assert.equal(notes.value.size, 0);
  assert.equal(queued, false);
});
test("Board Phase 2 migrates legacy projection and pending intake exactly once", async () => {
  const suffix = "board-phase2-migration-" + Date.now() + "-" + Math.random();
  const accountId = "account-" + suffix;
  const workspaceId = "workspace-" + suffix;
  const itemId = "item-" + suffix;
  const columnId = "column-" + suffix;
  const db = await openUnifiedDB();

  await putRecord(db, DB_CONFIG.STORES.BOARD_COLUMNS as any, {
    id: columnId,
    userId: accountId,
    workspaceId,
    name: "Legacy column",
    position: "V",
    offlineRevision: 2,
    isDirty: false,
  });
  await putRecord(db, DB_CONFIG.STORES.BOARD_ITEMS as any, {
    id: itemId,
    userId: accountId,
    workspaceId,
    columnId,
    content: "Legacy cached value",
    tags: [],
    order: 0,
    position: "V",
    dueDate: null,
    attachments: [],
    offlineRevision: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
  });
  await putRecord(db, DB_CONFIG.STORES.PENDING_BOARD_ITEMS as any, {
    id: itemId,
    operation: "upsert",
    updatedAt: Date.now(),
    localVersion: 5,
    workspaceId,
    userId: accountId,
    columnId,
    content: "Recovered pending value",
    tags: ["recovered"],
    order: 2,
    position: "k",
  });

  await migrateLegacyBoardProjection(accountId);
  await migrateLegacyBoardProjection(accountId);

  assert.equal(
    (await getAllRecords<any>(db, DB_CONFIG.STORES.BOARD_ITEMS as any)).length,
    0,
  );
  assert.equal(
    (await getAllRecords<any>(db, DB_CONFIG.STORES.BOARD_COLUMNS as any))
      .length,
    0,
  );
  assert.equal(
    (await getAllRecords<any>(db, DB_CONFIG.STORES.PENDING_BOARD_ITEMS as any))
      .length,
    0,
  );
  const item = await getOfflineEntity<any>(accountId, "boardItem", itemId);
  const column = await getOfflineEntity<any>(
    accountId,
    "boardColumn",
    columnId,
  );
  assert.equal(item?.data.content, "Recovered pending value");
  assert.equal(item?.version, 4);
  assert.equal(column?.data.name, "Legacy column");
  assert.equal(column?.version, 2);
  const mutations = await listOfflineMutations(accountId);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0]?.operation, "boardItem.update");
  assert.equal(mutations[0]?.baseVersion, 4);
  assert.equal(mutations[0]?.payload.content, "Recovered pending value");
});

test("Board Phase 2 projection purges clean rows and preserves pending local rows", async () => {
  const suffix = "board-phase2-projection-" + Date.now() + "-" + Math.random();
  const accountId = "account-" + suffix;
  const workspaceId = "workspace-" + suffix;
  const staleId = "stale-" + suffix;
  const pendingId = "pending-" + suffix;
  const cleanId = "clean-" + suffix;
  const baseItem = {
    userId: accountId,
    workspaceId,
    columnId: null,
    tags: [],
    dueDate: null,
    attachments: [],
    order: 0,
    position: "V",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await putBoardProjectionRecord({
    accountId,
    entity: "boardItem",
    record: {
      ...baseItem,
      id: staleId,
      content: "Deleted remotely",
      offlineRevision: 2,
    },
  });
  await commitOfflineMutation({
    accountId,
    mutation: {
      id: "mutation-" + pendingId,
      entity: "boardItem",
      operation: "boardItem.update",
      entityId: pendingId,
      workspaceId,
      baseVersion: 4,
      changedFields: ["content"],
      payload: { content: "Local edit" },
      rollbackData: { ...baseItem, id: pendingId, content: "Server before" },
      dependsOn: [],
      occurredAt: new Date().toISOString(),
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
      sequence: false,
    },
    localRecord: {
      entity: "boardItem",
      entityId: pendingId,
      workspaceId,
      version: 4,
      data: { ...baseItem, id: pendingId, content: "Local edit" },
    },
  });

  const projection = await reconcileBoardWorkspaceProjection({
    accountId,
    workspaceId,
    entity: "boardItem",
    serverRecords: [
      {
        ...baseItem,
        id: pendingId,
        content: "Server before",
        offlineRevision: 4,
      },
      {
        ...baseItem,
        id: cleanId,
        content: "Canonical clean",
        offlineRevision: 7,
      },
    ],
  });
  assert.equal(
    projection.some((item) => item.id === staleId),
    false,
  );
  assert.equal(
    projection.find((item) => item.id === pendingId)?.content,
    "Local edit",
  );
  assert.equal(projection.find((item) => item.id === pendingId)?.isDirty, true);
  assert.equal(
    (await getOfflineEntity<any>(accountId, "boardItem", staleId))?.deleted,
    true,
  );
  const clean = await getOfflineEntity<any>(accountId, "boardItem", cleanId);
  assert.equal(clean?.version, 7);
  assert.equal(clean?.data.content, "Canonical clean");
});

test("generic Board acknowledgement preserves a queued successor without a cache bridge", async () => {
  const suffix = "board-phase2-successor-" + Date.now() + "-" + Math.random();
  const accountId = "account-" + suffix;
  const workspaceId = "workspace-" + suffix;
  const itemId = "item-" + suffix;
  const first = {
    id: "first-" + suffix,
    entity: "boardItem" as const,
    operation: "boardItem.update",
    entityId: itemId,
    workspaceId,
    baseVersion: 3,
    changedFields: ["content"],
    payload: { content: "First edit" },
    dependsOn: [],
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({
    accountId,
    mutation: first,
    localRecord: {
      entity: "boardItem",
      entityId: itemId,
      workspaceId,
      version: 3,
      data: { id: itemId, workspaceId, content: "First edit" },
    },
  });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [first.id],
    claimToken: "claim-" + suffix,
  });
  assert.ok(claimed);
  await commitOfflineMutation({
    accountId,
    mutation: {
      ...first,
      id: "second-" + suffix,
      payload: { content: "Second edit" },
      createdAt: first.createdAt + 1,
      status: "pending",
    },
    localRecord: {
      entity: "boardItem",
      entityId: itemId,
      workspaceId,
      version: 3,
      data: { id: itemId, workspaceId, content: "Second edit" },
    },
  });
  const applied = await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "applied",
      entity: "boardItem",
      entityId: itemId,
      version: 4,
      canonical: { id: itemId, workspaceId, content: "First edit" },
    },
  });
  assert.equal(applied.hasPendingSuccessor, true);
  const entity = await getOfflineEntity<any>(accountId, "boardItem", itemId);
  assert.equal(entity?.version, 4);
  assert.equal(entity?.data.content, "Second edit");
  const successor = (await listOfflineMutations(accountId)).find(
    (mutation) => mutation.id !== first.id,
  );
  assert.equal(successor?.baseVersion, 4);
  const visible = await loadBoardItemsProjection({ accountId, workspaceId });
  assert.equal(visible[0]?.content, "Second edit");
  assert.equal(visible[0]?.isDirty, true);
});

test("ordinary Board relation reads seed revisions and preserve pending local relations", async () => {
  const suffix = "board-phase2-relations-" + Date.now() + "-" + Math.random();
  const accountId = "account-" + suffix;
  const workspaceId = "workspace-" + suffix;
  const itemId = "item-" + suffix;
  const targetId = "target-" + suffix;
  const linkId = "link-" + suffix;
  const localLinkId = "temp-board-link-" + suffix;

  const links = await reconcileBoardRelationsForItem({
    accountId,
    workspaceId,
    itemId,
    entity: "boardLink",
    serverRecords: [
      {
        id: linkId,
        sourceId: itemId,
        targetId,
        linkType: "RELATED" as const,
        userId: accountId,
        createdAt: new Date(),
        offlineRevision: 6,
      },
    ],
  });
  assert.equal(links[0]?.offlineRevision, 6);
  assert.equal(
    (await getOfflineEntity<any>(accountId, "boardLink", linkId))?.version,
    6,
  );

  await commitOfflineMutation({
    accountId,
    mutation: {
      id: "mutation-" + localLinkId,
      entity: "boardLink",
      operation: "boardLink.create",
      entityId: localLinkId,
      workspaceId,
      changedFields: ["sourceId", "targetId", "linkType"],
      payload: { sourceId: itemId, targetId, linkType: "BLOCKS" },
      dependsOn: [],
      occurredAt: new Date().toISOString(),
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
      sequence: false,
    },
    localRecord: {
      entity: "boardLink",
      entityId: localLinkId,
      workspaceId,
      version: 0,
      data: {
        id: localLinkId,
        sourceId: itemId,
        targetId,
        linkType: "BLOCKS",
        userId: accountId,
        createdAt: new Date(),
      },
    },
  });
  const reconciled = await reconcileBoardRelationsForItem({
    accountId,
    workspaceId,
    itemId,
    entity: "boardLink",
    serverRecords: [
      {
        id: linkId,
        sourceId: itemId,
        targetId,
        linkType: "RELATED" as const,
        userId: accountId,
        createdAt: new Date(),
        offlineRevision: 6,
      },
    ],
  });
  assert.equal(
    reconciled.some((link) => link.id === localLinkId),
    true,
  );
  assert.equal(
    reconciled.some((link) => link.id === linkId),
    true,
  );
});

test("Board acknowledgement preserves a durable draft that has not reached the outbox yet", async () => {
  const suffix = "board-phase2-draft-" + Date.now() + "-" + Math.random();
  const accountId = "account-" + suffix;
  const workspaceId = "workspace-" + suffix;
  const itemId = "item-" + suffix;
  const mutation = {
    id: "mutation-" + suffix,
    entity: "boardItem" as const,
    operation: "boardItem.update",
    entityId: itemId,
    workspaceId,
    baseVersion: 2,
    changedFields: ["content"],
    payload: { content: "In flight" },
    dependsOn: [],
    occurredAt: new Date().toISOString(),
    createdAt: Date.now(),
    attempts: 0,
    status: "pending" as const,
    sequence: false,
  };
  await commitOfflineMutation({
    accountId,
    mutation,
    localRecord: {
      entity: "boardItem",
      entityId: itemId,
      workspaceId,
      version: 2,
      data: { id: itemId, workspaceId, content: "In flight" },
    },
  });
  const [claimed] = await claimOfflineMutations({
    accountId,
    ids: [mutation.id],
    claimToken: "claim-" + suffix,
  });
  assert.ok(claimed);
  await putBoardProjectionRecord({
    accountId,
    entity: "boardItem",
    record: {
      id: itemId,
      workspaceId,
      content: "Draft after request",
      isDirty: true,
      offlineRevision: 2,
    },
  });

  const projection = await applySyncResult({
    accountId,
    mutation: claimed!,
    result: {
      status: "applied",
      entity: "boardItem",
      entityId: itemId,
      version: 3,
      canonical: { id: itemId, workspaceId, content: "In flight" },
    },
  });
  assert.equal(projection.hasPendingSuccessor, true);
  const entity = await getOfflineEntity<any>(accountId, "boardItem", itemId);
  assert.equal(entity?.data.content, "Draft after request");
  assert.equal(entity?.version, 3);
  assert.equal(entity?.localDirty, true);
});

test("notes delete queues a rollback snapshot and keeps canonical cache until acknowledgement", async () => {
  const note = {
    id: "note-1",
    workspaceId: "workspace-1",
    groupId: null,
    title: "Delete me",
    content: "<h1>Delete me</h1>",
    tags: [],
    order: 0,
    noteType: "TEXT",
    metadata: null,
    version: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    isLoading: false,
    error: null,
  };
  const notes = ref(new Map<string, any>([[note.id, note]]));
  let queuedDelete: any = null;
  let localDeleteCalled = false;
  let syncRequested = false;
  let resolved: boolean | null = null;
  const service = createNotesCommandService({
    memoryStore: createNotesMemoryStore(notes as any),
    localRepository: {
      save: async () => {},
      saveMany: async () => {},
      delete: async () => {
        localDeleteCalled = true;
      },
      loadByWorkspace: async () => [],
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        queuedDelete = change;
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    } as any,
    registerBackgroundSync: async () => {},
    requestSync: () => {
      syncRequested = true;
    },
  });

  const deletePromise = service
    .deleteNote({ id: "note-1", note })
    .then((result) => {
      resolved = result;
      return result;
    });

  await flushAsyncWork();
  assert.equal(notes.value.has("note-1"), false);
  const result = await deletePromise;
  assert.equal(result, true);
  assert.equal(queuedDelete?.operation, "delete");
  assert.equal(queuedDelete?.id, "note-1");
  assert.equal(queuedDelete?.serverVersion, 4);
  assert.equal(queuedDelete?.rollbackData?.content, note.content);
  assert.equal(localDeleteCalled, false);
  assert.equal(syncRequested, true);
});

test("notes content queue flushes all pending note saves and requests sync once per note", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
      [
        "note-2",
        {
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
        },
      ],
    ]),
  );
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

  assert.deepEqual(queued.map((change) => change.id).sort(), [
    "note-1",
    "note-2",
  ]);
  assert.equal(notes.value.get("note-1")?.isDirty, true);
  assert.equal(notes.value.get("note-2")?.isDirty, true);
  assert.equal(syncRequests, 2);
});

test("notes content queue keeps offline edits durable without requesting page sync", async () => {
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
    ]),
  );
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

  const saved = await queue.queueContentSaveNow(
    "note-1",
    "<h1>Offline</h1>",
    "Offline",
  );

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

  let resolvedId: string | null | undefined;
  const createPromise = service.createGroup("Immediate group").then((id) => {
    resolvedId = id;
    return id;
  });
  await flushAsyncWork();
  const id = Array.from(groups.value.keys())[0];

  assert.ok(id?.startsWith("temp-group-"));
  assert.equal(groups.value.get(id!)?.title, "Immediate group");
  assert.equal(groups.value.get(id!)?.order, 0);
  assert.equal(queuedGroup, null);
  assert.equal(resolvedId, undefined);

  releaseSave?.();
  assert.equal(await createPromise, id);
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
  const pendingChanges = [
    {
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
    },
  ];
  const pendingGroups = [
    {
      id: "group-1",
      operation: "rename",
      workspaceId: "workspace-1",
      title: "Group",
      updatedAt: Date.now(),
      localVersion: 1,
    },
  ];
  const pendingLayout = {
    id: "workspace-1",
    workspaceId: "workspace-1",
    updatedAt: Date.now(),
    localVersion: 1,
    notes: [{ id: "note-1", groupId: "group-1", order: 0 }],
    groups: [{ id: "group-1", order: 0 }],
  };
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
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
        },
      ],
    ]),
  );
  const layoutPendingCount = ref(0);
  const layoutStatus = ref<any>("idle");
  let layoutRemoved = false;
  let queuesDrained = false;

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
      load: async () => (queuesDrained ? [] : pendingChanges) as any,
      remove: async (ids: string[]) => {
        events.push(`content-remove:${ids.join(",")}`);
      },
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
      load: async () => (queuesDrained ? [] : pendingGroups) as any,
      remove: async (ids: string[]) => {
        events.push(`group-remove:${ids.join(",")}`);
      },
      registerBackgroundSync: async () => {},
    },
    layoutQueue: {
      save: async () => {},
      load: async () =>
        queuesDrained || layoutRemoved ? null : (pendingLayout as any),
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
      getConflict: () => null,
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
      sync: async () => {
        events.push("notes-sync");
        queuesDrained = true;
        return notesSyncSuccess({
          applied: ["note-1"],
          groupApplied: ["group-1"],
          layoutApplied: true,
        });
      },
    },
    flushDrafts: async () => {
      events.push("flush-drafts");
    },
    hydrateLocalGroups: async () => {},
  });

  const synced = await runtime.syncPendingChanges("manual");

  assert.equal(synced, true);
  assert.deepEqual(events, [
    "flush-drafts",
    "notes-sync",
    "apply-result",
    "record-conflicts",
    "group-remove:group-1",
  ]);
  assert.equal(layoutStatus.value, "synced");
  assert.equal(layoutPendingCount.value, 0);
});

test("notes sync runtime quarantines group conflicts instead of resending forever", async () => {
  let pendingGroup: any = {
    id: "group-conflict",
    operation: "rename",
    workspaceId: "workspace-1",
    title: "Local rename",
    updatedAt: 100,
    localVersion: 1,
  };
  let syncRequests = 0;
  const layoutStatus = ref<any>("idle");
  const runtime = createNotesSyncRuntime({
    workspaceId: "workspace-1",
    notes: ref(new Map()) as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount: ref(0),
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
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async (change: any) => {
        pendingGroup = change;
      },
      load: async () => (pendingGroup ? [pendingGroup] : []),
      remove: async () => {
        pendingGroup = null;
      },
      registerBackgroundSync: async () => {},
    },
    layoutQueue: {
      save: async () => {},
      load: async () => null,
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {},
    },
    conflictResolver: {
      hasConflicts: async () => false,
      getConflict: () => null,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => 0,
    },
    networkMonitor: { isVerifiedOnline: ref(true) },
    notesApi: {
      getByWorkspace: async () => ({ success: true, data: [] }),
      sync: async () => {
        syncRequests += 1;
        return notesSyncSuccess({ groupConflicts: [{ id: "group-conflict" }] });
      },
    },
    flushDrafts: async () => {},
    hydrateLocalGroups: async () => {},
  });

  assert.equal(await runtime.syncPendingChanges("manual"), false);
  assert.equal(pendingGroup.conflicted, true);
  assert.equal(layoutStatus.value, "conflict");
  assert.equal(await runtime.syncPendingChanges("manual"), false);
  assert.equal(syncRequests, 1);
});

test("notes sync runtime overlays latest layout onto pending note upserts", async () => {
  const pendingChanges = [
    {
      id: "temp-note-1",
      operation: "upsert",
      updatedAt: 100,
      localVersion: 1,
      workspaceId: "workspace-1",
      groupId: "temp-group-deleted",
      title: "Local",
      content: "<h1>Local</h1>",
      tags: [],
      noteType: "TEXT",
      metadata: null,
    },
  ];
  const pendingGroups = [
    {
      id: "temp-group-deleted",
      operation: "delete",
      workspaceId: "workspace-1",
      updatedAt: 150,
      localVersion: 1,
    },
  ];
  const pendingLayout = {
    id: "workspace-1",
    workspaceId: "workspace-1",
    updatedAt: 200,
    localVersion: 2,
    notes: [{ id: "temp-note-1", groupId: null, order: 0 }],
    groups: [],
  };
  const patchedChanges: any[] = [];

  const runtime = createNotesSyncRuntime({
    workspaceId: "workspace-1",
    notes: ref(
      new Map<string, any>([
        [
          "temp-note-1",
          {
            id: "temp-note-1",
            workspaceId: "workspace-1",
            groupId: null,
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
          },
        ],
      ]),
    ) as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount: ref(0),
    layoutStatus: ref<any>("idle"),
    noteIdAliases: ref(new Map()),
    localRepository: {
      save: async () => {},
      saveMany: async () => {},
      loadByWorkspace: async () => [],
      delete: async () => {},
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        patchedChanges.push(change);
      },
      load: async () => pendingChanges as any,
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
      load: async () => pendingGroups as any,
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    layoutQueue: {
      save: async () => {},
      load: async () => pendingLayout as any,
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {},
    },
    conflictResolver: {
      hasConflicts: async () => false,
      getConflict: () => null,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => 0,
    },
    networkMonitor: {
      isVerifiedOnline: ref(true),
    },
    notesApi: {
      getByWorkspace: async () => ({ success: true, data: [] }),
      sync: async () => notesSyncSuccess(),
    },
    flushDrafts: async () => {},
    hydrateLocalGroups: async () => {},
  });

  await runtime.syncPendingChanges("manual");

  assert.equal(patchedChanges[0]?.id, "temp-note-1");
  assert.equal(patchedChanges[0]?.groupId, null);
});

test("notes sync runtime repairs dirty notes missing pending queue rows", async () => {
  const repaired: any[] = [];
  const notes = ref(
    new Map<string, any>([
      [
        "note-1",
        {
          id: "note-1",
          workspaceId: "workspace-1",
          groupId: null,
          title: "Offline title",
          content: "<h1>Offline title</h1><p>Desktop edit</p>",
          tags: ["local"],
          order: 0,
          noteType: "TEXT",
          metadata: null,
          version: 4,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
          isDirty: true,
          isLoading: false,
          error: null,
        },
      ],
    ]),
  );

  const runtime = createNotesSyncRuntime({
    workspaceId: "workspace-1",
    notes: notes as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount: ref(0),
    layoutStatus: ref<any>("idle"),
    noteIdAliases: ref(new Map()),
    localRepository: {
      save: async () => {},
      saveMany: async () => {},
      loadByWorkspace: async () => [],
      delete: async () => {},
    } as any,
    pendingQueue: {
      add: async (change: any) => {
        repaired.push(change);
      },
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
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
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {},
    },
    conflictResolver: {
      hasConflicts: async () => false,
      getConflict: () => null,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => 0,
    },
    networkMonitor: {
      isVerifiedOnline: ref(true),
    },
    notesApi: {
      getByWorkspace: async () => ({ success: true, data: [] }),
      sync: async () => notesSyncSuccess({ applied: ["note-1"] }),
    },
    flushDrafts: async () => {},
    hydrateLocalGroups: async () => {},
  });

  const synced = await runtime.syncPendingChanges("manual");

  assert.equal(synced, true);
  assert.equal(repaired.length, 1);
  assert.equal(repaired[0]?.id, "note-1");
  assert.equal(repaired[0]?.serverVersion, 4);
  assert.equal(
    repaired[0]?.content,
    "<h1>Offline title</h1><p>Desktop edit</p>",
  );
});

test("notes refresh does not resurrect server rows with pending delete tombstones", async () => {
  const notes = ref(new Map<string, any>());
  const pending = new Map<string, any>([
    [
      "note-1",
      {
        id: "note-1",
        operation: "delete",
        updatedAt: Date.parse("2026-01-02T00:00:00.000Z"),
        localVersion: 1,
        serverVersion: 3,
        workspaceId: "workspace-1",
      },
    ],
  ]);
  const saved = new Map<string, any>();
  let fetchedAfterDeleteSync = false;

  const runtime = createNotesSyncRuntime({
    workspaceId: "workspace-1",
    notes: notes as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount: ref(0),
    layoutStatus: ref<any>("idle"),
    noteIdAliases: ref(new Map()),
    localRepository: {
      save: async (note: any) => {
        saved.set(note.id, note);
      },
      saveMany: async (items: any[]) => {
        for (const note of items) saved.set(note.id, note);
      },
      loadByWorkspace: async () => Array.from(saved.values()),
      delete: async (id: string) => {
        saved.delete(id);
      },
    } as any,
    pendingQueue: {
      add: async (change: any) => pending.set(change.id, change),
      load: async () => Array.from(pending.values()),
      remove: async (ids: string[]) => ids.forEach((id) => pending.delete(id)),
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
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
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {},
    },
    conflictResolver: {
      hasConflicts: async () => false,
      getConflict: () => null,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => 0,
    },
    networkMonitor: {
      isVerifiedOnline: ref(true),
    },
    notesApi: {
      getByWorkspace: async () => {
        fetchedAfterDeleteSync = true;
        return {
          success: true,
          data: [
            {
              id: "note-1",
              workspaceId: "workspace-1",
              groupId: null,
              title: "Stale server note",
              content: "<h1>Stale server note</h1>",
              tags: [],
              order: 0,
              noteType: "TEXT",
              metadata: null,
              version: 3,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        } as any;
      },
      sync: async () => {
        pending.delete("note-1");
        saved.delete("note-1");
        return notesSyncSuccess({ applied: ["note-1"] });
      },
    },
    flushDrafts: async () => {},
    hydrateLocalGroups: async () => {},
  });

  await runtime.refreshFromServer();

  assert.equal(fetchedAfterDeleteSync, true);
  assert.equal(pending.has("note-1"), false);
  assert.equal(notes.value.has("note-1"), false);
  assert.equal(saved.has("note-1"), false);
});

test("notes refresh cannot apply a stale GET over create and delete actions", async () => {
  const workspaceId = "workspace-refresh-race";
  const makeNote = (id: string, title: string) => ({
    id,
    workspaceId,
    groupId: null,
    title,
    content: `<h1>${title}</h1>`,
    tags: [],
    order: 0,
    noteType: "TEXT",
    metadata: null,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    isDirty: false,
    isLoading: false,
    error: null,
  });
  const deletedDuringGet = makeNote("note-delete-during-get", "Delete me");
  const staleLocal = makeNote("note-stale-local", "Stale local");
  const createdDuringGet = makeNote("note-create-during-get", "Create me");
  const notes = ref(
    new Map<string, any>([
      [deletedDuringGet.id, deletedDuringGet],
      [staleLocal.id, staleLocal],
    ]),
  );
  const saved = new Map<string, any>(notes.value);
  let getStarted = false;
  let releaseGet: (() => void) | null = null;
  const getGate = new Promise<void>((resolve) => {
    releaseGet = resolve;
  });

  const runtime = createNotesSyncRuntime({
    workspaceId,
    notes: notes as any,
    loadingStates: ref(new Map()),
    lastSync: ref(null),
    layoutPendingCount: ref(0),
    layoutStatus: ref<any>("idle"),
    noteIdAliases: ref(new Map()),
    localRepository: {
      save: async (note: any) => saved.set(note.id, note),
      saveMany: async (items: any[]) => {
        for (const note of items) saved.set(note.id, note);
      },
      loadByWorkspace: async () => Array.from(saved.values()),
      delete: async (id: string) => {
        saved.delete(id);
      },
    } as any,
    pendingQueue: {
      add: async () => {},
      load: async () => [],
      remove: async () => {},
      registerBackgroundSync: async () => {},
    },
    groupQueue: {
      add: async () => {},
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
    syncCoordinator: {
      hydrateFromLocalState: async () => {},
      applySyncResult: async () => {},
    },
    conflictResolver: {
      hasConflicts: async () => false,
      getConflict: () => null,
      hydrateConflictState: async () => {},
      recordContentConflicts: async () => 0,
    },
    networkMonitor: { isVerifiedOnline: ref(true) },
    notesApi: {
      getByWorkspace: async () => {
        getStarted = true;
        await getGate;
        return {
          success: true,
          // This is the snapshot from before the concurrent delete/create.
          data: [deletedDuringGet],
        } as any;
      },
      sync: async () => notesSyncSuccess(),
    },
    flushDrafts: async () => {},
    hydrateLocalGroups: async () => {},
  });

  const refresh = runtime.refreshFromServer();
  while (!getStarted) await flushAsyncWork();
  notes.value.delete(deletedDuringGet.id);
  notes.value.set(createdDuringGet.id, createdDuringGet as any);
  saved.set(createdDuringGet.id, createdDuringGet);
  releaseGet?.();
  await refresh;

  assert.deepEqual(new Set(notes.value.keys()), new Set([createdDuringGet.id]));
  assert.deepEqual(new Set(saved.keys()), new Set([createdDuringGet.id]));
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
  const boardColumnId = createClientTempId("board-column");

  for (let i = 0; i < 100; i++) {
    ids.add(createClientTempId("note"));
    ids.add(createClientTempId("note-group"));
  }

  assert.equal(ids.size, 200);
  assert.ok(noteId.startsWith("temp-"));
  assert.ok(groupId.startsWith("temp-group-"));
  assert.ok(boardItemId.startsWith("temp-board-item-"));
  assert.ok(boardColumnId.startsWith("temp-board-column-"));
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

test("double-tap confirm only confirms on the second activation", async () => {
  const scope = effectScope();
  let armed = 0;
  let confirmed = 0;
  let guard: ReturnType<typeof useDoubleTapConfirm> | undefined;

  scope.run(() => {
    guard = useDoubleTapConfirm({
      windowMs: 100,
      onArm: () => {
        armed++;
      },
      onConfirm: () => {
        confirmed++;
      },
    });
  });

  assert.ok(guard);
  assert.equal(await guard.trigger(), false);
  assert.equal(guard.isArmed.value, true);
  assert.equal(armed, 1);
  assert.equal(confirmed, 0);

  assert.equal(await guard.trigger(), true);
  assert.equal(guard.isArmed.value, false);
  assert.equal(confirmed, 1);
  scope.stop();
});

test("double-tap confirm cancels after its confirmation window", async () => {
  const scope = effectScope();
  let canceled = 0;
  let confirmed = 0;
  let guard: ReturnType<typeof useDoubleTapConfirm> | undefined;

  scope.run(() => {
    guard = useDoubleTapConfirm({
      windowMs: 5,
      onCancel: () => {
        canceled++;
      },
      onConfirm: () => {
        confirmed++;
      },
    });
  });

  assert.ok(guard);
  await guard.trigger();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(guard.isArmed.value, false);
  assert.equal(canceled, 1);
  assert.equal(confirmed, 0);
  scope.stop();
});

test("double-tap confirm does not arm while disabled", async () => {
  const scope = effectScope();
  const disabled = ref(true);
  let confirmed = 0;
  let guard: ReturnType<typeof useDoubleTapConfirm> | undefined;

  scope.run(() => {
    guard = useDoubleTapConfirm({
      windowMs: 100,
      disabled,
      onConfirm: () => {
        confirmed++;
      },
    });
  });

  assert.ok(guard);
  assert.equal(await guard.trigger(), false);
  assert.equal(guard.isArmed.value, false);
  disabled.value = false;
  assert.equal(await guard.trigger(), false);
  assert.equal(guard.isArmed.value, true);
  assert.equal(await guard.trigger(), true);
  assert.equal(confirmed, 1);
  scope.stop();
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
  controller.execute({
    type: "DROP_SPLIT",
    noteId: "note-3",
    position: "left",
  });

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

test("board item order persistence retries closed transaction writes", async () => {
  const writes: Array<{ id: string; userId: string; order: number }> = [];
  let calls = 0;
  const prisma = {
    boardItem: {
      updateMany: async ({ where, data }: any) => {
        calls += 1;
        if (calls === 1) {
          throw new Error(
            "Transaction already closed: Could not perform operation.",
          );
        }
        writes.push({ id: where.id, userId: where.userId, order: data.order });
        return { count: 1 };
      },
    },
  };

  await persistBoardItemOrders({
    prisma,
    userId: "user-1",
    itemOrders: [
      { id: "board-1", order: 10 },
      { id: "board-2", order: 20 },
    ],
    attempts: 2,
  });

  assert.equal(calls, 3);
  assert.deepEqual(writes, [
    { id: "board-1", userId: "user-1", order: 10 },
    { id: "board-2", userId: "user-1", order: 20 },
  ]);
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
      position: "V",
      attachments: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  assert.equal(parsed[0]?.operation, "upsert");
  assert.equal(parsed[0]?.content, "Offline task");
  assert.equal(parsed[0]?.position, "V");
});

test("workspace integration refs support local-change sync status", () => {
  const parsed = WorkspaceExternalRefSchema.parse({
    id: "ref-1",
    workspaceId: "workspace-1",
    accountId: "account-1",
    mappingId: "mapping-1",
    targetType: "NOTE",
    targetId: "note-1",
    provider: "notion",
    externalId: "page-1",
    syncStatus: "LOCAL_CHANGED",
    lastError: "Local edits preserved",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(parsed.syncStatus, "LOCAL_CHANGED");
});

test("workspace integration mapping summaries count local changes and conflicts", () => {
  const parsed = WorkspaceImportMappingSummarySchema.parse({
    id: "mapping-1",
    workspaceId: "workspace-1",
    accountId: "account-1",
    provider: "jira",
    externalSourceId: "project-1",
    sourceKind: "TASK",
    targetType: "BOARD_ITEM",
    name: "Project",
    createdAt: new Date(),
    updatedAt: new Date(),
    refCounts: {
      total: 4,
      synced: 1,
      localChanged: 1,
      conflicted: 1,
      error: 1,
    },
  });

  assert.equal(parsed.refCounts.localChanged, 1);
  assert.equal(parsed.refCounts.conflicted, 1);
});

test("integration repository recognizes duplicate key errors", () => {
  assert.equal(isDuplicateKeyError({ code: 11000 }), true);
  assert.equal(
    isDuplicateKeyError({ message: "E11000 duplicate key error collection" }),
    true,
  );
  assert.equal(isDuplicateKeyError({ code: 42, message: "other" }), false);
});

test("generation quota spends a credit after free quota is exhausted", async () => {
  const { subscriptions, creditTransactions, prisma } =
    fakeSubscriptionPrisma();
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
  const { subscriptions, creditTransactions, prisma } =
    fakeSubscriptionPrisma();
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
  const { subscriptions, creditTransactions, prisma } =
    fakeSubscriptionPrisma();

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
    userId: "user-1",
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
  assert.equal(reviews.length, 2);
  assert.deepEqual(
    reviews.map((review) => review.resourceType),
    ["flashcard", "flashcard"],
  );
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

test("language lexical parser never substitutes the source word for a missing translation", () => {
  const entry = parseLexicalEntry(
    JSON.stringify({
      detectedLang: "es",
      partOfSpeech: "interjection",
      meanings: [{ definition: "greeting" }],
      examples: [],
    }),
    "hola",
  );

  assert.equal(entry.translation, "");
});

test("language prompts keep definitions and stories in the learned language", () => {
  const lexicalPrompt = translationPrompt("hola", undefined, "English", false);
  assert.match(
    lexicalPrompt,
    /Write every definition and source example in the same language as the captured word/,
  );
  assert.match(lexicalPrompt, /Direct translation requested: no/);

  const storyPrompt = languageStoryPrompt(
    "hola",
    "hello",
    undefined,
    [],
    "Spanish",
    "English",
  );
  assert.match(
    storyPrompt,
    /Write ALL of title, storyText, sentences\[\]\.text.+in Spanish/,
  );
  assert.match(
    storyPrompt,
    /Never write storyText or sentence text in English/,
  );
  assert.match(
    storyPrompt,
    /Do not return a native-language version of the story/,
  );
  assert.match(storyPrompt, /Use English ONLY for glossary translations/);
});

test("saving a generated translation is idempotent and performs no generation work", async () => {
  let storedWord: Record<string, any> | null = null;
  let creates = 0;
  const translation = {
    id: "64b000000000000000000001",
    sourceText: "hola",
    translation: "hello",
    translationLang: "en",
    sourceLang: "es",
    partOfSpeech: "interjection",
    phonetic: null,
    meanings: [{ definition: "greeting" }],
    examples: [],
    category: "greeting",
    difficulty: "A1",
    isPhrase: false,
    metadata: {},
  };
  const prisma = {
    languageTranslation: {
      findUnique: async () => translation,
    },
    languageWord: {
      findFirst: async () => storedWord,
      create: async ({ data }: any) => {
        creates++;
        storedWord = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return storedWord;
      },
    },
    userLanguagePreferences: {
      findUnique: async () => ({ autoEnroll: false }),
    },
  };

  const first = await saveLanguageWord({
    prisma,
    userId: "64a000000000000000000001",
    data: { translationId: translation.id, sourceType: "manual" },
  });
  const second = await saveLanguageWord({
    prisma,
    userId: "64a000000000000000000001",
    data: { translationId: translation.id, sourceType: "manual" },
  });

  assert.equal(creates, 1);
  assert.equal(first.wordId, second.wordId);
  assert.equal(first.saved, true);
  assert.equal(second.cached, true);
});

test("translating a definition-only capture enriches its existing bank row", async () => {
  const definitionOnlyWord = {
    id: "64c000000000000000000001",
    userId: "64a000000000000000000001",
    translationId: "64b000000000000000000000",
    word: "hola",
    translation: "",
    translationLang: "en",
    sourceLang: "es",
    sourceContext: null,
    sourceType: "manual",
    partOfSpeech: "interjection",
    phonetic: null,
    meanings: [{ definition: "Un saludo breve." }],
    examples: [],
    category: "greeting",
    difficulty: "A1",
    isPhrase: false,
    metadata: {},
    status: "captured",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const translatedEntry = {
    id: "64b000000000000000000001",
    sourceText: "hola",
    translation: "hello",
    translationLang: "en",
    sourceLang: "es",
    partOfSpeech: "interjection",
    phonetic: "ˈola",
    meanings: [
      {
        definition: "Un saludo breve.",
        translation: "A brief greeting.",
      },
    ],
    examples: [{ text: "Hola, Ana.", translation: "Hello, Ana." }],
    category: "greeting",
    difficulty: "A1",
    isPhrase: false,
    metadata: { lemma: "hola" },
  };
  let updatedWord: Record<string, any> | null = null;
  let creates = 0;
  const prisma = {
    languageTranslation: {
      findUnique: async () => translatedEntry,
    },
    languageWord: {
      findFirst: async ({ where }: any) => {
        if (where.translationId === translatedEntry.id) return null;
        if (where.translation === "") return definitionOnlyWord;
        return null;
      },
      update: async ({ data }: any) => {
        updatedWord = { ...definitionOnlyWord, ...data };
        return updatedWord;
      },
      create: async () => {
        creates++;
        throw new Error("should not create a second word");
      },
    },
    userLanguagePreferences: {
      findUnique: async () => ({ autoEnroll: false }),
    },
  };

  const result = await saveLanguageWord({
    prisma,
    userId: definitionOnlyWord.userId,
    data: { translationId: translatedEntry.id, sourceType: "manual" },
  });

  assert.equal(creates, 0);
  assert.equal(result.wordId, definitionOnlyWord.id);
  assert.equal(result.translation, "hello");
  assert.equal(updatedWord?.translationId, translatedEntry.id);
});

test("language story parser rejects incomplete LLM story responses", () => {
  assert.throws(() =>
    parseLanguageStoryResponse(JSON.stringify({ storyText: "Only text" })),
  );

  const story = parseLanguageStoryResponse(
    `Here is the JSON:\n${JSON.stringify({
      sentences: [
        {
          text: "Hola Ana.",
          clozeWord: "Hola",
          clozeBlank: "____ Ana.",
          clozeIndex: 0,
        },
      ],
    })}`,
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

test("language word bank normalizes nullable Prisma fields before response validation", async () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  const databaseWord = {
    id: "word-1",
    userId: "user-1",
    translationId: null,
    word: "hola",
    translation: "hello",
    translationLang: "en",
    sourceLang: "es",
    sourceContext: null,
    sourceType: "manual",
    sourceRefId: null,
    relatedWordIds: [],
    partOfSpeech: null,
    phonetic: null,
    meanings: [
      {
        definition: "a greeting",
        translation: null,
        example: null,
        partOfSpeech: null,
        category: null,
        register: null,
      },
      null,
    ],
    examples: [{ text: "Hola", translation: null }, null],
    category: null,
    difficulty: null,
    isPhrase: false,
    metadata: null,
    status: "legacy_saved",
    createdAt: now,
    updatedAt: now,
    stories: [],
  };
  const prisma = {
    languageWord: {
      findMany: async ({ where, select }: any) => {
        if (where?.category?.not === null) return [];
        if (select?.status) return [{ status: "captured" }];
        return [databaseWord];
      },
    },
  };

  const result = await listLanguageWords({
    prisma,
    userId: "user-1",
    limit: 50,
  });
  const parsed = LanguageWordsResponseSchema.parse(result);

  assert.equal(parsed.words[0]?.sourceContext, undefined);
  assert.equal(parsed.words[0]?.partOfSpeech, "unknown");
  assert.deepEqual(parsed.words[0]?.meanings, [{ definition: "a greeting" }]);
  assert.deepEqual(parsed.words[0]?.examples, [{ text: "Hola" }]);
  assert.equal(parsed.words[0]?.status, "captured");

  const fetchFactory = new FetchFactory((async () => ({
    success: true,
    data: JSON.parse(JSON.stringify(result)),
  })) as any);
  const pageResult = await fetchFactory.call(
    "GET",
    "/api/language/words",
    undefined,
    {},
    LanguageWordsResponseSchema,
  );
  assert.equal(pageResult.success, true);
});

test("language capture auto-enroll creates a due review card", async () => {
  const writes: any[] = [];
  const tx = {
    languageCardReview: {
      upsert: async (input: any) => {
        writes.push({ model: "languageCardReview", input });
      },
    },
    languageWord: {
      update: async (input: any) => {
        writes.push({ model: "languageWord", input });
      },
    },
  };
  const prisma = {
    $transaction: async (callback: any) => callback(tx),
  };

  const status = await maybeAutoEnrollLanguageWord({
    prisma,
    userId: "user-1",
    wordId: "word-1",
    currentStatus: "captured",
    autoEnroll: true,
  });

  assert.equal(status, "enrolled");
  assert.equal(writes[0]?.model, "languageCardReview");
  assert.equal(writes[0]?.input.where.userId_wordId.userId, "user-1");
  assert.equal(writes[0]?.input.where.userId_wordId.wordId, "word-1");
  assert.equal(writes[0]?.input.create.repetitions, 0);
  assert.ok(writes[0]?.input.create.nextReviewAt instanceof Date);
  assert.deepEqual(writes[1], {
    model: "languageWord",
    input: {
      where: { id: "word-1" },
      data: { status: "enrolled" },
    },
  });
});

test("language capture auto-enroll preserves mastered words", async () => {
  let transactionCalled = false;
  const prisma = {
    $transaction: async () => {
      transactionCalled = true;
    },
  };

  const status = await maybeAutoEnrollLanguageWord({
    prisma,
    userId: "user-1",
    wordId: "word-1",
    currentStatus: "mastered",
    autoEnroll: true,
  });

  assert.equal(status, "mastered");
  assert.equal(transactionCalled, false);
});

test("language review repository keeps word status aligned with mastery interval", async () => {
  const writes: any[] = [];
  const repository = new PrismaLanguageReviewRepository();
  const tx = {
    languageWord: {
      update: async (input: any) => {
        writes.push(input);
      },
    },
  };

  await repository.markMastered(tx, {
    id: "review-1",
    userId: "user-1",
    resourceId: "word-1",
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 1,
    nextReviewAt: new Date(),
    streak: 0,
  });

  await repository.markMastered(tx, {
    id: "review-1",
    userId: "user-1",
    resourceId: "word-1",
    easeFactor: 2.5,
    intervalDays: 21,
    repetitions: 4,
    nextReviewAt: new Date(),
    streak: 4,
  });

  assert.equal(writes[0]?.data.status, "enrolled");
  assert.equal(writes[1]?.data.status, "mastered");
});

test("language runtime owns word-bank filters without language-pair scoping", async () => {
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

  assert.equal(calls[0].targetLanguage, undefined);
  assert.equal(calls[0].nativeLanguage, undefined);
  assert.equal(calls[0].status, "captured");
  assert.equal(calls[0].category, "greeting");
  assert.equal(calls[0].hasStory, true);
  assert.equal(runtime.words.value[0]?.word, "hola");
  assert.deepEqual(runtime.categories.value, ["greeting"]);
  assert.equal(runtime.hasMore.value, true);
});

test("language runtime loads preferences before word and stats requests", async () => {
  const calls: any[] = [];
  const runtime = createLanguageLearningRuntime({
    api: {
      getPreferences: async () => ({
        success: true,
        data: {
          id: "prefs-1",
          userId: "user-1",
          enabled: true,
          targetLanguage: "fr",
          nativeLanguage: "en",
          autoEnroll: true,
          sessionCardLimit: 12,
          showConsent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      getWords: async (params: any) => {
        calls.push({ type: "words", params });
        return {
          success: true,
          data: { words: [], nextCursor: null, categories: [] },
        };
      },
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async (params: any) => {
        calls.push({ type: "stats", params });
        return {
          success: true,
          data: { total: 0, due: 0, enrolled: 0, mastered: 0 },
        };
      },
    },
  });

  await runtime.fetchWords();
  await runtime.refreshStats();

  assert.equal(calls[0]?.type, "words");
  assert.equal(calls[0]?.params.targetLanguage, undefined);
  assert.equal(calls[0]?.params.nativeLanguage, undefined);
  assert.equal(calls[1]?.type, "stats");
  assert.equal(calls[1]?.params?.targetLanguage, undefined);
  assert.equal(calls[1]?.params?.nativeLanguage, undefined);
});

test("language runtime does not language-filter the word bank when preferences are set", async () => {
  const calls: any[] = [];
  const runtime = createLanguageLearningRuntime({
    api: {
      getPreferences: async () => ({
        success: true,
        data: {
          id: "prefs-1",
          userId: "user-1",
          enabled: true,
          targetLanguage: "en",
          nativeLanguage: "en",
          autoEnroll: true,
          sessionCardLimit: 12,
          showConsent: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      getWords: async (params: any) => {
        calls.push(params);
        return {
          success: true,
          data: { words: [], nextCursor: null, categories: [] },
        };
      },
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 0, due: 0, enrolled: 0, mastered: 0 },
      }),
    },
  });

  await runtime.fetchWords();

  assert.equal(calls[0]?.targetLanguage, undefined);
  assert.equal(calls[0]?.nativeLanguage, undefined);
});

test("language runtime ignores stale word-bank responses", async () => {
  let releaseSlow: (() => void) | null = null;
  const slow = new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  let callIndex = 0;
  const runtime = createLanguageLearningRuntime({
    api: {
      getWords: async () => {
        callIndex += 1;
        const currentCall = callIndex;
        if (currentCall === 1) await slow;
        return {
          success: true,
          data: {
            words: [
              {
                id: `word-${currentCall}`,
                word: currentCall === 1 ? "stale" : "fresh",
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
        };
      },
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 0, due: 0, enrolled: 0, mastered: 0 },
      }),
    },
  });

  const firstFetch = runtime.fetchWords();
  await runtime.fetchWords();
  releaseSlow?.();
  await firstFetch;

  assert.equal(runtime.words.value[0]?.word, "fresh");
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

test("language runtime resets account-owned state on an account switch", () => {
  const runtime = createLanguageLearningRuntime({
    api: {
      getWords: async () => ({
        success: true,
        data: { words: [], nextCursor: null },
      }),
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 0, due: 0, enrolled: 0, mastered: 0 },
      }),
    },
  });

  runtime.setAccountScope("account-a");
  runtime.setPreferences({
    id: "prefs-a",
    userId: "account-a",
    enabled: true,
    targetLanguage: "es",
    nativeLanguage: "en",
    autoEnroll: true,
    sessionCardLimit: 12,
    showConsent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  runtime.setLatestCapture({
    word: "hola",
    translation: "hello",
    partOfSpeech: "interjection",
    detectedLang: "es",
    saved: false,
  });

  runtime.setAccountScope("account-b");

  assert.equal(runtime.preferences.value, null);
  assert.equal(runtime.latestCapture.value, null);
  assert.deepEqual(runtime.words.value, []);
});

test("offline language enrollment queues a full word and a remappable review projection", async () => {
  const suffix = `${Date.now()}-${Math.random()}`;
  const accountId = `language-account-${suffix}`;
  const wordId = `language-word-${suffix}`;
  const word = {
    id: wordId,
    word: "hola",
    translation: "hello",
    translationLang: "en",
    sourceLang: "es",
    sourceType: "manual",
    status: "captured" as const,
    stories: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await putOfflineEntities([
    {
      id: `${accountId}:languageWord:${wordId}`,
      accountId,
      entity: "languageWord",
      entityId: wordId,
      version: 3,
      updatedAt: Date.now(),
      data: word,
    },
  ]);
  const queued: any[] = [];
  const offline = {
    isOnline: ref(false),
    accountId: ref<string | null>(accountId),
    queue: async (input: any) => {
      queued.push(input);
      return {
        mutation: { id: `mutation-${queued.length}` },
        entityId: input.entityId,
      };
    },
  };
  const runtime = createLanguageLearningRuntime({
    offline: offline as any,
    api: {
      getWords: async () => ({
        success: true,
        data: { words: [], nextCursor: null },
      }),
      deleteWord: async () => ({ success: true, data: { message: "ok" } }),
      enrollWord: async (id: string) => ({
        success: true,
        data: { wordId: id, status: "enrolled" },
      }),
      getStats: async () => ({
        success: true,
        data: { total: 0, due: 0, enrolled: 0, mastered: 0 },
      }),
    },
  });

  await runtime.fetchWords();
  await runtime.enrollWord(wordId);

  assert.equal(queued[0]?.operation, "languageWord.enroll");
  assert.equal(queued[0]?.localData.word, "hola");
  assert.equal(queued[0]?.localData.status, "enrolled");
  assert.match(queued[0]?.payload.localReviewId, /^local:language-review:/);
  const reviews = await listOfflineEntities<Record<string, any>>(
    accountId,
    "languageReview",
  );
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]?.data.wordId, wordId);
  assert.equal(reviews[0]?.data.intervalDays, 0);
});

test("notes collaboration room names round-trip workspace and note ids", () => {
  const roomName = buildNoteCollabRoomName({
    workspaceId: "workspace-1",
    noteId: "note-1",
  });

  assert.equal(roomName, "workspace:workspace-1:note:note-1:body");
  assert.deepEqual(parseNoteCollabRoomName(roomName), {
    workspaceId: "workspace-1",
    noteId: "note-1",
  });
  assert.equal(
    parseNoteCollabRoomName("workspace:workspace-1:note:note-1:title"),
    null,
  );
});

test("notes collaboration tokens verify the expected room payload", () => {
  process.env.COLLAB_JWT_SECRET = "unit-test-collab-secret";
  const roomName = buildNoteCollabRoomName({
    workspaceId: "workspace-1",
    noteId: "note-1",
  });

  const token = signNoteCollabToken({
    userId: "user-1",
    workspaceId: "workspace-1",
    noteId: "note-1",
    roomName,
  });
  const verified = verifyNoteCollabToken(token);

  assert.equal(verified.userId, "user-1");
  assert.equal(verified.workspaceId, "workspace-1");
  assert.equal(verified.noteId, "note-1");
  assert.equal(verified.roomName, roomName);
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
