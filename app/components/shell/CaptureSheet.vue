<template>
  <UiSheet
    :open="open"
    title="Capture"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="showWorkspaceTarget" class="ds-capture-target">
      <button type="button" class="ds-capture-target__button" :aria-expanded="isWorkspacePickerOpen" aria-controls="capture-workspace-options" :disabled="workspaceLoading && !selectedWorkspace" @click="toggleWorkspacePicker"> <!-- design-allow: compact workspace target control in capture sheet -->
        <span class="ds-capture-target__main">
          <span
            class="ds-capture-target__dot"
            :style="{ background: selectedWorkspaceAccent }"
          />
          <span class="ds-capture-target__copy">
            <span class="ds-capture-target__eyebrow">Workspace</span>
            <span class="ds-capture-target__name">{{
              selectedWorkspaceLabel
            }}</span>
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
          <button v-for="workspace in pickerWorkspaces" :key="workspace.id" type="button" class="ds-capture-target__chip" :class="{ 'ds-capture-target__chip--on': workspace.id === selectedWorkspaceId }" role="option" :aria-selected="workspace.id === selectedWorkspaceId" @click="selectWorkspace(workspace.id)"> <!-- design-allow: native compact workspace option -->
            <span
              class="ds-capture-target__chip-dot"
              :style="{ background: accentFor(workspace) }"
            />
            <span>{{ workspace.title }}</span>
          </button>
        </div>
      </Transition>
    </div>

    <div class="grid grid-cols-2 gap-3 pb-1">
      <button v-for="opt in options" :key="opt.key" type="button" class="ds-capture-opt" :disabled="isActionWaitingForWorkspace(opt.key)" @click="choose(opt.key)"> <!-- design-allow: shell chrome, native capture tile -->
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

    <button type="button" class="ds-dictate" :disabled="isActionWaitingForWorkspace('dictate')" @click="choose('dictate')"> <!-- design-allow: shell chrome, native press-and-hold dictate -->
      <UiIcon name="i-lucide-mic" class="h-4 w-4" />
      Hold to dictate a quick note…
    </button>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * CaptureSheet — the center-FAB target. Every create path (note, word, upload,
 * AI) lives in this one sheet, per the handoff "AI is anchored to a source"
 * intent: each option routes into a real flow rather than a floating chat.
 */
import { computed, ref, watch } from "vue";
import { accentVarFor, tint } from "~/composables/useAccentColor";
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace";
import type { Workspace } from "@@/shared/utils/workspace.contract";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "select", payload: CaptureSelection): void;
}>();

type CaptureAction = "note" | "word" | "upload" | "ai" | "dictate";
type CaptureSelection = { key: CaptureAction; workspaceId: string | null };

const {
  workspaces,
  recentWorkspaces,
  activeId,
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
    key: "upload" as const,
    title: "Upload",
    subtitle: "PDF or image",
    icon: "i-lucide-upload",
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
  "upload",
  "ai",
  "dictate",
]);
const selectedWorkspaceId = ref<string | null>(null);
const isWorkspacePickerOpen = ref(false);

const workspaceList = computed<Workspace[]>(() => workspaces.value ?? []);
const showWorkspaceTarget = computed(
  () => workspaceLoading.value || workspaceList.value.length > 0,
);
const selectedWorkspace = computed<Workspace | null>(
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

function accentFor(workspace: Workspace) {
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

function choose(key: CaptureAction) {
  emit("select", {
    key,
    workspaceId: isWorkspaceScoped(key) ? selectedWorkspaceId.value : null,
  });
  emit("update:open", false);
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      isWorkspacePickerOpen.value = false;
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
