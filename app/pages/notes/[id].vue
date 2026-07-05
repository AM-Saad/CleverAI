<template>
  <div>
    <MobileNoteEditor
      v-if="note"
      ref="editorRef"
      :note-id="noteId"
      :title="titleDraft"
      :content="note.content"
      :tags="note.tags ?? []"
      :note-type="note.noteType"
      :metadata="note.metadata"
      :sync-state="note.isDirty ? 'local' : 'synced'"
      @update:title="onTitle"
      @update:content="onContent"
      @update:tags="onTags"
      @update:metadata="onMetadata"
      @convert="onConvert"
      @ai="onAi"
      @back="goBack"
      @share="share"
      @more="moreOpen = true"
    />

    <div v-else class="note-missing">
      <UiIcon name="i-lucide-file-x" class="h-9 w-9 text-content-disabled" />
      <p>Note not found.</p>
      <UiButton pill @click="goBack">Back to notes</UiButton>
    </div>

    <AiResultSheet
      v-model:open="aiOpen"
      :loading="aiLoading"
      :committing="aiCommitting"
      :error="aiError"
      :cards="aiCards"
      @commit="commitCards"
      @retry="generateCards"
      @edit="aiOpen = false"
    />

    <!-- note actions (more ⋯) -->
    <UiSheet v-model:open="moreOpen" title="Note actions">
      <div class="note-actions">
        <p class="note-actions__label">NOTE TYPE</p>
        <div class="note-actions__types">
          <button v-for="t in NOTE_TYPES" :key="t.value" type="button" class="note-actions__type" :class="{ 'note-actions__type--on': (note?.noteType ?? 'TEXT') === t.value }" @click="convertTo(t.value)"> <!-- design-allow: native note-type selector -->
            <UiIcon :name="t.icon" class="h-5 w-5" />
            {{ t.label }}
          </button>
        </div>

        <button type="button" class="note-actions__row" @click="openGroupPicker"> <!-- design-allow: native action row -->
          <UiIcon name="i-lucide-folder" class="h-5 w-5" />
          <span class="note-actions__row-grow">Group</span>
          <span class="note-actions__row-value">{{ currentGroupName }}</span>
          <UiIcon name="i-lucide-chevron-right" class="note-actions__row-chev h-4 w-4" />
        </button>

        <UiDoubleTapDeleteButton
          unstyled
          class="note-actions__row note-actions__row--danger"
          label="Delete note"
          armed-label="Tap again to delete note"
          :reset-key="noteId"
          @confirm="deleteNote"
        >
          <template #default="{ label }">
            <UiIcon name="i-lucide-trash-2" class="h-5 w-5" />
            {{ label }}
          </template>
        </UiDoubleTapDeleteButton>
      </div>
    </UiSheet>

    <!-- group picker -->
    <UiSheet v-model:open="groupPickerOpen" title="Add to group">
      <div class="note-groups">
        <button type="button" class="note-groups__row" :class="{ 'note-groups__row--on': !currentGroupId }" @click="setGroup(null)"> <!-- design-allow: native group option -->
          <span class="note-groups__none" />
          <span class="note-groups__name">None</span>
          <UiIcon v-if="!currentGroupId" name="i-lucide-check" class="h-[18px] w-[18px] note-groups__check" />
        </button>
        <button v-for="g in editorGroups" :key="g.id" type="button" class="note-groups__row" :class="{ 'note-groups__row--on': currentGroupId === g.id }" @click="setGroup(g.id)"> <!-- design-allow: native group option -->
          <span class="note-groups__dot" :style="{ background: dotFor(g.id) }" />
          <span class="note-groups__name">{{ g.title }}</span>
          <UiIcon v-if="currentGroupId === g.id" name="i-lucide-check" class="h-[18px] w-[18px] note-groups__check" />
        </button>

        <div v-if="addingGroup" class="note-groups__new">
          <input ref="groupNameEl" v-model="newGroupName" class="note-groups__input" placeholder="New group name" maxlength="60" @keydown.enter.prevent="createAndAssign" /> <!-- design-allow: native group-name field -->
          <UiButton pill size="sm" tone="primary" :loading="creatingGroup" :disabled="!newGroupName.trim()" @click="createAndAssign">Add</UiButton>
        </div>
        <button v-else type="button" class="note-groups__add" @click="startAddGroup"> <!-- design-allow: native dashed add control -->
          <UiIcon name="i-lucide-plus" class="h-4 w-4" /> New group
        </button>
      </div>
    </UiSheet>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import MobileNoteEditor from "~/features/notes/components/MobileNoteEditor.vue";
