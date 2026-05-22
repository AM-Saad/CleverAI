<template>
  <div v-if="editor" ref="editorContainerRef"
    class="container relative flex flex-col p-1 h-full min-h-0 w-full overflow-y-auto">

    <div class="flex flex-col w-full">
      <UContextMenu :items="props.readonly ? [] : contextMenuItems">
        <EditorContent :editor="editor" class="flex-1 pt-6" />
      </UContextMenu>
    </div>

    <!-- Bubble Menu (floating toolbar on text selection) -->
    <SharedTiptapBubbleMenu :editor="editor" :context="editorContext" :readonly="props.readonly"
      @ai-action="handleBubbleAiAction" />

    <!-- Autocomplete floating dropdown -->
    <Transition name="auto-suggestions">
      <div v-if="autoPosition && autoSuggestions.length"
        :style="{ top: autoPosition.top + 'px', left: autoPosition.left + 'px' }"
        class="absolute z-50 min-w-36 bg-surface border border-secondary rounded-xl shadow-lg overflow-hidden"
        role="listbox" aria-label="Suggestions">
        <button v-for="(item, i) in autoSuggestions" :key="item" type="button" role="option"
          :aria-selected="i === autoActiveIndex" :class="[
            'w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-3 transition-colors',
            i === autoActiveIndex
              ? 'bg-primary/10 text-primary'
              : 'text-content-on-surface hover:bg-surface-strong',
          ]" @mousedown.prevent="acceptSuggestion(item)">
          <span>{{ item }}</span>
          <kbd v-if="i === 0"
            class="shrink-0 hidden sm:inline-flex items-center rounded border border-secondary px-1 py-0.5 text-[10px] font-mono text-content-secondary">Tab</kbd>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, nextTick, onBeforeUnmount, onMounted, watch, computed } from "vue";
import type { NavigationMenuItem } from "@nuxt/ui";
import type {
  Selection as PMSelection,
} from "prosemirror-state";
import Document from "@tiptap/extension-document";
import { ListItem, TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
// note: explicit Drop cursor intentionally omitted to avoid duplicate warnings
import { Editor, EditorContent, VueNodeViewRenderer } from "@tiptap/vue-3";
import { initCollaboration } from "@/utils/";
import { normalizeWorkspaceNoteContent } from "@@/shared/utils/workspaceNote";
import { useTextSummarization } from '~/composables/ai/useTextSummarization';
import { usePredictionaryInput } from '~/composables/usePredictionaryInput';
import { useEditorContext } from '~/composables/editor/useEditorContext';
import {
  createEditorActions,
  getActionsForCategory,
  getContextMenuGroups,
  toMenuItems,
} from '~/composables/editor/useEditorActionRegistry';
import { KeyboardShortcutsExtension } from '~/extensions/tiptap/KeyboardShortcuts';

import CodeBlockNode from './CodeBlockNode.vue';
import Paper from './Paper.js';

// Create lowlight instance with common languages (~35 languages)
const lowlight = createLowlight(common);


// ---------- Types ----------
type CollaborationHandle = {
  ydoc?: unknown;
  provider?: { destroy?: () => void; disconnect?: () => void };
  collaborationExtension?: unknown;
  cursorExtension?: unknown;
  cleanup?: () => Promise<void>;
  [k: string]: any;
} | null;

// ---------- Custom nodes ----------
const CustomDocument = Document.extend({
  content: "block+",
});

const WorkspaceNoteDocument = Document.extend({
  content: "heading block*",
});

const WorkspaceNotePlaceholder = Placeholder.configure({
  emptyEditorClass: "is-workspace-note-editor-empty",
  emptyNodeClass: "is-workspace-note-node-empty",
  placeholder: ({ node, pos }) => {
    if (node.type.name === "heading" && pos === 0) {
      return "What's the title?";
    }

    return "";
  },
  showOnlyCurrent: true,
  includeChildren: false,
  showOnlyWhenEditable: true,
});

const WorkspaceNoteBehavior = Extension.create({
  name: "workspaceNoteBehavior",

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const currentNode = $from.parent;

        if (
          props.documentMode !== "workspace-note" ||
          currentNode.type.name !== "paragraph" ||
          $from.parentOffset !== 0 ||
          $from.before($from.depth) <= 1
        ) {
          return false;
        }

        const previousNode = this.editor.state.doc.resolve($from.before($from.depth) - 1).nodeBefore;
        if (previousNode?.type.name !== "heading") {
          return false;
        }

        // Keep the body from merging back into the protected title line.
        return true;
      },
    };
  },
});

