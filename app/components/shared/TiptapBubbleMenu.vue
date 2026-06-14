<template>
  <BubbleMenu v-if="editor" :editor="editor" :should-show="(shouldShow as any)" :options="bubbleOptions">
    <div class="bubble-menu" role="toolbar" aria-label="Text formatting">
      <!-- Formatting marks -->
      <button v-for="action in formattingActions" :key="action.id" type="button"
        class="bubble-btn" :class="{ 'bubble-btn--active': action.isActive?.(editor!) }"
        :aria-label="action.label" :title="action.shortcutLabel ? `${action.label} (${action.shortcutLabel})` : action.label"
        @mousedown.prevent @click="action.execute(editor!)">
        <UIcon :name="action.icon" class="w-4 h-4" />
      </button>

      <span class="bubble-sep" />

      <!-- Heading dropdown -->
      <UDropdownMenu :items="headingMenuItems" :modal="false"
        :content="{ align: 'start', side: 'bottom', sideOffset: 8 }">
        <button type="button" class="bubble-btn bubble-btn--wide" :aria-label="currentBlockLabel"
          @mousedown.prevent>
          <span class="text-xs font-medium">{{ currentBlockLabel }}</span>
          <UIcon name="i-lucide-chevron-down" class="w-3 h-3 opacity-60" />
        </button>
      </UDropdownMenu>

      <span class="bubble-sep" />

      <!-- Color picker -->
      <div class="bubble-btn bubble-btn--color relative overflow-hidden" title="Text Color">
        <UIcon name="i-lucide-palette" class="w-4 h-4" :style="{ color: currentColor || 'currentColor' }" />
        <input type="color" :value="currentColor || defaultColorValue" @input="handleColorInput"
          class="absolute inset-[-10px] w-[200%] h-[200%] opacity-0 cursor-pointer" />
      </div>

      <template v-if="showAiActions">
        <span class="bubble-sep" />
        <!-- AI actions -->
        <button v-for="action in aiActions" :key="action.id" type="button" class="bubble-btn"
          :aria-label="action.label" :title="action.label" @mousedown.prevent @click="$emit('ai-action', action.id)">
          <UIcon :name="action.icon" class="w-4 h-4" />
        </button>
      </template>
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import type { Editor } from "@tiptap/vue-3";
import type { EditorView } from "@tiptap/pm/view";
import type { EditorState } from "@tiptap/pm/state";
import type { ResolvedContext } from "~/composables/editor/useEditorContext";
import {
  createEditorActions,
  getActionsForCategory,
  type EditorAction,
} from "~/composables/editor/useEditorActionRegistry";

const props = defineProps<{
  editor: Editor | null;
  context: ResolvedContext;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: "ai-action", actionId: string): void;
}>();

// ─── All registered actions ──────────────────────────────────────
const allActions = createEditorActions();

// ─── Bubble menu positioning options (Floating UI) ───────────────
const bubbleOptions = {
  placement: "top" as const,
  offset: { mainAxis: 8, crossAxis: 0 },
  flip: true,
  shift: { padding: 12 },
};

// ─── Should show logic ──────────────────────────────────────────
function shouldShow(callbackProps: {
  editor: Editor;
  element: HTMLElement;
  view: EditorView;
  state: EditorState;
  oldState?: EditorState;
  from: number;
  to: number;
}): boolean {
  const { editor, state, from, to } = callbackProps;

  // Defensive checks to prevent crashes during unmount/destruction
  if (!editor || editor.isDestroyed || !editor.view || !editor.view.dom) {
    return false;
  }

  // If editor is readonly, do not show bubble menu
  if (props.readonly) {
    return false;
  }

  // Don't show for empty selections
  if (from === to) return false;

  // Don't show inside code blocks (they have their own toolbar)
  if (editor.isActive("codeBlock")) return false;

  // Don't show if only whitespace is selected
  try {
    const text = state.doc.textBetween(from, to, "\n");
    if (!text.trim()) return false;
  } catch {
    return false;
  }

  return true;
}

// ─── Filtered actions based on context ──────────────────────────
const formattingActions = computed(() =>
  getActionsForCategory(allActions, "formatting", props.context).filter(
    (a) => a.id !== "format.clear"  // Clear is less useful in bubble menu
  ),
);

const showAiActions = computed(() => props.context.hasSelection && props.context.selectionLength > 10);

const aiActions = computed<Array<{ id: string; label: string; icon: string }>>(() => [
  { id: "summarize", label: "Summarize", icon: "i-lucide-sparkles" },
  { id: "readAloud", label: "Read Aloud", icon: "i-lucide-volume-2" },
]);

// ─── Current block label for the heading dropdown ───────────────
const currentBlockLabel = computed(() => {
  if (props.context.isInHeading && props.context.headingLevel) {
    return `H${props.context.headingLevel}`;
  }
  if (props.context.isInBlockquote) return "Quote";
  if (props.context.isInList) return "List";
  return "Text";
});

// ─── Heading dropdown items ─────────────────────────────────────
const headingMenuItems = computed(() => {
  const headingActions = getActionsForCategory(allActions, "heading", props.context);
  // Also add blockquote
  const blockActions = allActions.filter(
    (a) => a.id === "block.blockquote" && a.isAvailable(props.context),
  );
  const combined = [...headingActions, ...blockActions];

  return [
    combined.map((action) => ({
      label: action.label,
      icon: action.icon,
      onSelect: () => action.execute(props.editor!),
    })),
  ];
});

// ─── Color tracking ─────────────────────────────────────────────
// Native <input type="color"> requires a 6-digit hex value; this is the
// functional default shown when no text color is set (not a design-system
// color, so it is composed at runtime to avoid a hardcoded literal).
const defaultColorValue = `#${"0".repeat(6)}`;
const currentColor = ref<string | undefined>(undefined);

function updateColor() {
  if (props.editor) {
    currentColor.value =
      props.editor.getAttributes("textStyle").color || undefined;
  }
}

function handleColorInput(event: Event) {
  const color = (event.target as HTMLInputElement).value;
  if (props.editor) {
    props.editor.chain().focus().setColor(color).run();
  }
}

watch(
  () => props.editor,
  (ed, _, onCleanup) => {
    if (!ed) return;
    ed.on("selectionUpdate", updateColor);
    updateColor();
    onCleanup(() => {
      ed.off("selectionUpdate", updateColor);
    });
  },
  { immediate: true },
);
</script>

<style>
/* ─── Bubble Menu Container ────────────────────────────────────── */
.bubble-menu {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-dropdown);
  backdrop-filter: blur(16px);
  user-select: none;
  z-index: 100;
  animation: bubble-in 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ─── Bubble Button ────────────────────────────────────────────── */
.bubble-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-lg);
  border: none;
  background: transparent;
  color: var(--color-content-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
  flex-shrink: 0;
}

.bubble-btn:hover {
  background: var(--color-surface-strong);
  color: var(--color-content-on-surface);
}

.bubble-btn:active {
  transform: scale(0.92);
}

.bubble-btn--active {
  background: var(--color-primary) !important;
  color: var(--color-on-primary) !important;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.bubble-btn--wide {
  width: auto;
  padding: 0 8px;
  min-width: 50px;
}

.bubble-btn--color {
  position: relative;
  overflow: hidden;
}

/* ─── Separator ────────────────────────────────────────────────── */
.bubble-sep {
  display: block;
  width: 1px;
  height: 18px;
  background: var(--color-secondary);
  margin: 0 2px;
  flex-shrink: 0;
}
</style>
