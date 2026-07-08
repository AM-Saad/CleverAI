import { computed, nextTick, ref, type Ref } from "vue";
import type { BoardItemState } from "~/features/board/composables/useBoardItemsStore";

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

export function useQuickBoardItemCapture(
  store: Ref<BoardItemsStore | null>,
  defaultColumnId: Ref<string | null>,
) {
  const sourceId = ref<string | null>(null);

  let pending = emptyPayload(defaultColumnId.value);
  let createPromise: Promise<string | null> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let finalized = false;

  const item = computed<BoardItemState | null>(() => {
    const s = store.value;
    const id = sourceId.value;
    if (!s || !id) return null;
    return (
      s.items.value.get(id) ??
      s.items.value.get(s.resolveItemId(id) ?? "") ??
      null
    );
  });

  const itemId = computed(() => item.value?.id ?? sourceId.value ?? "");

  function begin() {
    cancelPendingSave();
    sourceId.value = null;
    pending = emptyPayload(defaultColumnId.value);
    createPromise = null;
    finalized = false;
  }

  function payloadWithDefaultColumn(payload = pending): BoardItemPayload {
    return {
      ...payload,
      columnId: payload.columnId ?? defaultColumnId.value ?? null,
    };
  }

  function ensureCreated(allowEmpty = false): Promise<string | null> {
    if (sourceId.value) return Promise.resolve(itemId.value);
    const s = store.value;
    const payload = payloadWithDefaultColumn();
    if (!s || (!allowEmpty && !hasContent(payload))) return Promise.resolve(null);

    if (!createPromise) {
      createPromise = s
        .createItem(payload.content, payload.tags, payload.columnId, payload.dueDate)
        .then((id) => {
          if (id) sourceId.value = id;
          return id;
        })
        .finally(() => {
          createPromise = null;
        });
    }

    return createPromise;
  }

  function cancelPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void commitNow(), 500);
  }

  async function commitNow() {
    cancelPendingSave();
    const s = store.value;
    const current = item.value;
    const id = itemId.value;
    if (!s || !current || !id) return;

    const payload = payloadWithDefaultColumn();
    await s.updateItem(id, {
      ...current,
      content: payload.content,
      tags: payload.tags,
      dueDate: payload.dueDate,
      updatedAt: new Date(),
    });
    if (payload.columnId !== (current.columnId ?? null)) {
      await s.moveItemToColumn(id, payload.columnId);
    }
  }

  function onContent(content: string) {
    pending = payloadWithDefaultColumn({ ...pending, content });
    if (!sourceId.value) {
      if (hasContent(pending)) void ensureCreated();
      return;
    }
    scheduleSave();
  }

  async function finalize() {
    if (finalized) return;
    finalized = true;
    if (createPromise) {
      await createPromise;
      await nextTick();
    }

    const s = store.value;
    const current = item.value;
    const id = itemId.value;
    if (!s || !current || !id) {
      sourceId.value = null;
      return;
    }

    const hasMeta = (current.tags?.length ?? 0) > 0 || Boolean(current.dueDate);
    if (hasContent({ ...pending, content: current.content }) || hasMeta) {
      await commitNow();
    } else {
      cancelPendingSave();
      await s.deleteItem(id);
    }
    sourceId.value = null;
  }

  function markFinalized() {
    finalized = true;
  }

  return {
    item,
    itemId,
    begin,
    ensureCreated,
    onContent,
    commitNow,
    finalize,
    markFinalized,
  };
}