const CustomTaskItem = TaskItem.extend({
  content: "paragraph block*",
});

// const CustomPaper = Document.extend({
//   content: "paper",
// });



// ---------- reactive refs ----------
const editor = shallowRef<Editor | null>(null);
const isApplyingExternalValue = ref(false);
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "addToMaterial", value: string): void;
  (e: "blur"): void;
}>();
const collaborationHandle = ref<CollaborationHandle>(null);
const props = withDefaults(defineProps<{
  id?: string;
  isFullScreen?: boolean;
  modelValue: string;
  /** When true, editor is not editable (passive split-pane mode) */
  readonly?: boolean;
  documentMode?: "default" | "workspace-note";
}>(), {
  documentMode: "default",
});

const normalizeEditorContent = (value?: string | null) => {
  if (props.documentMode !== "workspace-note") {
    return value || "";
  }

  return normalizeWorkspaceNoteContent(value);
};

// Expose editor publicly
defineExpose({ editor });

// ---------- Autocomplete (Predictionary) ----------
const editorContainerRef = ref<HTMLElement | null>(null);
const autoActiveIndex = ref(0);
const autoPosition = ref<{ top: number; left: number } | null>(null);
const { suggestions: autoSuggestions, onInput: autoOnInput, onAccept: autoOnAccept } = usePredictionaryInput();

function getCurrentWord(): string {
  if (!editor.value) return '';
  const state = editor.value.state;
  const { from } = state.selection;
  try {
    const textBefore = state.doc.textBetween(
      Math.max(0, state.selection.$from.start()),
      from,
      '\n',
    );
    return textBefore.match(/(\S+)$/)?.[1] ?? '';
  } catch {
    return '';
  }
}

function acceptSuggestion(word: string) {
  if (!editor.value || props.readonly || !word) return;
  const state = editor.value.state;
  const { from } = state.selection;
  let currentWord = '';
  try {
    const textBefore = state.doc.textBetween(
      Math.max(0, state.selection.$from.start()),
      from,
      '\n',
    );
    currentWord = textBefore.match(/(\S+)$/)?.[1] ?? '';
  } catch { /* ignore */ }
  editor.value
    .chain()
    .focus()
    .deleteRange({ from: from - currentWord.length, to: from })
    .insertContent(word + ' ')
    .run();
  autoOnAccept(word);
  autoActiveIndex.value = 0;
  autoPosition.value = null;
}

function updateAutoState() {
  if (!editor.value || props.readonly) {
    autoPosition.value = null;
    return;
  }
  const word = getCurrentWord();

  if (word.length < 3) {
    autoOnInput('');
    autoActiveIndex.value = 0;
    autoPosition.value = null;
    return;
  }

  autoOnInput(word);
  autoActiveIndex.value = 0;
  if (autoSuggestions.value.length === 0) {
    autoPosition.value = null;
    return;
  }
  // Position dropdown below current cursor
  try {
    const { from } = editor.value.state.selection;
    const coords = editor.value.view.coordsAtPos(from);
    const containerRect = editorContainerRef.value?.getBoundingClientRect();
    const scrollTop = editorContainerRef.value?.scrollTop ?? 0;
    if (containerRect) {
      autoPosition.value = {
        top: coords.bottom - containerRect.top + scrollTop + 4,
        left: Math.min(
          coords.left - containerRect.left,
          containerRect.width - 160,
        ),
      };
    }
  } catch {
    autoPosition.value = null;
  }
}

