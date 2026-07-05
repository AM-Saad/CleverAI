<template>
  <div class="editor">
    <!-- top bar -->
    <header class="editor__bar">
      <UiIconButton
        icon="i-lucide-chevron-left"
        label="Back to notes"
        @click="emit('back')"
      />
      <SyncBadge :state="syncState" />
      <div class="editor__bar-actions">
        <UiIconButton
          icon="i-lucide-share"
          label="Share"
          @click="emit('share')"
        />
        <UiIconButton
          icon="i-lucide-more-horizontal"
          label="More"
          @click="emit('more')"
        />
      </div>
    </header>

    <!-- title -->
    <input
      :value="title"
      class="editor__title"
      placeholder="Untitled note"
      dir="auto"
      @input="emit('update:title', ($event.target as HTMLInputElement).value)"
    />
    <!-- design-allow: native editor title field -->

    <!-- tags (editable) -->
    <div class="editor__tags">
      <UiPill
        v-for="t in tags"
        :key="t"
        size="sm"
        :label="`# ${t}`"
        color="var(--color-primary)"
        variant="outline"
        active
        max-width="160px"
      >
        <template #icon>
          <UiPillIcon
            name="i-lucide-x"
            button
            size="sm"
            :label="`Remove ${t}`"
            @click="removeTag(t)"
          />
        </template>
      </UiPill>
      <input
        v-if="addingTag"
        ref="tagInput"
        v-model="newTag"
        class="editor__tag-input"
        placeholder="tag"
        @keydown.enter.prevent="commitTag"
        @blur="commitTag"
      />
      <!-- design-allow: native tag input -->
      <UiPill
        v-else
        clickable
        size="sm"
        label="tag"
        icon="i-lucide-plus"
        color="var(--color-content-secondary)"
        variant="dashed"
        max-width="82px"
        @click="startAddTag"
      />
    </div>

    <!-- CANVAS note → full Konva editor -->
    <CanvasNoteEditor
      v-if="noteType === 'CANVAS'"
      :note-id="noteId"
      :initial-metadata="metadata as CanvasNoteMetadata | undefined"
      class="editor__canvas"
      @update="(m: CanvasNoteMetadata) => emit('update:metadata', m)"
    />

    <!-- MATH note → KaTeX/mathjs editor -->
    <MathNoteEditor
      v-else-if="noteType === 'MATH'"
      :note-id="noteId"
      :initial-metadata="metadata as MathNoteMetadata | undefined"
      class="editor__canvas"
      @update="(m: MathNoteMetadata) => emit('update:metadata', m)"
    />

    <!-- TEXT note → contenteditable body + format bar -->
    <template v-else>
      <div
        ref="body"
        class="editor__body tiptap"
        contenteditable="true"
        dir="auto"
        role="textbox"
        aria-multiline="true"
        @input="onInput"
        @mouseup="syncSelection"
        @keyup="syncSelection"
        @touchend="syncSelection"
      />

      <SelectionAiBubble
        :visible="bubble.visible"
        :x="bubble.x"
        :y="bubble.y"
        @action="onAiAction"
      />

      <button
        v-if="dictating"
        type="button"
        class="editor__dictating"
        @click="stopDictation"
      >
        <!-- design-allow: native dictation control -->
        <span class="editor__dictating-dot" /> Listening… tap to stop
      </button>

      <!-- format bar -->
      <nav class="editor__format" aria-label="Formatting">
        <button
          v-for="f in formats"
          :key="f.cmd"
          type="button"
          class="editor__fmt"
          :aria-label="f.label"
          @mousedown.prevent="run(f)"
        >
          <!-- design-allow: native formatting controls -->
          <UiIcon v-if="f.icon" :name="f.icon" class="h-[18px] w-[18px]" />
          <span v-else>{{ f.glyph }}</span>
        </button>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * MobileNoteEditor — focused contenteditable editor with a selection-anchored AI
 * bubble and a bottom format bar. AI is reachable ONLY from a selection (or the
 * ✦ format action acting on the current selection), never as a floating chat.
 */
import { ref, reactive, onMounted, watch, nextTick } from "vue";
import SelectionAiBubble from "./SelectionAiBubble.vue";
import CanvasNoteEditor from "./CanvasNoteEditor.vue";
import MathNoteEditor from "./MathNoteEditor.vue";
import SyncBadge from "~/components/shell/SyncBadge.vue";
import type {
  CanvasNoteMetadata,
  MathNoteMetadata,
} from "@@/shared/utils/note.contract";

const props = defineProps<{
  noteId: string;
  title: string;
  content: string;
  tags: string[];
  syncState: "local" | "synced";
  noteType?: string;
  metadata?: Record<string, unknown>;
}>();

const emit = defineEmits<{
  (e: "update:title", v: string): void;
  (e: "update:content", v: string): void;
  (e: "update:tags", v: string[]): void;
  (e: "update:metadata", v: CanvasNoteMetadata | MathNoteMetadata): void;
  (e: "convert", noteType: "CANVAS" | "MATH"): void;
  (
    e: "ai",
    payload: { kind: "explain" | "rewrite" | "cards"; text: string },
  ): void;
  (e: "back"): void;
  (e: "share"): void;
  (e: "more"): void;
}>();

const body = ref<HTMLElement | null>(null);
const bubble = reactive({ visible: false, x: 0, y: 0, text: "" });

