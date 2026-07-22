<template>
  <div class="board">
    <WorkspacePill class="board__wspill" />
    <header class="board__header">
      <ui-title tag="h1" class="board__title">Board</ui-title>
      <UiPill
        clickable
        size="sm"
        class-name="board__sync"
        :label="
          failedCount > 0
            ? `Retry (${failedCount})`
            : dirty
              ? 'Local'
              : 'Synced'
        "
        :color="
          failedCount > 0
            ? 'var(--color-error)'
            : dirty
              ? 'var(--color-success)'
              : 'var(--color-content-disabled)'
        "
        :variant="dirty || failedCount > 0 ? 'outline' : 'soft'"
        :active="dirty || failedCount > 0"
        max-width="120px"
        @click="onSyncTap"
      >
        <template #indicator>
          <UiPillIndicator
            :color="
              failedCount > 0
                ? 'var(--color-error)'
                : dirty
                  ? 'var(--color-success)'
                  : 'var(--color-content-disabled)'
            "
            size="sm"
            :class-name="dirty && failedCount === 0 ? 'ds-save-pulse' : ''"
          />
        </template>
      </UiPill>
      <UiIconButton
        icon="i-lucide-search"
        label="Search cards"
        @click="toggleSearch"
      />
      <UiIconButton
        :icon="overview ? 'i-lucide-columns-3' : 'i-lucide-layout-grid'"
        label="Toggle overview"
        :active="overview"
        :pressed="overview"
        @click="overview = !overview"
      />
      <UiIconButton
        icon="i-lucide-more-vertical"
        label="Board menu"
        @click="menuOpen = true"
      />
    </header>

    <UiInput
      v-if="searching"
      v-model="query"
      placeholder="Search cards…"
      icon="i-lucide-search"
      class="board__search"
      autofocus
    />

    <!-- SEARCH RESULTS (flat, across columns) -->
    <div v-if="searching && query.trim()" class="board__results">
      <p v-if="!searchResults.length" class="board__results-empty">
        No cards match “{{ query.trim() }}”.
      </p>
      <UiItemCard
        v-for="item in searchResults"
        :key="item.id"
        clickable
        size="sm"
        class-name="board__card"
        :title="cardText(item) || 'Untitled'"
        :subtitle="columnName(item.columnId)"
        :show-body="false"
        @click="openCard(item)"
      >
        <template v-if="tagsFor(item).length" #kicker>
          <UiPill
            v-for="t in tagsFor(item)"
            :key="t.name"
            size="sm"
            variant="fill"
            :label="t.name"
            :color="t.color"
            max-width="150px"
          />
        </template>
      </UiItemCard>
    </div>

    <!-- no workspace selected yet -->
    <div v-else-if="!activeId && !loading" class="board__empty">
      <UiIcon
        name="i-lucide-folder-open"
        class="h-10 w-10 text-content-disabled"
      />
      <p class="board__empty-title">Choose a workspace first</p>
      <UiButton tone="primary" to="/workspaces">Open workspaces</UiButton>
    </div>

    <!-- setup empty state -->
    <div v-else-if="!columns.length && !loading" class="board__empty">
      <UiIcon name="i-lucide-kanban" class="h-10 w-10 text-content-disabled" />
      <p class="board__empty-title">No board yet</p>
      <UiButton tone="primary" :loading="settingUp" @click="setupBoard"
        >Set up board</UiButton
      >
    </div>

    <!-- OVERVIEW: mini columns side by side -->
    <div v-else-if="overview" class="board__overview">
      <div v-for="col in columns" :key="col.id" class="board__mini">
        <p class="board__mini-head">
          {{ col.name }} <span>{{ itemsByColumn(col.id).length }}</span>
        </p>
        <div
          v-for="item in itemsByColumn(col.id)"
          :key="item.id"
          class="board__mini-card"
          :class="{ 'board__mini-card--done': isDoneColumn(col) }"
        >
          <span
            class="board__mini-bar"
            :style="{ background: itemColor(item) }"
          />
          <span class="board__mini-text">{{
            cardText(item) || "Untitled"
          }}</span>
        </div>
      </div>
    </div>

    <!-- PAGER: one column at a time -->
    <template v-else>
      <nav class="board__tabs" role="tablist">
        <UiPill
          v-for="(col, i) in columns"
          :key="col.id"
          clickable
          variant="outline"
          :active="i === activeIndex"
          :label="col.name"
          color="var(--color-primary)"
          role="tab"
          :aria-selected="i === activeIndex"
          max-width="180px"
          @click="activeIndex = i"
        >
          <template #icon>
            <span class="board__tab-count">{{
              itemsByColumn(col.id).length
            }}</span>
          </template>
        </UiPill>
      </nav>

      <div v-if="activeColumn" ref="cardsEl" class="board__cards">
        <UiItemCard
          v-for="item in activeItems"
          :key="item.id"
          clickable
          class-name="board__card"
          :class="{ 'board__card--dragging': draggingId === item.id }"
          :title="cardText(item) || 'Untitled'"
          :show-body="false"
          @pointerdown="onPointerDown($event, item)"
          @click="(event) => onBoardCardActivate(event, item)"
        >
          <template v-if="cardStatus(item)" #actions>
            <UiPill
              v-if="cardStatus(item) === 'error'"
              clickable
              size="sm"
              label="Retry"
              color="var(--color-error)"
              variant="outline"
              active
              max-width="84px"
              @click.stop="retry(item)"
            >
              <template #icon>
                <UiPillIcon name="i-lucide-rotate-cw" size="sm" />
              </template>
            </UiPill>
            <UiPill
              v-else
              size="sm"
              label="Local"
              color="var(--color-success)"
              variant="outline"
              active
              max-width="76px"
            >
              <template #indicator>
                <UiPillIndicator
                  color="var(--color-success)"
                  size="sm"
                  class-name="ds-save-pulse"
                />
              </template>
            </UiPill>
          </template>

          <template v-if="tagsFor(item).length" #kicker>
            <UiPill
              v-for="t in tagsFor(item)"
              :key="t.name"
              size="sm"
              variant="fill"
              :label="t.name"
              :color="t.color"
              max-width="150px"
            />
          </template>

          <template v-if="cardMeta(item)" #footer>
            <span class="board__card-meta">{{ cardMeta(item) }}</span>
          </template>
        </UiItemCard>

        <button type="button" class="board__add" @click="addCard($event)"> <!-- design-allow: native dashed add control -->
          <UiIcon name="i-lucide-plus" class="h-4 w-4" /> Add a card
        </button>
      </div>

      <!-- position indicator -->
      <div class="board__dots" aria-hidden="true">
        <span
          v-for="(c, i) in columns"
          :key="c.id"
          class="board__dot"
          :class="{ 'board__dot--on': i === activeIndex }"
        />
      </div>
    </template>

    <BoardCardSheet
      v-model:open="sheetOpen"
      :item="sheetItem"
      :columns="columns"
      :tags="allTags"
      :default-column-id="activeColumn?.id ?? null"
      :create-tag="createTag"
      :live="liveMode"
      :morphing="morphing"
      @save="onSaveCard"
      @live-update="onLiveUpdate"
      @open-full="onOpenFull"
      @delete="onDeleteCard"
      @closed="finalizeLiveCard"
    />

    <BoardColumnsSheet
      v-model:open="columnsOpen"
      :columns="columns"
      @create="onColCreate"
      @rename="onColRename"
      @delete="onColDelete"
      @reorder="onColReorder"
    />

    <!-- board menu -->
    <UiSheet v-model:open="menuOpen" title="Board">
      <div class="board-menu">
        <UiListCard
          clickable
          variant="soft"
          title="Manage columns"
          @click="openColumns"
        >
          <template #leading>
            <UiIcon name="i-lucide-columns-3" class="h-5 w-5" />
          </template>
        </UiListCard>
        <UiListCard
          clickable
          variant="soft"
          :disabled="syncing"
          :title="
            failedCount > 0 ? `Retry failed (${failedCount})` : 'Sync now'
          "
          @click="onSyncTap"
        >
          <template #leading>
            <UiIcon
              :name="
                failedCount > 0 ? 'i-lucide-rotate-cw' : 'i-lucide-refresh-cw'
              "
              class="h-5 w-5"
            />
          </template>
        </UiListCard>
      </div>
    </UiSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from "vue";