// ---------- Text-to-Speech Integration ----------
const isSpeaking = ref(false);
const ttsAvailable = ref(false);
const ttsError = ref<Error | null>(null);

// Check if browser supports Web Speech API
onMounted(() => {
  ttsAvailable.value = 'speechSynthesis' in window;
  if (!ttsAvailable.value) {
    ttsError.value = new Error('Text-to-speech not supported in this browser');
  }
});

async function handleReadAloud() {
  const selectedText = getSelectedText();
  if (!selectedText || !selectedText.trim()) {
    console.warn('No text selected to read aloud');
    return;
  }

  if (!ttsAvailable.value) {
    console.error('Text-to-speech not available');
    return;
  }

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  isSpeaking.value = true;
  ttsError.value = null;

  try {
    const utterance = new SpeechSynthesisUtterance(selectedText);

    // Configure voice (use default or find English voice)
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    // Configure speech parameters
    utterance.rate = 1.0;  // Speed (0.1 to 10)
    utterance.pitch = 1.0; // Pitch (0 to 2)
    utterance.volume = 1.0; // Volume (0 to 1)

    utterance.onend = () => {
      isSpeaking.value = false;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      ttsError.value = new Error('Failed to synthesize speech');
      isSpeaking.value = false;
    };

    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.error('Text-to-speech error:', error);
    ttsError.value = error as Error;
    isSpeaking.value = false;
  }
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
  isSpeaking.value = false;
}



// ---------- AI Summarization Integration ----------
const {
  startSummarization,
  currentSummary,
  isSummarizing,
  isDownloading,
  progress: summaryProgress,
  summaryError
} = useTextSummarization({
  immediate: false,
});

// Track the position where summary should be inserted
const summaryInsertPosition = ref<number | null>(null);

// Watch for summary completion and insert it
watch(currentSummary, (summary) => {
  if (props.readonly) return;
  if (summary && summaryInsertPosition.value !== null && editor.value) {
    console.log('Summary ready, inserting into editor:', summary);

    editor.value
      .chain()
      .focus()
      .setTextSelection(summaryInsertPosition.value)
      .insertContent(`\n\n**Summary:** ${summary}\n\n`)
      .run();

    console.log('Summary inserted at position:', summaryInsertPosition.value);
    summaryInsertPosition.value = null; // Reset
  }
});

function handleSummarize() {
  if (props.readonly) return;
  const selectedText = getSelectedText();
  if (!selectedText || !selectedText.trim()) {
    console.warn('No text selected to summarize');
    return;
  }

  if (editor.value) {
    // Store the position where we want to insert the summary
    const { to } = editor.value.state.selection;
    summaryInsertPosition.value = to;

    console.log('Starting non-blocking summarization for text:', selectedText.substring(0, 100) + '...');
    console.log('Will insert at position:', to);

    // Start summarization in background (non-blocking)
    startSummarization(selectedText, {
      maxLength: 130,
      minLength: 30,
    });
  }
}


// ─── Editor Context & Action Registry ────────────────────────────
const { context: editorContext } = useEditorContext(editor);
const registeredActions = createEditorActions();

/** Handle AI actions triggered from the BubbleMenu */
function handleBubbleAiAction(actionId: string) {
  if (props.readonly) return;
  switch (actionId) {
    case 'summarize':
      handleSummarize();
      break;
    case 'readAloud':
      isSpeaking.value ? stopSpeaking() : handleReadAloud();
      break;
  }
}

