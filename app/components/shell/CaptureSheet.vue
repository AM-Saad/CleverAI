<template>
  <UiSheet
    :open="open"
    :title="mode === 'menu' ? 'Capture' : undefined"
    :morph-name="SHEET_MORPH_NAME"
    :morphing="morphing"
    @update:open="emit('update:open', $event)"
    @closed="onSheetClosed"
  >
    <!-- ── In-place note editor (the "New note" tile morphs into this) ── -->
    <div
      v-if="mode === 'note'"
      class="ds-capture-note"
      :style="{ viewTransitionName: MORPH_NAME }"
    >
      <div class="ds-capture-note__bar">
        <UiIconButton
          icon="i-lucide-chevron-left"
          label="Back to capture"
          size="sm"
          :disabled="modeTransitioning || morphing"
          @click="backToMenu"
        />
        <span class="ds-capture-note__ws">
          <span
            class="ds-capture-target__dot"
            :style="{ background: selectedWorkspaceAccent }"
          />
          <UiAnimatedText :text="selectedWorkspaceLabel" />
        </span>
      </div>

      <QuickNoteEditor
        :autofocus="!isMobile"
        @update:title="quick.onTitle"
        @update:content="quick.onContent"
      />

      <div class="ds-capture-note__footer">
        <UiButton
          variant="ghost"
          tone="neutral"
          leading-icon="i-lucide-maximize-2"
          :disabled="modeTransitioning || morphing"
          @click="openFullNote"
        >
          Open full note
        </UiButton>
        <UiButton
          pill
          tone="primary"
          :disabled="modeTransitioning || morphing"
          @click="doneNoteCapture"
        >
          Done
        </UiButton>
      </div>
    </div>

    <div
      v-if="mode === 'word'"
      class="ds-capture-mode"
      :style="{ viewTransitionName: MORPH_NAME }"
    >
      <QuickWordTranslator @back="backToMenu" @done="doneWordCapture" />
    </div>

    <div
      v-if="mode === 'board'"
      class="ds-capture-mode"
      :style="{ viewTransitionName: MORPH_NAME }"
    >
      <QuickBoardItemEditor
        :column-label="boardColumnLabel"
        @update:content="boardQuick.onContent"
        @back="backToMenu"
        @done="doneBoardCapture"
        @open-full="openFullBoardItem"
      />
    </div>

    <div
      v-if="mode === 'menu' && showWorkspaceTarget"
      class="ds-capture-target"
    >
      <button
        type="button"
        class="ds-capture-target__button"
        :aria-expanded="isWorkspacePickerOpen"
        aria-controls="capture-workspace-options"
        :disabled="workspaceLoading && !selectedWorkspace"
        @click="toggleWorkspacePicker"
      >
        <!-- design-allow: compact workspace target control in capture sheet -->
        <span class="ds-capture-target__main">
          <span
            class="ds-capture-target__dot"
            :style="{ background: selectedWorkspaceAccent }"
          />
          <span class="ds-capture-target__copy">
            <span class="ds-capture-target__eyebrow">Workspace</span>
            <span class="ds-capture-target__name">
              <UiAnimatedText :text="selectedWorkspaceLabel" />
            </span>
          </span>
        </span>
        <UiIcon
          :name="
            isWorkspacePickerOpen
              ? 'i-lucide-chevron-up'
              : 'i-lucide-chevron-down'
          "
          class="h-4 w-4 text-content-secondary"
        />
      </button>

      <Transition name="capture-target">
        <div
          v-if="isWorkspacePickerOpen && pickerWorkspaces.length > 1"
          id="capture-workspace-options"
          class="ds-capture-target__rail"
          role="listbox"
          aria-label="Capture workspace"
        >
          <button
            v-for="workspace in pickerWorkspaces"
            :key="workspace.id"
            type="button"
            class="ds-capture-target__chip"
            :class="{
              'ds-capture-target__chip--on':
                workspace.id === selectedWorkspaceId,
            }"
            role="option"
            :aria-selected="workspace.id === selectedWorkspaceId"
            @click="selectWorkspace(workspace.id)"
          >
            <!-- design-allow: native compact workspace option -->
            <span
              class="ds-capture-target__chip-dot"
              :style="{ background: accentFor(workspace) }"
            />
            <span>{{ workspace.title }}</span>
          </button>
        </div>
      </Transition>
    </div>

    <div v-if="mode === 'menu'" class="grid grid-cols-2 gap-3 pb-1">
      <button
        v-for="opt in options"
        :key="opt.key"
        :ref="(el) => setActionElement(opt.key, el)"
        type="button"
        class="ds-capture-opt"
        :disabled="isActionWaitingForWorkspace(opt.key)"
        @click="choose(opt.key, $event)"
      >
        <!-- design-allow: shell chrome, native capture tile -->
        <span
          class="ds-capture-opt__tile"
          :style="{ background: tint(opt.color, 14), color: opt.color }"
        >
          <UiIcon :name="opt.icon" class="h-5 w-5" />
        </span>
        <span class="ds-capture-opt__title">{{ opt.title }}</span>
        <span class="ds-capture-opt__sub">{{ opt.subtitle }}</span>
      </button>
    </div>

    <button
      v-if="mode === 'menu'"
      type="button"
      class="ds-dictate"
      :disabled="isActionWaitingForWorkspace('dictate')"
      @click="choose('dictate')"
    >
      <!-- design-allow: shell chrome, native press-and-hold dictate -->
      <UiIcon name="i-lucide-mic" class="h-4 w-4" />
      Hold to dictate a quick note…
    </button>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * CaptureSheet — the center-FAB target. Every create path (note, word, board,
 * AI) lives in this one sheet, per the handoff "AI is anchored to a source"
 * intent: each option routes into a real flow rather than a floating chat.
 *
 * "New note" is captured in place: the tile morphs (View Transitions) into a
 * writable editor panel inside this sheet. Nothing is created until the first
 * typed character (useQuickNoteCapture); "Open full note" morphs on into
 * /notes/[id].
 */