import BoardCardSheet from "~/features/board/components/BoardCardSheet.vue";
import BoardColumnsSheet from "~/features/board/components/BoardColumnsSheet.vue";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import { tagColorVar } from "~/composables/useAccentColor";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
import { useViewTransitionMorph } from "~/composables/ui/useViewTransitionMorph";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { designTokenValues } from "~/design-system/tokens.generated";
import type { BoardItemState } from "~/features/board/composables/useBoardItemsStore";
import type { BoardColumnState } from "~/features/board/composables/useBoardColumnsStore";
import { useQuickBoardItemCapture } from "~/features/board/composables/useQuickBoardItemCapture";
import { comparePosition } from "@@/shared/utils/position-key";

const route = useRoute();
const { activeId } = useActiveWorkspace();

const columnsStore = computed(() =>
  activeId.value ? useBoardColumnsStore(activeId.value) : null,
);
const itemsStore = computed(() =>
  activeId.value ? useBoardItemsStore(activeId.value) : null,
);
const tagsStore = computed(() =>
  activeId.value ? useUserTagsStore(activeId.value) : null,
);
const offlineRuntime = useOfflineRuntime();
const boardMutationCount = ref(0);

async function refreshBoardMutationCount() {
  const workspaceId = activeId.value;
  if (!workspaceId) {
    boardMutationCount.value = 0;
    return;
  }
  const mutations = await offlineRuntime.mutationsList();
  boardMutationCount.value = mutations.filter(
    (mutation) =>
      mutation.workspaceId === workspaceId &&
      ["boardItem", "boardColumn", "boardComment", "boardLink"].includes(
        mutation.entity,
      ) &&
      ["pending", "syncing", "retry", "blocked", "conflict", "rejected"].includes(
        mutation.status,
      ),
  ).length;
}