// ─── Dynamic Context Menu ────────────────────────────────────────
const contextMenuItems = computed(() => {
  if (props.readonly) return [];
  const ctx = editorContext.value;
  const ed = editor.value;
  if (!ed) return [];

  const groups: Array<Array<{
    label: string;
    icon: string;
    disabled?: boolean;
    onSelect: () => void;
  }>> = [];

  // ── Group 1: Context-specific actions ──────────────────────
  // Table actions (when cursor is inside a table)
  if (ctx.isInTable) {
    const tableActions = getActionsForCategory(registeredActions, 'table', ctx);
    if (tableActions.length) {
      groups.push(toMenuItems(tableActions, ed));
    }
  }

  // Task actions (when cursor is inside a task item)
  if (ctx.isInTaskItem) {
    const taskActions = getActionsForCategory(registeredActions, 'task', ctx);
    if (taskActions.length) {
      groups.push(toMenuItems(taskActions, ed));
    }
  }

  // ── Group 2: Formatting (when text is selected, not in code block)
  if (ctx.hasSelection && !ctx.isInCodeBlock) {
    const formatActions = getActionsForCategory(registeredActions, 'formatting', ctx);
    if (formatActions.length) {
      groups.push(toMenuItems(formatActions, ed));
    }
  }

  // ── Group 3: Insert actions (when no selection or general use)
  if (!ctx.isInCodeBlock && !ctx.isInTable) {
    const insertActions = getActionsForCategory(registeredActions, 'insert', ctx);
    if (insertActions.length) {
      groups.push(toMenuItems(insertActions, ed));
    }
  }

  // ── Group 4: AI & custom actions (always available) ────────
  const selectedText = getSelectedText();
  const hasSelection = selectedText && selectedText.trim().length > 0;

  const aiAndCustomActions: Array<{
    label: string;
    icon: string;
    disabled?: boolean;
    onSelect: () => void;
  }> = [];

  // Add to Material
  aiAndCustomActions.push({
    label: 'Add To Material',
    icon: 'i-lucide-book-marked',
    disabled: !hasSelection,
    onSelect: () => {
      if (selectedText) {
        emit('addToMaterial', selectedText);
      }
    },
  });

  // Read Aloud
  aiAndCustomActions.push({
    label: isSpeaking.value ? 'Stop Reading' : ttsError.value ? 'TTS Unavailable' : 'Read Aloud',
    icon: isSpeaking.value ? 'i-lucide-volume-x' : ttsError.value ? 'i-lucide-alert-circle' : 'i-lucide-volume-2',
    disabled: !hasSelection || !ttsAvailable.value,
    onSelect: isSpeaking.value ? stopSpeaking : handleReadAloud,
  });

  // Summarize
  aiAndCustomActions.push({
    label: isSummarizing.value
      ? 'Summarizing...'
      : isDownloading.value
        ? 'Downloading Model...'
        : 'Summarize Text',
    icon: isSummarizing.value
      ? 'i-lucide-loader'
      : isDownloading.value
        ? 'i-lucide-download'
        : 'i-lucide-sparkles',
    disabled: !hasSelection || isSummarizing.value || isDownloading.value,
    onSelect: handleSummarize,
  });

  groups.push(aiAndCustomActions);

  return groups;
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const current = editor.value.getHTML();
    const normalizedValue = normalizeEditorContent(value);
    if (current === normalizedValue) return;
    isApplyingExternalValue.value = true;
    editor.value.commands.setContent(normalizedValue);
    isApplyingExternalValue.value = false;
  },
  { immediate: true }
);

watch(
  () => props.readonly,
  (isReadonly) => {
    if (!editor.value) return;
    editor.value.setEditable(!isReadonly);
    if (isReadonly) {
      autoPosition.value = null;
      if (isSpeaking.value) {
        stopSpeaking();
      }
    }
  }
);

// End Navigation menu items

// ---------- lifecycle cleanup ----------
onBeforeUnmount(async () => {
  // Stop any ongoing speech
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  if (collaborationHandle.value?.cleanup) {
    try {
      await collaborationHandle.value.cleanup();
    } catch (e) {
      /* ignore */
    }
    collaborationHandle.value = null;
  }

  const instance = editor.value;
  editor.value = null;

  if (instance) {
    try {
      instance.destroy();
    } catch (e) {
      /* ignore */
    }
  }
});

