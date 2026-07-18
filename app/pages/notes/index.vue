<template>
  <div class="notes" :class="{ 'notes--locked': !!draggingNoteId }">
    <WorkspacePill class="notes__wspill" />
    <header class="notes__header">
      <ui-title tag="h1" class="notes__title">Notes</ui-title>
      <div class="notes__actions">
        <UiIconButton
          icon="i-lucide-folders"
          label="Manage groups"
          @click="groupsOpen = true"
        />
        <UiIconButton
          icon="i-lucide-search"
          label="Search notes"
          :active="searching"
          :pressed="searching"
          @click="searching = !searching"
        />
      </div>
    </header>

    <UiInput
      v-if="searching"
      v-model="query"
      placeholder="Search notes…"
      icon="i-lucide-search"
      class="notes__search"
      autofocus
    />

    <SaveLocalBar :syncing="dirtyCount" class="notes__savebar" />

    <!-- loading -->
    <div v-if="loading && !notesArray.length" class="notes__list">
      <UiSkeleton
        v-for="i in 4"
        :key="i"
        class="h-20 w-full rounded-[var(--radius-2xl)]"
      />
    </div>

    <!-- empty -->
    <div v-else-if="!filtered.length" class="notes__empty">
      <UiIcon
        name="i-lucide-notebook-pen"
        class="h-10 w-10 text-content-disabled"
      />
      <p class="notes__empty-title">
        {{ query ? "No matches" : "No notes yet" }}
      </p>
      <p class="notes__empty-sub">
        {{
          query
            ? "Try a different search."
            : "Tap + to capture your first note."
        }}
      </p>
    </div>

    <!-- grouped list -->
    <div v-else class="notes__groups">
      <section
        v-for="group in groupedNotes"
        :key="group.id ?? 'ungrouped'"
        class="notes__group"
        :class="{
          'notes__group--drop': dropTargetGroupId === (group.id ?? '__null__'),
        }"
        :data-group-id="group.id ?? '__null__'"
      >
        <div v-if="group.name" class="notes__group-head">
          <button
            type="button"
            class="notes__group-toggle"
            @click="toggleCollapse(group.id)"
          >
            <!-- design-allow: native collapsible group header -->
            <UiIcon
              name="i-lucide-chevron-down"
              class="h-3.5 w-3.5 notes__group-caret"
              :class="{
                'notes__group-caret--collapsed': isCollapsed(group.id),
              }"
            />
            <span
              v-if="group.id"
              class="notes__group-dot"
              :style="{ background: dotFor(group.id) }"
            />
            {{ group.name.toUpperCase() }}
            <span class="notes__group-count">{{ group.notes.length }}</span>
          </button>
          <button
            v-if="group.id"
            type="button"
            class="notes__group-add"
            :aria-label="`Add note to ${group.name}`"
            @click="openQuickNote(group.id, $event)"
          >
            <!-- design-allow: native add-to-group control -->
            <UiIcon name="i-lucide-plus" class="h-4 w-4" />
          </button>
        </div>
        <ul v-show="!isCollapsed(group.id)" class="notes__list">
          <li
            v-for="note in group.notes"
            :key="note.id"
            :class="{ 'notes__row--dragging': draggingNoteId === note.id }"
            @pointerdown="onNotePointerDown($event, note.id)"
          >
            <NoteListRow
              :note="note"
              @open="dragMoved ? undefined : openNote(note.id)"
            />
          </li>
        </ul>
      </section>
    </div>

    <!-- FAB -->
    <button
      type="button"
      class="notes__fab"
      :disabled="creating"
      aria-label="New note"
      @click="openQuickNote(null, $event)"
    >
      <!-- design-allow: gradient create FAB (shell chrome) -->
      <UiIcon name="i-lucide-plus" class="h-6 w-6" />
    </button>

    <NoteGroupsSheet
      v-model:open="groupsOpen"
      :groups="orderedGroups"
      @create="onGroupCreate"
      @rename="onGroupRename"
      @delete="onGroupDelete"
      @reorder="onGroupReorder"
    />

    <QuickNoteSheet
      v-model:open="quickOpen"
      title=""
      content=""
      :morphing="morphing"
      @update:title="quick.onTitle"
      @update:content="quick.onContent"
      @open-full="openQuickNoteFull"
      @done="doneQuickNote"
      @closed="finalizeQuickNote"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import NoteListRow from "~/features/notes/components/NoteListRow.vue";