import AiResultSheet from "~/features/notes/components/AiResultSheet.vue";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import { useNoteGroupsStore } from "~/features/notes/composables/useNoteGroupsStore";
import { accentVarFor } from "~/composables/useAccentColor";

const route = useRoute();
const toast = useToast();
const { $api } = useNuxtApp();
const { activeId } = useActiveWorkspace();

const routeId = computed(() => String(route.params.id));
const store = computed(() => (activeId.value ? useNotesStore(activeId.value) : null));
// Resolve temp→real ids: an optimistic note's temp id is swapped for the server
// id after sync, so look up directly, then via the store's alias map.
const note = computed(() => {
  const s = store.value;
  if (!s) return null;
  const direct = s.notes.value.get(routeId.value);
  if (direct) return direct;
  const resolved = s.resolveNoteId(routeId.value);
  return resolved ? s.notes.value.get(resolved) ?? null : null;
});
// The id to use for store mutations (the note's real id once known).
const noteId = computed(() => note.value?.id ?? routeId.value);

const titleDraft = ref(note.value?.title ?? "");
watch(
  () => noteId.value,
  () => (titleDraft.value = note.value?.title ?? ""),
);
watch(
  () => note.value?.title,
  (t) => {
    if (t !== undefined && t !== titleDraft.value) titleDraft.value = t;
  },
);

// ── Persistence ──────────────────────────────────────────────────────────────
// applyNoteDraft is an in-memory echo only — it neither writes IndexedDB nor
// enqueues a server sync. The real save is updateNote (which upserts memory+IDB
// and queues a PATCH carrying content/title/metadata/noteType). We echo on every
// keystroke for instant UI, then debounce the durable updateNote.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void commitNow(), 500);
}
async function commitNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const n = note.value;
  if (!n || !store.value) return;
  await store.value.updateNote(noteId.value, { ...n, isDirty: true, updatedAt: new Date() });
}

function onTitle(v: string) {
  titleDraft.value = v;
  store.value?.applyNoteDraft(noteId.value, { title: v });
  scheduleSave();
}
function onContent(html: string) {
  store.value?.applyNoteDraft(noteId.value, { content: html });
  scheduleSave();
}
function onTags(tags: string[]) {
  const n = note.value;
  if (!n || !store.value) return;
  store.value.updateNote(noteId.value, { ...n, tags, isDirty: true, updatedAt: new Date() });
}
function onMetadata(metadata: Record<string, unknown>) {
  const n = note.value;
  if (!n || !store.value) return;
  // Persist ONLY metadata — never the text content. Canvas/math shapes live in
  // metadata; the note's `content` (which may hold real text from before a
  // conversion) must be preserved so converting between types is reversible and
  // non-destructive.
  store.value.applyNoteDraft(noteId.value, { metadata });
  scheduleSave();
}

const NOTE_TYPES = [
  { value: "TEXT", label: "Text", icon: "i-lucide-type" },
  { value: "MATH", label: "Math", icon: "i-lucide-sigma" },
  { value: "CANVAS", label: "Canvas", icon: "i-lucide-pen-tool" },
] as const;