// ---------- mount and initialization ----------
onMounted(async () => {
  // create editor instance
  // Autocomplete Tiptap extension — handles Tab / Arrow / Escape while dropdown is open
  const AutocompleteExtension = Extension.create({
    name: 'predictionary',
    addKeyboardShortcuts() {
      return {
        Tab: () => {
          const activeSuggestion = autoSuggestions.value[autoActiveIndex.value];
          if (activeSuggestion) {
            acceptSuggestion(activeSuggestion);
            return true;
          }
          return false;
        },
        ArrowDown: () => {
          if (autoPosition.value && autoSuggestions.value.length > 0) {
            autoActiveIndex.value = Math.min(
              autoActiveIndex.value + 1,
              autoSuggestions.value.length - 1,
            );
            return true;
          }
          return false;
        },
        ArrowUp: () => {
          if (autoPosition.value && autoSuggestions.value.length > 0) {
            autoActiveIndex.value = Math.max(autoActiveIndex.value - 1, 0);
            return true;
          }
          return false;
        },
        Escape: () => {
          if (autoPosition.value) {
            autoPosition.value = null;
            return true;
          }
          return false;
        },
      };
    },
  });

  editor.value = new Editor({
    extensions: [
      // disable StarterKit document + codeBlock to avoid duplicate names
      StarterKit.configure({ document: false, codeBlock: false }),
      props.documentMode === "workspace-note" ? WorkspaceNoteDocument : CustomDocument,
      ...(props.documentMode === "workspace-note" ? [WorkspaceNotePlaceholder, WorkspaceNoteBehavior] : []),
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle,
      Image,
      // drop cursor intentionally omitted
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      CustomTaskItem,
      AutocompleteExtension,
      KeyboardShortcutsExtension,
      // Syntax-highlighted code blocks via lowlight
      CodeBlockLowlight.extend({
        addNodeView() {
          return VueNodeViewRenderer(CodeBlockNode);
        },
      }).configure({
        lowlight,
        defaultLanguage: null,
      }),
      Paper,
    ],
    content: normalizeEditorContent(props.modelValue),
    editable: !props.readonly,
  });
  const editorInstance = editor.value;
  if (!editorInstance) return;

  // Emit updates for v-model
  editorInstance.on("update", () => {
    if (isApplyingExternalValue.value) return;
    const html = editorInstance.getHTML();
    emit("update:modelValue", html || "");
    if (!props.readonly) {
      updateAutoState();
    }
  });

  editorInstance.on("blur", () => {
    emit("blur");
  });

  // dev transaction logger (safe)
  try {
    editorInstance.on("transaction", ({ transaction }) => {
      try {
        // console.group('TipTap transaction',transaction)
        // console.log(transaction.steps.map(s => s.constructor.name))
        // console.log(transaction.steps.map(s => s.toJSON()))
        // console.groupEnd()
      } catch (e) {
        /* ignore */
      }
    });
  } catch (e) {
    /* ignore registration errors */
  }

  // ensure view is mounted
  await nextTick();

  // init collaboration defensively (disabled for now)
  // try {
  //   const result = await initCollaboration(editor.value!, { roomName: 'my-doc' })
  //   if (result.ok) {
  //     collaborationHandle.value = result as CollaborationHandle
  //   } else {
  //     console.warn('Collab init skipped', result)
  //   }
  // } catch (err) {
  //   console.warn('Collab init error', err)
  // }
});

// ---------- selection helpers ----------
function getSelectedText(): string | null {
  if (!editor.value) return null;
  const state = editor.value.state;
  const { from, to } = state.selection;
  // textBetween will extract text across nodes; pass null to not include leaf node chars
  try {
    return state.doc.textBetween(from, to, "\n");
  } catch (e) {
    console.warn("getSelectedText failed", e);
    return null;
  }
}

// ---------- methods used by template (other utilities) ----------
</script>