import NoteGroupsSheet from "~/features/notes/components/NoteGroupsSheet.vue";
import QuickNoteSheet from "~/features/notes/components/QuickNoteSheet.vue";
import { useQuickNoteCapture } from "~/features/notes/composables/useQuickNoteCapture";
import { useViewTransitionMorph } from "~/composables/ui/useViewTransitionMorph";
import WorkspacePill from "~/components/shell/WorkspacePill.vue";
import SaveLocalBar from "~/components/shell/SaveLocalBar.vue";
import { accentVarFor } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useNoteGroupsStore } from "~/features/notes/composables/useNoteGroupsStore";
import type { NoteState } from "~/features/notes/composables/useNotesStore";
import type { NoteGroup } from "@@/shared/utils/note-group.contract";

const route = useRoute();
const { activeId } = useActiveWorkspace();

const searching = ref(false);
const query = ref("");
const creating = ref(false);
const loading = ref(true);

// Group management sheet
const groupsOpen = ref(false);

// Drag-a-note-to-a-group (long-press to lift, so it coexists with list scroll)
const draggingNoteId = ref<string | null>(null);
const dragMoved = ref(false);
const dropTargetGroupId = ref<string | null>(null);
const lastComposeToken = ref("");

// Resolve the notes store for the active workspace (re-resolved if it changes).
const store = computed(() =>
  activeId.value ? useNotesStore(activeId.value) : null,
);
const groupsStore = computed(() =>
  activeId.value ? useNoteGroupsStore(activeId.value) : null,
);

const dirtyCount = computed(() => store.value?.dirtyCount.value ?? 0);

const notesArray = computed<NoteState[]>(() => {
  const map = store.value?.notes.value;
  if (!map) return [];
  return Array.from(map.values()).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return notesArray.value;
  return notesArray.value.filter((n) =>
    `${n.title ?? ""} ${n.content ?? ""}`.toLowerCase().includes(q),
  );
});

const groupedNotes = computed(() => {
  const groups = groupsStore.value?.orderedGroups.value ?? [];
  const byId = new Map<string | null, NoteState[]>();
  for (const note of filtered.value) {
    const key = note.groupId ?? null;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key)!.push(note);
  }
  const out: { id: string | null; name: string | null; notes: NoteState[] }[] =
    [];
  const ungrouped = byId.get(null);
  if (ungrouped?.length)
    out.push({
      id: null,
      name: groups.length ? "Notes" : null,
      notes: ungrouped,
    });
  for (const g of groups) {
    const list = byId.get(g.id);
    if (list?.length) out.push({ id: g.id, name: g.title, notes: list });
  }
  return out;
});

// Collapse is persisted by the groups store (survives reloads), not local state.
function isCollapsed(id: string | null) {
  return groupsStore.value?.isCollapsed(id) ?? false;
}
function toggleCollapse(id: string | null) {
  groupsStore.value?.toggleCollapsed(id);
}
function dotFor(id: string) {
  return accentVarFor(id);
}

function openNote(id: string) {
  navigateTo(`/notes/${id}`);
}

async function newNote(action?: "ai" | "dictate", groupId?: string | null) {
  if (!store.value || creating.value) return;
  creating.value = true;
  try {
    const id = await store.value.createNote(
      "",
      [],
      "TEXT",
      undefined,
      undefined,
      groupId ?? null,
    );
    // Carry the capture intent into the editor (Ask AI / Dictate).
    if (id)
      await navigateTo(
        action ? `/notes/${id}?action=${action}` : `/notes/${id}`,
      );
  } finally {
    creating.value = false;
  }
}

// ── Quick capture (lazy create — nothing exists until the first character) ──
const { morph, armMorphTarget, morphing } = useViewTransitionMorph();
const quickOpen = ref(false);
const quickTransitioning = ref(false);
const quick = useQuickNoteCapture(store);
let quickTriggerEl: HTMLElement | null = null;

async function openQuickNote(groupId?: string | null, event?: MouseEvent) {
  if (!store.value || quickOpen.value || quickTransitioning.value) return;
  quickTransitioning.value = true;
  // currentTarget is only valid synchronously — capture before any await.
  const trigger = (event?.currentTarget as HTMLElement | null) ?? null;
  try {
    await quick.begin(groupId ?? null);
    quickTriggerEl = trigger;
    await morph({
      from: trigger,
      update: () => {
        quickOpen.value = true;
      },
    });
  } finally {
    quickTransitioning.value = false;
  }
}

