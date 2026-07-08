<template>
  <div class="bd" :style="morphTargetStyle">
    <template v-if="item">
      <!-- top bar -->
      <header class="bd__bar">
        <UiIconButton
          icon="i-lucide-chevron-left"
          label="Back to board"
          @click="goBack"
        />
        <SyncBadge :state="item.isDirty ? 'local' : 'synced'" />
        <div class="bd__bar-actions">
          <UiIconButton
            icon="i-lucide-more-horizontal"
            label="More"
            @click="moreOpen = true"
          />
        </div>
      </header>

      <!-- rich content (shared Tiptap editor, same as the desktop panel) -->
      <div class="bd__editor">
        <TextNote
          :note="item"
          :is-board-item="true"
          placeholder="What needs doing?"
          :delete-note="() => deleteCard()"
          @update="onContentUpdate"
          @retry="onRetry"
        />
      </div>

      <!-- meta -->
      <section class="bd__meta">
        <p class="bd__label">COLUMN</p>
        <div class="bd__pills">
          <UiPill
            v-for="c in columns"
            :key="c.id"
            clickable
            selectable
            variant="outline"
            color="var(--color-primary)"
            :active="(item.columnId ?? null) === c.id"
            :label="c.name"
            max-width="170px"
            @click="setColumn(c.id)"
          />
        </div>

        <p class="bd__label">TAGS</p>
        <div class="bd__pills">
          <UiPill
            v-for="t in allTags"
            :key="t.id"
            clickable
            selectable
            :variant="hasTag(t.id) ? 'fill' : 'outline'"
            :active="hasTag(t.id)"
            :label="t.name"
            :color="tagColor(t)"
            size="sm"
            max-width="150px"
            @click="toggleTag(t.id)"
          />
          <p v-if="!allTags.length" class="bd__empty-hint">
            No tags yet — create them from the board's card sheet.
          </p>
        </div>

        <p class="bd__label">DUE DATE</p>
        <UiInput
          :model-value="dueInput"
          type="date"
          @update:model-value="setDue(String($event ?? ''))"
        />
      </section>

      <!-- actions (⋯) -->
      <UiSheet v-model:open="moreOpen" title="Card actions">
        <div class="bd__actions">
          <UiDoubleTapDeleteButton
            unstyled
            class="bd__actions-row"
            label="Delete card"
            armed-label="Tap again to delete card"
            :reset-key="item.id"
            @confirm="deleteCard"
          >
            <template #default="{ label }">
              <UiIcon name="i-lucide-trash-2" class="h-5 w-5" />
              {{ label }}
            </template>
          </UiDoubleTapDeleteButton>
        </div>
      </UiSheet>
    </template>

    <div v-else class="bd__missing">
      <UiIcon name="i-lucide-file-x" class="h-9 w-9 text-content-disabled" />
      <p>Card not found.</p>
      <UiButton pill @click="goBack">Back to board</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * /board/[id] — a board item's own place on mobile (mirrors /notes/[id]):
 * rich Tiptap content via the shared TextNote editor, plus column/tags/due
 * meta. Reached from a card's "Open full" in quick capture or deep links.
 */
import { ref, computed, watch, onMounted } from "vue";
import TextNote from "~/features/notes/components/TextNote.vue";
import SyncBadge from "~/components/shell/SyncBadge.vue";
import { tagColorVar } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useViewTransitionMorph } from "~/composables/ui/useViewTransitionMorph";
import type { BoardItemState } from "~/features/board/composables/useBoardItemsStore";
import type { UserTagState } from "~/composables/tags/useUserTagsStore";

const route = useRoute();
const toast = useToast();
const { activeId } = useActiveWorkspace();
// Carries the quick-capture morph name on the page root when the navigation
// came from the sheet's "Open full" (one-shot, self-clearing).
const { morphTargetStyle } = useViewTransitionMorph();