<style>
/* container class used in your template */
.tiptap {
  color: inherit;
  font-family: "Inter", sans-serif;
}

/* Autocomplete dropdown transition */
.auto-suggestions-enter-active,
.auto-suggestions-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.auto-suggestions-enter-from,
.auto-suggestions-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.tiptap:focus-visible {
  outline: none;
}

.tiptap .is-workspace-note-node-empty:not([data-placeholder=""])::before {
  color: var(--color-content-disabled, #9ca3af);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.tiptap h1:first-child {
  margin-bottom: 0.75rem;
  font-weight: 700;
}

/* Basic list spacing */
.tiptap ul,
.tiptap ol {
  padding: 0 1rem;
  margin: 1.25rem 1rem 1.25rem 0.4rem;
  list-style: unset;
  /* taskList is custom, remove bullets */
}

.tiptap p {
  font-size: 0.8rem;
}

/* paragraphs inside list items — less spacing */
.tiptap ul li p,
.tiptap ol li p {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

/* headings */
.tiptap h1 {
  font-size: 1.4rem;
}

.tiptap h2 {
  font-size: 1.2rem;
}

/* Table styles */
.tiptap table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: 0.75rem 0;
  overflow: hidden;
}

.tiptap table td,
.tiptap table th {
  min-width: 1em;
  border: 1px solid var(--color-border-secondary, #e2e8f0);
  padding: 4px 8px;
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
  font-size: 0.8rem;
}

.tiptap table th {
  font-weight: 600;
  background-color: var(--color-surface-strong, #f8fafc);
}

.tiptap table .selectedCell:after {
  z-index: 2;
  position: absolute;
  content: "";
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: var(--color-primary-50, rgba(59, 130, 246, 0.1));
  pointer-events: none;
}

.tiptap h3 {
  font-size: 1.1rem;
}

.tiptap h4,
.tiptap h5,
.tiptap h6 {
  font-size: 1rem;
}

/* ======= Inline code ======= */
.tiptap code {
  background-color: var(--purple-light, rgba(139, 92, 246, 0.12));
  border-radius: 0.35rem;
  color: var(--color-primary, #a78bfa);
  font-size: 0.82rem;
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace;
  padding: 0.2em 0.4em;
  font-weight: 500;
}

/* ======= Code Block Wrapper (NodeView) ======= */
.code-block-wrapper {
  margin: 1.25rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
  /* border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.15),
    0 1px 3px rgba(0, 0, 0, 0.1); */
  transition: box-shadow 0.2s ease;
}

.code-block-wrapper:hover {
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    0 2px 6px rgba(0, 0, 0, 0.12);
}

/* --- Header bar --- */
.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.75rem;
  background: #1e2030;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  user-select: none;
}

/* Language selector */
.code-block-lang-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.code-block-lang-select {
  appearance: none;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.375rem;
  color: #8b92a8;
  font-size: 0.7rem;
  font-family: "Inter", sans-serif;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 0.2rem 1.6rem 0.2rem 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: lowercase;
}

.code-block-lang-select:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #c0c8e0;
}

.code-block-lang-select:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
}

.code-block-lang-icon {
  position: absolute;
  right: 0.4rem;
  pointer-events: none;
  color: #8b92a8;
  display: flex;
  align-items: center;
}

/* Copy button */
.code-block-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  background: transparent;
  border: 1px solid transparent;
  color: #8b92a8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.code-block-copy-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: #c0c8e0;
}

.code-block-copy-btn:active {
  transform: scale(0.92);
}