/** Done → morph the sheet back into the trigger it came from (when possible). */
async function doneQuickNote() {
  if (quickTransitioning.value) return;
  quickTransitioning.value = true;
  // Start finalization before the exit animation. Waiting for @closed allowed
  // the 500 ms autosave timer to send the first-character create mid-animation,
  // followed by a second request for the completed title.
  try {
    const finalize = quick.finalize();
    await morph({
      to: quickTriggerEl?.isConnected ? quickTriggerEl : null,
      update: () => {
        quickOpen.value = false;
      },
    });
    await finalize;
  } finally {
    quickTransitioning.value = false;
  }
}

/** Open the note in its own place — the sheet morphs into /notes/[id]. */
async function openQuickNoteFull() {
  // Explicit intent to edit in full: create now even if nothing is typed yet.
  const id = await quick.ensureCreated();
  if (!id) return;
  quick.markFinalized(); // navigating away — never delete, even if still empty
  await quick.commitNow();
  armMorphTarget();
  await morph({
    update: async () => {
      quickOpen.value = false;
      await navigateTo(`/notes/${id}`);
    },
  });
}

/** After the sheet closes (any path): keep real notes, drop empty leftovers. */
function finalizeQuickNote() {
  quickTriggerEl = null;
  void quick.finalize();
}

function firstQueryValue(value: typeof route.query.compose) {
  return Array.isArray(value) ? value[0] : value;
}

async function consumeComposeRoute(value: typeof route.query.compose) {
  const compose = firstQueryValue(value);
  if (!compose || !store.value || creating.value) return;

  const token = `${compose}:${route.query.capture ?? ""}:${activeId.value ?? ""}`;
  if (lastComposeToken.value === token) return;
  lastComposeToken.value = token;

  // Ask AI / Dictate need the full editor (AI bubble, dictation); a plain
  // "New note" from the capture sheet opens quick capture in place.
  if (compose === "ai" || compose === "dictate") {
    await newNote(compose);
  } else {
    await openQuickNote(null);
  }
}

// ── Group management ─────────────────────────────────────────────────────────
const orderedGroups = computed<NoteGroup[]>(
  () => groupsStore.value?.orderedGroups.value ?? [],
);
async function onGroupCreate(title: string) {
  await groupsStore.value?.createGroup(title);
}
function onGroupRename(payload: { id: string; title: string }) {
  groupsStore.value?.renameGroup(payload.id, payload.title);
}
async function onGroupDelete(id: string) {
  // Notes in a deleted group fall back to ungrouped (server cascades groupId→null).
  await groupsStore.value?.deleteGroup(id);
}
function onGroupReorder(ordered: { id: string; title: string }[]) {
  const byId = new Map(orderedGroups.value.map((g) => [g.id, g]));
  const full = ordered
    .map((g, i) => {
      const real = byId.get(g.id);
      return real ? { ...real, order: i } : null;
    })
    .filter((g): g is NoteGroup => g !== null);
  groupsStore.value?.reorderGroups(full);
}

// ── Drag a note onto a group (long-press → lift → drop on a section) ─────────
let noteDrag: {
  id: string;
  startX: number;
  startY: number;
  started: boolean;
} | null = null;
let pressTimer: ReturnType<typeof setTimeout> | null = null;