const itemsStore = computed(() =>
  activeId.value ? useBoardItemsStore(activeId.value) : null,
);
const columnsStore = computed(() =>
  activeId.value ? useBoardColumnsStore(activeId.value) : null,
);
const tagsStore = computed(() =>
  activeId.value ? useUserTagsStore(activeId.value) : null,
);

const routeId = computed(() => String(route.params.id));
// Resolve temp→real ids: an optimistic item's temp id is swapped for the
// server id after reconcile, so look up directly, then via the alias map.
const item = computed<BoardItemState | null>(() => {
  const s = itemsStore.value;
  if (!s) return null;
  return (
    s.items.value.get(routeId.value) ??
    s.items.value.get(s.resolveItemId(routeId.value) ?? "") ??
    null
  );
});
/** The id to use for store mutations (the real id once reconciled). */
const itemId = computed(() => item.value?.id ?? routeId.value);

const columns = computed(() => columnsStore.value?.getOrderedColumns() ?? []);
const allTags = computed(() =>
  Array.from(tagsStore.value?.tags.value.values() ?? []),
);

const moreOpen = ref(false);

// ── Content ──────────────────────────────────────────────────────────────────
function onContentUpdate(_id: string, payload: string | { content: string }) {
  const s = itemsStore.value;
  const n = item.value;
  if (!s || !n) return;
  const content = typeof payload === "string" ? payload : payload.content;
  void s.updateItem(itemId.value, { ...n, content });
}
function onRetry() {
  void itemsStore.value?.retryFailedItem(itemId.value);
}

// ── Meta ─────────────────────────────────────────────────────────────────────
function setColumn(columnId: string) {
  const n = item.value;
  if (!itemsStore.value || !n || (n.columnId ?? null) === columnId) return;
  void itemsStore.value.moveItemToColumn(itemId.value, columnId);
}
function hasTag(id: string) {
  return (item.value?.tags ?? []).includes(id);
}
function toggleTag(id: string) {
  const s = itemsStore.value;
  const n = item.value;
  if (!s || !n) return;
  const tags = hasTag(id)
    ? (n.tags ?? []).filter((t) => t !== id)
    : [...(n.tags ?? []), id];
  void s.updateItem(itemId.value, { ...n, tags });
}
function tagColor(t: UserTagState) {
  return tagColorVar({ name: t.name, color: t.color ?? null });
}
const dueInput = computed(() =>
  item.value?.dueDate
    ? new Date(item.value.dueDate).toISOString().slice(0, 10)
    : "",
);
function setDue(value: string) {
  const s = itemsStore.value;
  const n = item.value;
  if (!s || !n) return;
  void s.updateItem(itemId.value, {
    ...n,
    dueDate: value ? new Date(value).toISOString() : null,
  });
}

// ── Delete / nav ─────────────────────────────────────────────────────────────
async function deleteCard() {
  moreOpen.value = false;
  if (!itemsStore.value) return;
  await itemsStore.value.deleteItem(itemId.value);
  toast.add({ title: "Card deleted", color: "neutral" });
  navigateTo("/board");
}
function goBack() {
  navigateTo("/board");
}

// ── Hydration (deep links / refresh) ─────────────────────────────────────────
async function loadCurrentItem() {
  if (!itemsStore.value || item.value) return;
  await Promise.all([
    itemsStore.value.syncWithServer(),
    columnsStore.value?.syncWithServer(),
  ]);
}
watch(activeId, () => void loadCurrentItem());
onMounted(() => void loadCurrentItem());
</script>

<style scoped>
.bd {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: var(--space-3) var(--space-4)
    calc(var(--space-4) + env(safe-area-inset-bottom));
  background: var(--color-background);
}
.bd__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.bd__bar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.bd__editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: var(--space-2);
}
.bd__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-secondary);
}
.bd__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
  margin-top: var(--space-2);
}
.bd__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.bd__empty-hint {
  font-size: 13px;
  color: var(--color-content-secondary);
}
.bd__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.bd__actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-error-text);
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}
.bd__missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 80dvh;
  text-align: center;
  color: var(--color-content-secondary);
}
</style>