const activeIndex = ref(0);
const overview = ref(false);
const loading = ref(true);
const settingUp = ref(false);
const syncing = ref(false);
const lastComposeToken = ref("");

const sheetOpen = ref(false);
const columnsOpen = ref(false);
const menuOpen = ref(false);
const editingItem = ref<BoardItemState | null>(null);
const allTags = computed(() =>
  Array.from(tagsStore.value?.tags.value.values() ?? []),
);

const searching = ref(false);
const query = ref("");

const columns = computed(() => columnsStore.value?.getOrderedColumns() ?? []);
const activeColumn = computed(() => columns.value[activeIndex.value] ?? null);
const allItems = computed(() =>
  Array.from(itemsStore.value?.items.value.values() ?? []),
);
const dirty = computed(() =>
  Boolean(
    itemsStore.value &&
    (boardMutationCount.value > 0 ||
      allItems.value.some((i) => i.isDirty) ||
      columns.value.some((column) => column.isDirty)),
  ),
);
const failedCount = computed(
  () =>
    allItems.value.filter((i) => Boolean(i.error)).length +
    columns.value.filter((column) => Boolean(column.error)).length,
);

function itemsByColumn(columnId: string) {
  return allItems.value
    .filter((i) => i.columnId === columnId)
    .sort(comparePosition);
}
function columnName(columnId: string | null | undefined) {
  return columns.value.find((c) => c.id === columnId)?.name ?? "Unassigned";
}
function isDoneColumn(col: { name: string }) {
  return /done/i.test(col.name);
}
function tagsFor(item: { tags?: string[] }) {
  return (item.tags ?? []).map((t) => {
    const tag = tagsStore.value?.getTag(t) ?? tagsStore.value?.getTagByName(t);
    const name = tag?.name ?? t;
    return { name, color: tagColorVar({ name, color: tag?.color ?? null }) };
  });
}
function itemColor(item: { tags?: string[] }) {
  return tagsFor(item)[0]?.color ?? "var(--color-border-strong)";
}
function formatDue(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
function cardMeta(item: { dueDate?: string | Date | null }) {
  return item.dueDate ? `Due ${formatDue(item.dueDate)}` : "";
}
function cardText(item: { content?: string }) {
  return (item.content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function cardStatus(item: BoardItemState): "error" | "local" | null {
  if (item.error) return "error";
  if (item.isDirty) return "local";
  return null;
}

// ── Search ───────────────────────────────────────────────────────────────────
function toggleSearch() {
  searching.value = !searching.value;
  if (!searching.value) query.value = "";
}
const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return allItems.value.filter((i) => cardText(i).toLowerCase().includes(q));
});

// ── Card edit ─────────────────────────────────────────────────────────────────
function openCard(item: BoardItemState) {
  editingItem.value = item;
  liveMode.value = false;
  sheetOpen.value = true;
}
function onBoardCardActivate(
  event: MouseEvent | KeyboardEvent,
  item: BoardItemState,
) {
  if (event instanceof KeyboardEvent) openCard(item);
}

// ── Quick capture (create-first, morph from the Add button) ──────────────────
const { morph, armMorphTarget, morphing } = useViewTransitionMorph();
const liveMode = ref(false);
let liveTriggerEl: HTMLElement | null = null;
let liveFinalized = false;
const quickCaptureDefaultColumnId = computed(
  () => activeColumn.value?.id ?? null,
);
const boardQuickCapture = useQuickBoardItemCapture(
  itemsStore,
  quickCaptureDefaultColumnId,
);

// The live item, following the temp→server id swap.
const liveItem = boardQuickCapture.item;
/** The id to use for store mutations (the real id once reconciled). */
const liveRealId = computed(() => boardQuickCapture.itemId.value || null);
const sheetItem = computed(() =>
  liveMode.value ? liveItem.value : editingItem.value,
);

async function addCard(event?: MouseEvent) {
  const store = itemsStore.value;
  if (!store || liveMode.value) return;
  // currentTarget is only valid synchronously — capture before any await.
  const trigger = (event?.currentTarget as HTMLElement | null) ?? null;
  await boardQuickCapture.begin();
  editingItem.value = null;
  liveMode.value = true;
  liveFinalized = false;
  liveTriggerEl = trigger;
  await morph({
    from: trigger,
    update: () => {
      sheetOpen.value = true;
    },
  });
}

function firstQueryValue(value: typeof route.query.compose) {
  return Array.isArray(value) ? value[0] : value;
}

async function consumeComposeRoute(value: typeof route.query.compose) {
  const compose = firstQueryValue(value);
  if (compose !== "card" || !itemsStore.value) return;

  const token = `${compose}:${route.query.capture ?? ""}:${activeId.value ?? ""}`;
  if (lastComposeToken.value === token) return;
  lastComposeToken.value = token;

  await addCard();
}

type LivePayload = {
  content: string;
  tags: string[];
  columnId: string | null;
  dueDate: string | null;
};

function onLiveUpdate(payload: LivePayload) {
  boardQuickCapture.onPayload(payload);
}

/** Open the card in its own place — the sheet morphs into /board/[id]. */
async function onOpenFull(payload: LivePayload) {
  // Explicit intent to edit in full: create now even if nothing is typed yet.
  boardQuickCapture.onPayload(payload);
  const id =
    (await boardQuickCapture.ensureCreated(true)) ?? liveRealId.value;
  if (!id) return;
  if (!(await boardQuickCapture.commitNow())) return;
  boardQuickCapture.markFinalized();
  liveFinalized = true; // navigating away — never delete, even if still empty
  armMorphTarget();
  await morph({
    update: async () => {
      sheetOpen.value = false;
      await navigateTo(`/board/${id}`);
    },
  });
}

/** After the live sheet closes (any path): keep real cards, drop empty drafts. */
async function finalizeLiveCard() {
  if (!liveMode.value || liveFinalized) return;
  liveFinalized = true;
  await boardQuickCapture.finalize();
  liveMode.value = false;
  liveTriggerEl = null;
}

async function onSaveCard(payload: {
  content: string;
  tags: string[];
  columnId: string | null;
  dueDate: string | null;
}) {
  const store = itemsStore.value;
  if (!store) return;
  if (liveMode.value) {
    boardQuickCapture.onPayload(payload);
    liveFinalized = true;
    await boardQuickCapture.finalize();
    await morph({
      to: liveTriggerEl?.isConnected ? liveTriggerEl : null,
      update: () => {
        sheetOpen.value = false;
      },
    });
    liveMode.value = false;
    liveTriggerEl = null;
    return;
  }
  if (editingItem.value) {
    const prev = editingItem.value;
    await store.updateItem(prev.id, {
      ...prev,
      content: payload.content,
      tags: payload.tags,
      dueDate: payload.dueDate,
    });
    if (payload.columnId !== (prev.columnId ?? null)) {
      await store.moveItemToColumn(prev.id, payload.columnId);
    }
  } else {
    await store.createItem(
      payload.content,
      payload.tags,
      payload.columnId,
      payload.dueDate,
    );
  }
  sheetOpen.value = false;
  editingItem.value = null;
}
async function onDeleteCard() {
  if (editingItem.value && itemsStore.value)
    await itemsStore.value.deleteItem(editingItem.value.id);
  sheetOpen.value = false;
  editingItem.value = null;
}
async function retry(item: BoardItemState) {
  await itemsStore.value?.retryFailedItem(item.id);
}

// ── Tags ──────────────────────────────────────────────────────────────────────
async function createTag(
  name: string,
  colorToken: string,
): Promise<string | null> {
  // Tag colors are stored as hex; resolve the chosen accent token to its value
  // (falling back to the blue accent token's value — never a literal hex).
  const tokens = designTokenValues as Record<string, string>;
  const hex = tokens[colorToken] ?? tokens["--color-accent-blue"];
  return (await tagsStore.value?.createTag(name, hex)) ?? null;
}

// ── Columns ─────────────────────────────────────────────────────────────────
function openColumns() {
  menuOpen.value = false;
  columnsOpen.value = true;
}
async function onColCreate(name: string) {
  await columnsStore.value?.createColumn(name);
}
function onColRename(payload: { id: string; name: string }) {
  columnsStore.value?.updateColumn(payload.id, payload.name);
}
async function onColDelete(id: string) {
  await columnsStore.value?.deleteColumn(id);
  if (activeIndex.value >= columns.value.length) {
    activeIndex.value = Math.max(0, columns.value.length - 1);
  }
}
function onColReorder(ordered: { id: string; name: string }[]) {
  const byId = new Map(columns.value.map((c) => [c.id, c]));
  const full = ordered
    .map((c, idx) => {
      const col = byId.get(c.id);
      return col ? ({ ...col, order: idx } as BoardColumnState) : null;
    })
    .filter((c): c is BoardColumnState => c !== null);
  columnsStore.value?.reorderColumns(full);
}

// ── Drag-to-reorder within the active column (with the -2° lift) ──────────────
const cardsEl = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);
const dragOrder = ref<BoardItemState[] | null>(null);
const activeItems = computed(
  () =>
    dragOrder.value ??
    (activeColumn.value ? itemsByColumn(activeColumn.value.id) : []),
);