function clearNoteDragListeners() {
  window.removeEventListener("pointermove", onNotePointerMove);
}
function onNotePointerDown(e: PointerEvent, id: string) {
  if (e.button != null && e.button !== 0) return;
  noteDrag = { id, startX: e.clientX, startY: e.clientY, started: false };
  dragMoved.value = false;
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressTimer = null;
    if (!noteDrag) return;
    noteDrag.started = true;
    dragMoved.value = true;
    draggingNoteId.value = noteDrag.id;
    window.getSelection?.()?.removeAllRanges();
    (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(8);
  }, 280);
  window.addEventListener("pointermove", onNotePointerMove);
  window.addEventListener("pointerup", onNotePointerUp, { once: true });
}
function onNotePointerMove(e: PointerEvent) {
  if (!noteDrag) return;
  const dx = e.clientX - noteDrag.startX;
  const dy = e.clientY - noteDrag.startY;
  if (!noteDrag.started) {
    // Moved before the long-press fired → it's a scroll, not a drag.
    if (Math.hypot(dx, dy) > 10 && pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      clearNoteDragListeners();
      noteDrag = null;
    }
    return;
  }
  const section = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest("[data-group-id]");
  dropTargetGroupId.value = section?.getAttribute("data-group-id") ?? null;
}
async function onNotePointerUp() {
  clearNoteDragListeners();
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  const d = noteDrag;
  const target = dropTargetGroupId.value;
  noteDrag = null;
  draggingNoteId.value = null;
  dropTargetGroupId.value = null;
  if (!d || !d.started || !store.value || target == null) return;

  const toGroupId = target === "__null__" ? null : target;
  const note = store.value.getNote(d.id);
  if (!note || (note.groupId ?? null) === toGroupId) return;

  const toIndex = Array.from(store.value.notes.value.values()).filter(
    (n) => (n.groupId ?? null) === toGroupId,
  ).length;
  await store.value.applyLayoutCommand({
    type: "MOVE_NOTE",
    noteId: d.id,
    toGroupId,
    toIndex,
  });
}

async function loadNotes() {
  const targetStore = store.value;
  if (!targetStore) return;
  loading.value = true;
  try {
    await Promise.all([
      targetStore.syncWithServer(),
      groupsStore.value?.syncWithServer(),
    ]);
  } finally {
    loading.value = false;
  }
}

watch(activeId, () => loadNotes());
watch(
  [() => route.query.compose, () => route.query.capture, activeId],
  ([compose]) => {
    void consumeComposeRoute(compose);
  },
);

onMounted(async () => {
  await loadNotes();
  // Capture-sheet entry: auto-create a note, carrying the intent (note/ai/dictate).
  await consumeComposeRoute(route.query.compose);
});
</script>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-6);
}
.notes__wspill {
  align-self: flex-start;
  margin-top: var(--space-2);
}
.notes__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.notes__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: var(--color-content-on-surface-strong);
}
.notes--locked {
  touch-action: none;
  overflow: hidden;
}
.notes__actions {
  display: inline-flex;
  gap: var(--space-2);
}
.notes__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: 0;
}
.notes__groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.notes__group {
  border-radius: var(--radius-lg);
  transition: outline-color var(--duration-fast) var(--ease-standard);
  outline: 2px dashed transparent;
  outline-offset: 4px;
}
.notes__group--drop {
  outline-color: var(--color-primary);
}
.notes__group-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.notes__group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
  text-align: left;
}
.notes__group-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.notes__group-caret {
  transition: transform var(--duration-fast) var(--ease-standard);
}
.notes__group-caret--collapsed {
  transform: rotate(-90deg);
}
.notes__group-count {
  color: var(--color-content-disabled);
}
.notes__group-add {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  color: var(--color-content-secondary);
  flex-shrink: 0;
}
.notes__group-add:active {
  background: var(--color-surface-subtle);
}
.notes__list li {
  list-style: none;
  transition:
    transform var(--duration-fast) var(--ease-emphasized),
    box-shadow var(--duration-fast) var(--ease-standard);
}
.notes__row--dragging {
  transform: scale(1.03);
  box-shadow: var(--shadow-card-hover);
  border-radius: var(--radius-2xl);
  opacity: 0.97;
  position: relative;
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  .notes__row--dragging {
    transform: none;
  }
}
.notes__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}
.notes__empty-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.4px;
  color: var(--color-content-on-surface-strong);
}
.notes__empty-sub {
  font-size: 14px;
  color: var(--color-content-secondary);
}
.notes__fab {
  position: fixed;
  /* Anchor to the centered 480px app column on wide viewports. */
  right: max(var(--space-4), calc((100vw - 480px) / 2 + var(--space-4)));
  bottom: calc(74px + env(safe-area-inset-bottom) + var(--space-4));
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: var(--radius-full);
  background: var(--ds-gradient-fab);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-primary-glow);
  z-index: var(--z-drawer);
  transition: transform var(--duration-fast) var(--ease-emphasized);
}
.notes__fab:active {
  transform: scale(0.94);
}
.notes__fab:disabled {
  opacity: 0.7;
}
</style>