import { computed, nextTick, ref, watch } from "vue";
import { accentVarFor, tint } from "~/composables/useAccentColor";
import { useResponsive } from "~/composables/ui/useResponsive";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import {
  MORPH_NAME,
  SHEET_MORPH_NAME,
} from "~/composables/ui/useViewTransitionMorph";
import { useQuickCaptureMorph } from "~/composables/ui/useQuickCaptureMorph";
import QuickNoteEditor from "~/features/notes/components/QuickNoteEditor.vue";
import { useQuickNoteCapture } from "~/features/notes/composables/useQuickNoteCapture";
import QuickWordTranslator from "~/features/language-learning/components/QuickWordTranslator.vue";
import QuickBoardItemEditor from "~/features/board/components/QuickBoardItemEditor.vue";
import { useQuickBoardItemCapture } from "~/features/board/composables/useQuickBoardItemCapture";
import type { WorkspaceSummary } from "@@/shared/utils/workspace.contract";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "select", payload: CaptureSelection): void;
}>();

const { isMobile } = useResponsive();

type CaptureAction = "note" | "word" | "board" | "ai" | "dictate";
type CaptureSelection = { key: CaptureAction; workspaceId: string | null };

const {
  workspaces,
  recentWorkspaces,
  activeId,
  setActive,
  loading: workspaceLoading,
} = useActiveWorkspace();

const options = [
  {
    key: "note" as const,
    title: "New note",
    subtitle: "Text, math or canvas",
    icon: "i-lucide-pencil",
    color: "var(--color-accent-indigo)",
  },
  {
    key: "word" as const,
    title: "Capture word",
    subtitle: "Global language deck",
    icon: "i-lucide-languages",
    color: "var(--color-accent-teal)",
  },
  {
    key: "board" as const,
    title: "Board item",
    subtitle: "Task, idea or follow-up",
    icon: "i-lucide-kanban",
    color: "var(--color-accent-orange)",
  },
  {
    key: "ai" as const,
    title: "Ask AI",
    subtitle: "Generate from a source",
    icon: "i-lucide-sparkles",
    color: "var(--color-primary)",
  },
];

const workspaceScopedActions = new Set<CaptureAction>([
  "note",
  "board",
  "ai",
  "dictate",
]);
const selectedWorkspaceId = ref<string | null>(null);
const isWorkspacePickerOpen = ref(false);

const workspaceList = computed<WorkspaceSummary[]>(
  () => workspaces.value ?? [],
);
const showWorkspaceTarget = computed(
  () => workspaceLoading.value || workspaceList.value.length > 0,
);
const selectedWorkspace = computed<WorkspaceSummary | null>(
  () =>
    workspaceList.value.find(
      (workspace) => workspace.id === selectedWorkspaceId.value,
    ) ?? null,
);
const pickerWorkspaces = computed(() => recentWorkspaces.value.slice(0, 8));
const selectedWorkspaceLabel = computed(() => {
  if (selectedWorkspace.value) return selectedWorkspace.value.title;
  return workspaceLoading.value ? "Loading…" : "Choose workspace";
});
const selectedWorkspaceAccent = computed(() =>
  selectedWorkspace.value
    ? accentFor(selectedWorkspace.value)
    : "var(--color-accent-indigo)",
);

function isWorkspaceScoped(key: CaptureAction) {
  return workspaceScopedActions.has(key);
}

function isActionWaitingForWorkspace(key: CaptureAction) {
  return (
    isWorkspaceScoped(key) &&
    workspaceLoading.value &&
    !selectedWorkspaceId.value
  );
}