/* --- Pre / Code inside NodeView --- */
.code-block-wrapper pre {
  margin: 0 !important;
  padding: 1rem 1.25rem !important;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.code-block-wrapper pre::-webkit-scrollbar {
  height: 6px;
}

.code-block-wrapper pre::-webkit-scrollbar-track {
  background: transparent;
}

.code-block-wrapper pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.code-block-wrapper pre code {
  background: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  color: #c0c8e0;
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace;
  font-size: 0.8rem;
  line-height: 1.65;
  font-weight: 400;
  tab-size: 2;
}

/* ======= Fallback pre (non-NodeView) ======= */
.tiptap pre {
  background: #1f1e24;
  color: #c0c8e0;
  font-family: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code", monospace;
  margin: 1.25rem 0;
  padding: 1rem 1.25rem;
  overflow-x: auto;
}

/* ======= Syntax Highlighting Theme — Moonlight ======= */

/* Keywords: if, else, return, const, let, var, function, class, etc. */
.hljs-keyword,
.hljs-selector-tag,
.hljs-built_in,
.hljs-name {
  color: #c792ea;
}

/* Strings */
.hljs-string,
.hljs-attr,
.hljs-selector-id {
  color: #c3e88d;
}

/* Numbers & literals */
.hljs-number,
.hljs-literal,
.hljs-variable.constant_,
.hljs-selector-class {
  color: #f78c6c;
}

/* Comments */
.hljs-comment,
.hljs-quote {
  color: #636d83;
  font-style: italic;
}

/* Function names & calls */
.hljs-title,
.hljs-title.function_,
.hljs-title.class_ {
  color: #82aaff;
}

/* Types & class names */
.hljs-type,
.hljs-template-tag,
.hljs-template-variable {
  color: #ffcb6b;
}

/* HTML/XML tags */
.hljs-tag {
  color: #89ddff;
}

/* Attributes */
.hljs-attribute {
  color: #c792ea;
}

/* Symbols, operators */
.hljs-symbol,
.hljs-bullet,
.hljs-link {
  color: #89ddff;
}

/* Regex */
.hljs-regexp {
  color: #89ddff;
}

/* Deletion/Addition in diffs */
.hljs-deletion {
  color: #ff5370;
  background: rgba(255, 83, 112, 0.1);
}

.hljs-addition {
  color: #c3e88d;
  background: rgba(195, 232, 141, 0.1);
}

/* Meta, preprocessor */
.hljs-meta {
  color: #89ddff;
}

.hljs-meta .hljs-keyword {
  color: #ff5370;
}

.hljs-meta .hljs-string {
  color: #c3e88d;
}

/* Section headings (markdown etc.) */
.hljs-section {
  color: #82aaff;
  font-weight: 700;
}

/* Params */
.hljs-params {
  color: #c0c8e0;
}

/* Property */
.hljs-property {
  color: #f07178;
}

/* Punctuation */
.hljs-punctuation {
  color: #89ddff;
}

/* Emphasis & strong */
.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: 700;
}

/* Subst (template expressions) */
.hljs-subst {
  color: #c0c8e0;
}

/* blockquote & hr */
/* div:has(> blockquote) {
  background-color: #ededed;
  margin: 10px auto;
  padding: 15px;
  border-radius: 5px;
} */

.tiptap blockquote p::before {
  content: "\201C";
}

.tiptap blockquote p::after {
  content: "\201D";
}

.tiptap blockquote+p {
  text-align: right;
}


.tiptap hr {
  border: none;
  border-top: 1px solid var(--color-secondary);
  margin: 0.5rem 0;
}

/* Task list styles */
ul[data-type="taskList"] {
  list-style: none;
  margin-left: 0;
  padding: 0;
}

ul[data-type="taskList"] li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

/* label/checkbox layout inside task item */
ul[data-type="taskList"] li>label {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
  display: inline-flex;
  align-items: center;
}

ul[data-type="taskList"] li[data-checked="true"]>div p {
  text-decoration: line-through;
  opacity: 0.7;
}

/* content wrapper (the editable text) */
ul[data-type="taskList"] li>div {
  flex: 1 1 auto;
}

/* checkbox style */
ul[data-type="taskList"] input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

/* images */
.tiptap img {
  display: block;
  height: auto;
  margin: 1.5rem 0;
  max-width: 100%;
}
</style>