// Tag editing
const addingTag = ref(false);
const newTag = ref("");
const tagInput = ref<HTMLInputElement | null>(null);
function startAddTag() {
  addingTag.value = true;
  nextTick(() => tagInput.value?.focus());
}
function commitTag() {
  const t = newTag.value.trim().replace(/^#/, "").trim();
  if (t && !props.tags.includes(t)) emit("update:tags", [...props.tags, t]);
  newTag.value = "";
  addingTag.value = false;
}
function removeTag(t: string) {
  emit(
    "update:tags",
    props.tags.filter((x) => x !== t),
  );
}

type FormatAction = {
  cmd: "bold" | "italic" | "underline" | "math" | "list" | "canvas" | "ai";
  label: string;
  glyph?: string;
  icon?: string;
};

const formats: FormatAction[] = [
  { cmd: "bold", label: "Bold", glyph: "B" },
  { cmd: "italic", label: "Italic", glyph: "I" },
  { cmd: "underline", label: "Underline", glyph: "U" },
  { cmd: "math", label: "Math", glyph: "∑" },
  { cmd: "list", label: "List", icon: "i-lucide-list" },
  { cmd: "canvas", label: "Canvas", icon: "i-lucide-pen-tool" },
  { cmd: "ai", label: "AI", icon: "i-lucide-sparkles" },
];

function setBodyHtml(html: string) {
  if (body.value && body.value.innerHTML !== html)
    body.value.innerHTML = html || "";
}

onMounted(() => setBodyHtml(props.content));
// Re-init when navigating between notes, OR when the type switches back to TEXT
// (the body div is freshly mounted by v-if, so onMounted won't re-run for it).
// Uncontrolled during typing to preserve the caret.
watch(
  () => [props.noteId, props.noteType] as const,
  () => nextTick(() => setBodyHtml(props.content)),
);

function onInput() {
  emit("update:content", body.value?.innerHTML ?? "");
}

function syncSelection() {
  const sel = window.getSelection();
  const el = body.value;
  if (!sel || sel.isCollapsed || !el || sel.rangeCount === 0) {
    bubble.visible = false;
    return;
  }
  const range = sel.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) {
    bubble.visible = false;
    return;
  }
  const text = sel.toString().trim();
  if (!text) {
    bubble.visible = false;
    return;
  }
  const rect = range.getBoundingClientRect();
  const host = el.getBoundingClientRect();
  bubble.x = rect.left - host.left + rect.width / 2 + el.scrollLeft;
  bubble.y = rect.top - host.top - 8 + el.scrollTop;
  bubble.text = text;
  bubble.visible = true;
}

function onAiAction(kind: "explain" | "rewrite" | "cards") {
  bubble.visible = false;
  emit("ai", { kind, text: bubble.text });
}

function currentSelectionText(): string {
  return (
    window.getSelection()?.toString().trim() ||
    body.value?.innerText.trim() ||
    ""
  );
}

function run(f: { cmd: string }) {
  switch (f.cmd) {
    case "bold":
    case "italic":
    case "underline":
      document.execCommand(f.cmd);
      onInput();
      break;
    case "list":
      document.execCommand("insertUnorderedList");
      onInput();
      break;
    case "ai":
      emit("ai", { kind: "cards", text: currentSelectionText() });
      break;
    case "canvas":
      emit("convert", "CANVAS");
      break;
    case "math":
      emit("convert", "MATH");
      break;
    default:
      break;
  }
}

// ── Dictation (speech → note body) ──────────────────────────────────────────
const dictating = ref(false);
let recognition: any = null;
function startDictation(): boolean {
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) return false;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  recognition.onresult = (e: any) => {
    let text = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) text += e.results[i][0].transcript;
    }
    if (text && body.value) {
      const sep = body.value.innerText.trim() ? " " : "";
      body.value.innerHTML += sep + text.trim();
      onInput();
    }
  };
  recognition.onend = () => (dictating.value = false);
  recognition.onerror = () => (dictating.value = false);
  recognition.start();
  dictating.value = true;
  return true;
}
function stopDictation() {
  recognition?.stop();
  dictating.value = false;
}

defineExpose({
  focusBody: () => body.value?.focus(),
  startDictation,
  stopDictation,
});
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: var(--space-2) var(--space-4) 0;
  position: relative;
}
.editor__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
}
.editor__bar-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
}
.editor__title {
  margin-top: var(--space-3);
  border: none;
  background: transparent;
  outline: none;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  line-height: 1.15;
  color: var(--color-content-on-surface-strong);
}
.editor__title::placeholder {
  color: var(--color-content-disabled);
}
.editor__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--space-2);
}
.editor__tag-input {
  width: 70px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
  background: var(--color-surface-subtle);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  outline: none;
}
.editor__body {
  flex: 1;
  margin-top: var(--space-4);
  padding-bottom: 80px;
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--color-content-on-surface);
  outline: none;
}
.editor__body:empty::before {
  content: "Start writing…";
  color: var(--color-content-disabled);
}
.editor__canvas {
  flex: 1;
  min-height: 0;
  margin: var(--space-3) calc(-1 * var(--space-4)) 0;
}
.editor__dictating {
  position: fixed;
  left: 50%;
  bottom: calc(64px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-full);
  background: var(--color-error);
  color: var(--color-white);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-card-hover);
  z-index: var(--z-popover);
}
.editor__dictating-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-white);
  animation: pulse-soft 1.2s ease-in-out infinite;
}
.editor__body ::selection {
  background: color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.editor__format {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  margin: 0 calc(-1 * var(--space-4));
  padding: var(--space-2) var(--space-4)
    calc(var(--space-2) + env(safe-area-inset-bottom));
  background: var(--color-background);
  border-top: 1px solid var(--color-secondary);
}
.editor__fmt {
  display: grid;
  place-items: center;
  flex: 1;
  height: 40px;
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-content-on-surface);
}
.editor__fmt:active {
  background: var(--color-surface-subtle);
}
@media (prefers-reduced-motion: reduce) {
  .ds-save-pulse {
    animation: none;
  }
}
</style>