let drag: {
  id: string;
  startX: number;
  startY: number;
  started: boolean;
  pointerId: number;
  moved: boolean;
} | null = null;

function onPointerDown(e: PointerEvent, item: BoardItemState) {
  if (e.button != null && e.button !== 0) return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  const current =
    e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
  const nestedControl = target?.closest(
    "button,a,input,select,textarea,[contenteditable='true']",
  );
  if (nestedControl && nestedControl !== current) return;

  drag = {
    id: item.id,
    startX: e.clientX,
    startY: e.clientY,
    started: false,
    pointerId: e.pointerId,
    moved: false,
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
}
function onPointerMove(e: PointerEvent) {
  if (!drag || !activeColumn.value) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.started) {
    if (Math.hypot(dx, dy) < 8) return; // tap, not a drag
    drag.started = true;
    drag.moved = true;
    // Drop any text selection the press may have begun before the drag kicked in.
    window.getSelection?.()?.removeAllRanges();
    draggingId.value = drag.id;
    dragOrder.value = itemsByColumn(activeColumn.value.id).slice();
  }
  const to = targetIndexAt(e.clientY);
  const arr = dragOrder.value;
  if (!arr) return;
  const from = arr.findIndex((x) => x.id === drag!.id);
  if (from === -1 || to === -1 || to === from) return;
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  dragOrder.value = next;
}
function targetIndexAt(clientY: number): number {
  const host = cardsEl.value;
  if (!host) return -1;
  const cards = Array.from(host.querySelectorAll<HTMLElement>(".board__card"));
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i]!.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return cards.length - 1;
}
async function onPointerUp() {
  window.removeEventListener("pointermove", onPointerMove);
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.started && dragOrder.value && activeColumn.value) {
    // Pass the dragged sequence; the store assigns fractional ranks (a single
    // changed item) and persists the minimal diff.
    const sequence = dragOrder.value.slice();
    draggingId.value = null;
    await itemsStore.value?.reorderItemsInColumn(
      activeColumn.value.id,
      sequence,
    );
    dragOrder.value = null;
  } else {
    // treat as a tap → open the card
    const item = allItems.value.find((x) => x.id === d.id);
    draggingId.value = null;
    dragOrder.value = null;
    if (item) openCard(item);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────
async function onSyncTap() {
  if (syncing.value || !itemsStore.value || !columnsStore.value) return;
  syncing.value = true;
  menuOpen.value = false;
  try {
    if (failedCount.value > 0) {
      for (const item of allItems.value.filter((i) => i.error)) {
        await itemsStore.value.retryFailedItem(item.id);
      }
    }
    await Promise.all([
      itemsStore.value.syncWithServer(),
      columnsStore.value.syncWithServer(),
    ]);
    await refreshBoardMutationCount();
  } finally {
    syncing.value = false;
  }
}

async function setupBoard() {
  if (!columnsStore.value) return;
  settingUp.value = true;
  try {
    for (const name of ["To do", "Doing", "Done"]) {
      await columnsStore.value.createColumn(name);
    }
  } finally {
    settingUp.value = false;
  }
}

async function loadBoard() {
  if (
    !activeId.value ||
    !columnsStore.value ||
    !itemsStore.value ||
    !tagsStore.value
  ) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await columnsStore.value.syncWithServer();
    await itemsStore.value.syncWithServer();
    await tagsStore.value.loadTags();
    await refreshBoardMutationCount();
  } finally {
    loading.value = false;
  }
}