async function onConvert(type: "TEXT" | "CANVAS" | "MATH") {
  const n = note.value;
  if (!n || !store.value) return;
  const meta =
    type === "CANVAS"
      ? { shapes: (n.metadata as { shapes?: unknown[] })?.shapes ?? [] }
      : type === "MATH"
        ? { lines: (n.metadata as { lines?: unknown[] })?.lines ?? [] }
        : {};
  await store.value.updateNote(noteId.value, {
    ...n,
    noteType: type,
    metadata: meta,
    isDirty: true,
    updatedAt: new Date(),
  });
}
function convertTo(type: "TEXT" | "CANVAS" | "MATH") {
  moreOpen.value = false;
  if ((note.value?.noteType ?? "TEXT") !== type) void onConvert(type);
}

const moreOpen = ref(false);

// ── Group assignment ─────────────────────────────────────────────────────────
const groupsStore = computed(() => (activeId.value ? useNoteGroupsStore(activeId.value) : null));
const editorGroups = computed(() => groupsStore.value?.orderedGroups.value ?? []);
const currentGroupId = computed(() => note.value?.groupId ?? null);
const currentGroupName = computed(() => {
  const id = currentGroupId.value;
  if (!id) return "None";
  return editorGroups.value.find((g) => g.id === id)?.title ?? "None";
});
function dotFor(id: string) {
  return accentVarFor(id);
}

const groupPickerOpen = ref(false);
function openGroupPicker() {
  moreOpen.value = false;
  groupPickerOpen.value = true;
}
async function setGroup(toGroupId: string | null) {
  groupPickerOpen.value = false;
  addingGroup.value = false;
  if (!store.value || !note.value) return;
  if ((note.value.groupId ?? null) === toGroupId) return;
  const toIndex = Array.from(store.value.notes.value.values()).filter(
    (n) => (n.groupId ?? null) === toGroupId,
  ).length;
  await store.value.applyLayoutCommand({ type: "MOVE_NOTE", noteId: noteId.value, toGroupId, toIndex });
}

const addingGroup = ref(false);
const newGroupName = ref("");
const creatingGroup = ref(false);
const groupNameEl = ref<HTMLInputElement | null>(null);
function startAddGroup() {
  addingGroup.value = true;
  newGroupName.value = "";
  nextTick(() => groupNameEl.value?.focus());
}
async function createAndAssign() {
  const title = newGroupName.value.trim();
  if (!title || !groupsStore.value || creatingGroup.value) return;
  creatingGroup.value = true;
  try {
    const id = await groupsStore.value.createGroup(title);
    if (id) await setGroup(id);
  } finally {
    creatingGroup.value = false;
    addingGroup.value = false;
  }
}
async function deleteNote() {
  if (!store.value) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  moreOpen.value = false;
  await store.value.deleteNote(noteId.value);
  toast.add({ title: "Note deleted", color: "neutral" });
  navigateTo("/notes");
}

// Flush any pending debounced edit before leaving the editor.
onBeforeUnmount(() => void commitNow());

// ── AI (selection-anchored) ────────────────────────────────────────────────
const aiOpen = ref(false);
const aiLoading = ref(false);
const aiCommitting = ref(false);
const aiError = ref<string | null>(null);
const aiCards = ref<{ front: string; back: string }[]>([]);
const aiSourceText = ref("");

async function onAi(payload: { kind: "explain" | "rewrite" | "cards"; text: string }) {
  const text = payload.text?.trim();
  if (!text) {
    toast.add({ title: "Select some text first", color: "warning" });
    return;
  }
  if (payload.kind === "cards") {
    aiSourceText.value = text;
    aiOpen.value = true;
    await generateCards();
    return;
  }
  // Explain / Rewrite are selection actions wired in a follow-up pass.
  toast.add({ title: `${payload.kind === "explain" ? "Explain" : "Rewrite"} is coming soon`, color: "neutral" });
}

