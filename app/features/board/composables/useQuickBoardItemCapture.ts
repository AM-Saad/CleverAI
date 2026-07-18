import {
  computed,
  nextTick,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
} from "vue";
import { createQuickCaptureSessionController } from "../../../composables/shared/quickCaptureSession";
import type { BoardItemState } from "./useBoardItemsStore";

type BoardItemsStore = ReturnType<typeof useBoardItemsStore>;

type BoardItemPayload = {
  content: string;
  tags: string[];
  columnId: string | null;
  dueDate: string | null;
};

function emptyPayload(columnId: string | null): BoardItemPayload {
  return {
    content: "",
    tags: [],
    columnId,
    dueDate: null,
  };
}

function hasContent(payload: BoardItemPayload) {
  return payload.content.replace(/<[^>]*>/g, "").trim().length > 0;
}

function payloadsMatch(left: BoardItemPayload, right: BoardItemPayload) {
  return (
    left.content === right.content &&
    left.columnId === right.columnId &&
    left.dueDate === right.dueDate &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags)
  );
}

export function useQuickBoardItemCapture(
  store: Ref<BoardItemsStore | null>,
  defaultColumnId: Ref<string | null>,
) {
  const sourceId = ref<string | null>(null);
  const sessionStore = shallowRef<BoardItemsStore | null>(null);

  let pending = emptyPayload(defaultColumnId.value);
  let createPromise: Promise<string | null> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let draftRevision = 0;
  let durableRevision = 0;
  let commitPromise: Promise<boolean> | null = null;
  const session = createQuickCaptureSessionController();

  const item = computed<BoardItemState | null>(() => {
    const s = sessionStore.value;
    const id = sourceId.value;
    if (!s || !id) return null;
    return (
      s.items.value.get(id) ??
      s.items.value.get(s.resolveItemId(id) ?? "") ??
      null
    );
  });

  const itemId = computed(() => item.value?.id ?? sourceId.value ?? "");

  async function begin() {
    await session.begin(finalize, () => {
      cancelPendingSave();
      sourceId.value = null;
      sessionStore.value = store.value;
      pending = emptyPayload(defaultColumnId.value);
      createPromise = null;
      draftRevision = 0;
      durableRevision = 0;
      commitPromise = null;
    });
  }

  function payloadWithDefaultColumn(payload = pending): BoardItemPayload {
    return {
      ...payload,
      columnId: payload.columnId ?? defaultColumnId.value ?? null,
    };
  }

  function ensureCreated(allowEmpty = false): Promise<string | null> {
    if (sourceId.value) return Promise.resolve(itemId.value);
    const s = sessionStore.value;
    const payload = payloadWithDefaultColumn();
    if (!s || (!allowEmpty && !hasContent(payload)))
      return Promise.resolve(null);

    if (!createPromise) {
      const createRevision = draftRevision;
      const generation = session.currentGeneration();
      const task = s
        .createItem(
          payload.content,
          payload.tags,
          payload.columnId,
          payload.dueDate,
        )
        .then((id) => {
          if (id && session.isCurrent(generation)) {
            sourceId.value = id;
            durableRevision = Math.max(durableRevision, createRevision);
            if (draftRevision > durableRevision) scheduleSave();
          }
          return id;
        })
        .finally(() => {
          if (createPromise === task) createPromise = null;
        });
      createPromise = task;
    }

    return createPromise;
  }

  function cancelPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }
  onScopeDispose(cancelPendingSave);

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void commitNow(), 500);
  }

  async function commitNow(): Promise<boolean> {
    cancelPendingSave();
    while (durableRevision < draftRevision) {
      if (commitPromise) {
        if (!(await commitPromise)) return false;
        continue;
      }
      const s = sessionStore.value;
      const current = item.value;
      const id = itemId.value;
      if (!s || !current || !id) return false;
      const targetRevision = draftRevision;
      const payload = payloadWithDefaultColumn();
      const task = (async () => {
        const updated = await s.updateItem(id, {
          ...current,
          content: payload.content,
          tags: payload.tags,
          dueDate: payload.dueDate,
          updatedAt: new Date(),
        });
        if (!updated) return false;
        // updateItem intentionally debounces ordinary editor traffic. A capture
        // commit/finalize is a durability boundary, so force this item into the
        // V2 outbox before reporting that the draft revision is saved.
        await s.flushItem(id);
        if (payload.columnId !== (current.columnId ?? null)) {
          if (!(await s.moveItemToColumn(id, payload.columnId))) return false;
        }
        durableRevision = Math.max(durableRevision, targetRevision);
        return true;
      })().finally(() => {
        if (commitPromise === task) commitPromise = null;
      });
      commitPromise = task;
      if (!(await task)) return false;
    }
    return true;
  }

  function onContent(content: string) {
    onPayload({ ...pending, content });
  }

  function onPayload(payload: BoardItemPayload) {
    const next = payloadWithDefaultColumn(payload);
    if (payloadsMatch(pending, next)) return;
    draftRevision += 1;
    pending = next;
    if (!sourceId.value) {
      if (hasContent(pending)) void ensureCreated();
      return;
    }
    scheduleSave();
  }

  function finalize(): Promise<void> {
    return session.finalize(async (finalizingGeneration) => {
      const pendingCreate = createPromise;
      if (pendingCreate) {
        await pendingCreate;
        await nextTick();
      }
      if (!session.isCurrent(finalizingGeneration)) return;

      const s = sessionStore.value;
      const current = item.value;
      const id = itemId.value;
      if (!s || !current || !id) {
        sourceId.value = null;
        return;
      }

      const hasMeta =
        pending.tags.length > 0 || Boolean(pending.dueDate);
      if (hasContent(pending) || hasMeta) {
        await commitNow();
      } else {
        cancelPendingSave();
        await s.deleteItem(id);
      }
      if (session.isCurrent(finalizingGeneration)) sourceId.value = null;
    });
  }

  function markFinalized() {
    session.markFinalized();
  }

  return {
    item,
    itemId,
    begin,
    ensureCreated,
    onContent,
    onPayload,
    commitNow,
    finalize,
    markFinalized,
  };
}