watch(activeId, () => {
  activeIndex.value = 0;
  void loadBoard();
});

watch(
  [() => route.query.compose, () => route.query.capture, activeId],
  ([compose]) => {
    void consumeComposeRoute(compose);
  },
);

watch(columns, (next) => {
  if (activeIndex.value >= next.length) {
    activeIndex.value = Math.max(0, next.length - 1);
  }
});

onMounted(async () => {
  window.addEventListener("offline-v2-mutation-queued", refreshBoardMutationCount);
  window.addEventListener("offline-v2-sync-result", refreshBoardMutationCount);
  await loadBoard();
  await consumeComposeRoute(route.query.compose);
});
onBeforeUnmount(() => {
  window.removeEventListener("offline-v2-mutation-queued", refreshBoardMutationCount);
  window.removeEventListener("offline-v2-sync-result", refreshBoardMutationCount);
});
</script>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-8);
  min-height: calc(100dvh - 74px + env(safe-area-inset-bottom));
  background: var(--color-surface-subtle);
}

.board__wspill {
  align-self: flex-start;
  margin-top: var(--space-2);
}

.board__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.board__title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}

.board__sync {
  margin-left: auto;
}

.board__results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.board__results-empty {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  font-size: 14px;
  color: var(--color-content-secondary);
}