function accentFor(workspace: WorkspaceSummary) {
  const meta = workspace.metadata as Record<string, unknown> | null;
  if (typeof meta?.color === "string" && meta.color.startsWith("--")) {
    return `var(${meta.color})`;
  }
  return accentVarFor(workspace.id);
}

function syncSelectedWorkspace() {
  const list = workspaceList.value;
  if (!list.length) {
    selectedWorkspaceId.value = null;
    return;
  }

  const currentStillExists =
    selectedWorkspaceId.value &&
    list.some((workspace) => workspace.id === selectedWorkspaceId.value);
  if (currentStillExists) return;

  const activeStillExists =
    activeId.value && list.some((workspace) => workspace.id === activeId.value);
  selectedWorkspaceId.value = activeStillExists ? activeId.value : list[0]!.id;
}

function toggleWorkspacePicker() {
  if (pickerWorkspaces.value.length <= 1) return;
  isWorkspacePickerOpen.value = !isWorkspacePickerOpen.value;
}

function selectWorkspace(id: string) {
  selectedWorkspaceId.value = id;
  isWorkspacePickerOpen.value = false;
}

function choose(key: CaptureAction, event?: MouseEvent) {
  if (key === "note" && selectedWorkspaceId.value) {
    void startNoteCapture(event);
    return;
  }
  if (key === "word") {
    void startWordCapture(event);
    return;
  }
  if (key === "board" && selectedWorkspaceId.value) {
    void startBoardCapture(event);
    return;
  }
  emit("select", {
    key,
    workspaceId: isWorkspaceScoped(key) ? selectedWorkspaceId.value : null,
  });
  emit("update:open", false);
}

// ── In-place capture modes (tile → editor morph, lazy create where needed) ──
const {
  morph,
  armMorphTarget,
  morphing,
  setActionElement,
  morphFromAction,
  morphToAction,
} = useQuickCaptureMorph<CaptureAction>();
const mode = ref<"menu" | "note" | "word" | "board">("menu");
const modeTransitioning = ref(false);
const captureWorkspaceId = ref<string | null>(null);
const captureStore = computed(() =>
  captureWorkspaceId.value ? useNotesStore(captureWorkspaceId.value) : null,
);
const quick = useQuickNoteCapture(captureStore);

const boardItemsStore = computed(() =>
  captureWorkspaceId.value
    ? useBoardItemsStore(captureWorkspaceId.value)
    : null,
);
const boardColumnsStore = computed(() =>
  captureWorkspaceId.value
    ? useBoardColumnsStore(captureWorkspaceId.value)
    : null,
);
const boardColumns = computed(
  () => boardColumnsStore.value?.getOrderedColumns() ?? [],
);
const boardColumnId = computed(() => boardColumns.value[0]?.id ?? null);
const boardColumnLabel = computed(
  () => boardColumns.value[0]?.name ?? "Unassigned",
);
const boardQuick = useQuickBoardItemCapture(boardItemsStore, boardColumnId);

async function startNoteCapture(event?: MouseEvent) {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  captureWorkspaceId.value = selectedWorkspaceId.value;
  isWorkspacePickerOpen.value = false;
  try {
    await quick.begin(null);
    await morphFromAction("note", event, () => {
      mode.value = "note";
    });
  } finally {
    modeTransitioning.value = false;
  }
}

async function startWordCapture(event?: MouseEvent) {
  isWorkspacePickerOpen.value = false;
  await morphFromAction("word", event, () => {
    mode.value = "word";
  });
}

async function startBoardCapture(event?: MouseEvent) {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  captureWorkspaceId.value = selectedWorkspaceId.value;
  isWorkspacePickerOpen.value = false;
  try {
    await boardQuick.begin();
    await nextTick();
    void boardColumnsStore.value?.syncWithServer();
    await morphFromAction("board", event, () => {
      mode.value = "board";
    });
  } finally {
    modeTransitioning.value = false;
  }
}

function actionForMode(value: typeof mode.value): CaptureAction | null {
  if (value === "menu") return null;
  return value;
}

function finalizeCurrentMode() {
  if (mode.value === "note") return quick.finalize();
  if (mode.value === "board") return boardQuick.finalize();
  return Promise.resolve();
}

async function backToMenu() {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  const action = actionForMode(mode.value);
  const finalize = finalizeCurrentMode();
  try {
    if (action) {
      await morphToAction(action, () => {
        mode.value = "menu";
      });
    } else {
      mode.value = "menu";
    }
    await finalize;
  } finally {
    modeTransitioning.value = false;
  }
}

async function doneNoteCapture() {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  try {
    const finalize = quick.finalize(); // commits real content, drops empty leftovers
    emit("update:open", false);
    await finalize;
  } finally {
    modeTransitioning.value = false;
  }
}