async function generateCards() {
  aiError.value = null;
  aiLoading.value = true;
  aiCards.value = [];
  try {
    const res = await $api.gateway.generateFlashcards(aiSourceText.value, {
      workspaceId: activeId.value ?? undefined,
      save: false,
    });
    aiCards.value =
      res.task === "flashcards"
        ? res.flashcards.map((c) => ({ front: c.front, back: c.back }))
        : [];
    if (!aiCards.value.length) aiError.value = "No cards were generated. Try a longer passage.";
  } catch (err) {
    aiError.value = err instanceof Error ? err.message : "Generation failed.";
  } finally {
    aiLoading.value = false;
  }
}

async function commitCards() {
  if (!aiCards.value.length) return;
  aiCommitting.value = true;
  try {
    // Persist the reviewed cards; they enter the SM-2 queue as new cards.
    await $api.gateway.generateFlashcards(aiSourceText.value, {
      workspaceId: activeId.value ?? undefined,
      save: true,
    });
    toast.add({ title: `Added ${aiCards.value.length} cards to review`, color: "success" });
    aiOpen.value = false;
  } catch (err) {
    aiError.value = err instanceof Error ? err.message : "Could not add cards.";
  } finally {
    aiCommitting.value = false;
  }
}

const editorRef = ref<{ startDictation: () => boolean } | null>(null);

async function loadCurrentNote() {
  if (!store.value) return;
  // Groups power the editor's "Add to group" picker — load them for deep-links.
  void groupsStore.value?.syncWithServer();
  if (!note.value && store.value) {
    await store.value.hydrateLocalNotes();
    if (!note.value) await store.value.refreshFromServer();
  }
}

watch(activeId, () => {
  void loadCurrentNote();
});

onMounted(async () => {
  await loadCurrentNote();
  // Capture intents carried from the FAB.
  const action = route.query.action as string | undefined;
  if (action === "ai") {
    toast.add({ title: "Select any text, then tap ✦ to turn it into cards", color: "neutral" });
  } else if (action === "dictate") {
    await nextTick();
    const ok = editorRef.value?.startDictation?.();
    if (!ok) toast.add({ title: "Dictation isn't supported on this browser", color: "neutral" });
  }
});

function goBack() {
  void commitNow();
  navigateTo("/notes");
}
async function share() {
  if (import.meta.client && navigator.share) {
    try {
      await navigator.share({ title: titleDraft.value || "Note", text: stripHtml(note.value?.content ?? "") });
    } catch {
      /* user cancelled */
    }
  } else {
    toast.add({ title: "Sharing isn't available on this device", color: "neutral" });
  }
}
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
</script>

<style scoped>
.note-missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 80dvh;
  text-align: center;
  color: var(--color-content-secondary);
}
.note-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.note-actions__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.note-actions__types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.note-actions__type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-content-secondary);
  background: var(--color-surface-subtle);
  border: 1px solid transparent;
}
.note-actions__type--on {
  color: var(--color-primary);
  background: var(--color-primary-50);
  border-color: var(--color-primary);
}
.note-actions__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
  background: var(--color-surface-subtle);
}
.note-actions__row-grow {
  flex: 1;
  text-align: left;
}
.note-actions__row-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-content-secondary);
}
.note-actions__row-chev {
  color: var(--color-content-disabled);
}
.note-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}
.note-groups__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
  border: 1px solid transparent;
}
.note-groups__row--on {
  background: var(--color-primary-50);
  border-color: var(--color-primary);
}
.note-groups__name {
  flex: 1;
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
}
.note-groups__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.note-groups__none {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border-strong);
  flex-shrink: 0;
}
.note-groups__check {
  color: var(--color-primary);
}
.note-groups__new {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.note-groups__input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-primary);
  background: var(--color-background);
  font-size: 14px;
  color: var(--color-content-on-surface-strong);
  outline: none;
}
.note-groups__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  border: 1.5px dashed var(--color-border-strong);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
}
.note-actions__row--danger {
  color: var(--color-error-text);
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
}
</style>