.board__tabs {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
}

.board__tab-count {
  font-size: 11px;
  font-weight: 600;
}

.board__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.board__card {
  touch-action: pan-y;
  /* Cards are tap-to-edit drag handles, not prose — never let a drag start a
     text selection (or the iOS long-press selection callout). */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.board__card--dragging {
  transform: rotate(-2deg) scale(1.02);
  box-shadow: var(--shadow-card-hover);
  z-index: 2;
}

.board__card-meta {
  font-size: 11px;
  color: var(--color-content-secondary);
}

.board__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1.5px dashed var(--color-border-strong);
  color: var(--color-content-secondary);
  font-size: 14px;
  font-weight: 600;
}

.board__dots {
  display: flex;
  gap: 5px;
  margin-top: auto;
  padding-top: var(--space-4);
}

.board__dot {
  flex: 1;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
}

.board__dot--on {
  background: var(--color-primary);
}

.board__overview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.board__mini {
  border-radius: var(--radius-xl);
  padding: var(--space-2);
  background: var(--color-surface-subtle);
}

.board__mini-head {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--color-content-secondary);
  margin-bottom: var(--space-2);
  display: flex;
  justify-content: space-between;
}

.board__mini-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  margin-bottom: 6px;
  border-radius: var(--radius-md);
  background: var(--color-background);
  box-shadow: var(--shadow-card);
}

.board__mini-card--done {
  opacity: 0.55;
}

.board__mini-card--done .board__mini-text {
  text-decoration: line-through;
}

.board__mini-bar {
  width: 3px;
  align-self: stretch;
  border-radius: var(--radius-full);
}

.board__mini-text {
  font-size: 11px;
  line-height: 1.3;
  color: var(--color-content-on-surface);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.board__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex: 1;
  text-align: center;
}

.board__empty-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--color-content-on-surface-strong);
}

.board-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}

@media (prefers-reduced-motion: reduce) {
  .board__card--dragging {
    transform: none;
  }
}
</style>