function doneWordCapture() {
  emit("update:open", false);
}

async function doneBoardCapture() {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  try {
    const finalize = boardQuick.finalize();
    emit("update:open", false);
    await finalize;
  } finally {
    modeTransitioning.value = false;
  }
}

/** Open the note in its own place — the editor panel morphs into /notes/[id]. */
async function openFullNote() {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  try {
    // Explicit intent to edit in full: create now even if nothing is typed yet.
    const id = await quick.ensureCreated();
    if (!id) return;
    quick.markFinalized();
    await quick.commitNow();
    // The full editor resolves its store from the active workspace — align it
    // with where this capture actually went.
    if (
      captureWorkspaceId.value &&
      captureWorkspaceId.value !== activeId.value
    ) {
      setActive(captureWorkspaceId.value);
    }
    armMorphTarget();
    await morph({
      update: async () => {
        emit("update:open", false);
        await navigateTo(`/notes/${id}`);
      },
    });
  } finally {
    modeTransitioning.value = false;
  }
}

/** Open the board card in its own place — the panel morphs into /board/[id]. */
async function openFullBoardItem() {
  if (modeTransitioning.value) return;
  modeTransitioning.value = true;
  try {
    const id = await boardQuick.ensureCreated(true);
    if (!id) return;
    if (!(await boardQuick.commitNow())) return;
    boardQuick.markFinalized();
    if (
      captureWorkspaceId.value &&
      captureWorkspaceId.value !== activeId.value
    ) {
      setActive(captureWorkspaceId.value);
    }
    armMorphTarget();
    await morph({
      update: async () => {
        emit("update:open", false);
        await navigateTo(`/board/${id}`);
      },
    });
  } finally {
    modeTransitioning.value = false;
  }
}

function onSheetClosed() {
  // Reset after the exit settles so the menu doesn't flash mid-close.
  mode.value = "menu";
  captureWorkspaceId.value = null;
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      isWorkspacePickerOpen.value = false;
      void finalizeCurrentMode();
      return;
    }
    syncSelectedWorkspace();
  },
);

watch([workspaceList, activeId], () => {
  if (props.open) syncSelectedWorkspace();
});
</script>

<style scoped>
.ds-capture-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ds-capture-mode {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ds-capture-note__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: calc(-1 * var(--space-1));
}
.ds-capture-note__ws {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-content-secondary);
}
.ds-capture-note__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
}
.ds-capture-target {
  margin-bottom: var(--space-3);
}
.ds-capture-target__button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: 7px 9px 7px 11px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-secondary);
  background: color-mix(in srgb, var(--color-surface-subtle) 76%, transparent);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.ds-capture-target__button:active {
  transform: scale(0.99);
  background: var(--color-surface-strong);
}
.ds-capture-target__button:disabled {
  opacity: 0.65;
}
.ds-capture-target__main {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.ds-capture-target__dot,
.ds-capture-target__chip-dot {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.ds-capture-target__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  line-height: 1.05;
}
.ds-capture-target__eyebrow {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-content-disabled);
}
.ds-capture-target__name {
  max-width: 42vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-content-on-surface-strong);
}
.ds-capture-target__rail {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 8px 1px 1px;
  scrollbar-width: none;
}
.ds-capture-target__rail::-webkit-scrollbar {
  display: none;
}
.ds-capture-target__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 150px;
  min-height: 34px;
  padding: 6px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-secondary);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.ds-capture-target__chip span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ds-capture-target__chip--on {
  border-color: color-mix(
    in srgb,
    var(--color-primary) 42%,
    var(--color-secondary)
  );
  background: color-mix(
    in srgb,
    var(--color-primary) 10%,
    var(--color-surface)
  );
  color: var(--color-content-on-surface-strong);
}
.capture-target-enter-active,
.capture-target-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.capture-target-enter-from,
.capture-target-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
.ds-capture-opt {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-4);
  text-align: left;
  border-radius: var(--radius-2xl);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
  min-height: var(--target-touch);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.ds-capture-opt:active {
  transform: scale(0.98);
  background: var(--color-surface-strong);
}
.ds-capture-opt:disabled {
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.6;
}
.ds-capture-opt__tile {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-xl);
  margin-bottom: 4px;
}
.ds-capture-opt__title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.ds-capture-opt__sub {
  font-size: 12px;
  color: var(--color-content-secondary);
}
.ds-dictate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: var(--space-3);
  padding: var(--space-3);
  min-height: var(--target-touch);
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
  color: var(--color-content-on-surface-strong);
  font-size: 14px;
  font-weight: 600;
}
.ds-dictate:active {
  transform: scale(0.99);
}
.ds-dictate:disabled {
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
