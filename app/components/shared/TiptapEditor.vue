<template>
  <div v-if="editor" ref="editorContainerRef"
    class="container relative flex flex-col p-1 h-full min-h-0 w-full overflow-y-auto">

    <div class="flex flex-col w-full">
      <UContextMenu :items="contextMenuItems">
        <editor-content :editor="editor" class="flex-1 pt-6" />
      </UContextMenu>
    </div>

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
import { ref, nextTick, onBeforeUnmount, onMounted, watch, computed } from "vue";
import type { NavigationMenuItem } from "@nuxt/ui";
import type { Editor as TipTapEditor } from "@tiptap/core";
import type {
  Selection as PMSelection,
} from "prosemirror-state";
import Document from "@tiptap/extension-document";
import { ListItem, TaskItem, TaskList } from "@tiptap/extension-list";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Extension } from "@tiptap/core";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
// note: explicit Drop cursor intentionally omitted to avoid duplicate warnings
import { Editor, EditorContent } from "@tiptap/vue-3";
import { initCollaboration } from "@/utils/";
import { useTextSummarization } from '~/composables/ai/useTextSummarization';
import { usePredictionaryInput } from '~/composables/usePredictionaryInput';

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

const CustomTaskItem = TaskItem.extend({
  content: "paragraph block*",
});

// ---------- reactive refs ----------
const editor = ref<TipTapEditor | null>(null);
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "addToMaterial", value: string): void;
}>();
const collaborationHandle = ref<CollaborationHandle>(null);
const props = defineProps<{
  modelValue: string;
}>();

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
  if (!editor.value || !word) return;
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
    .insertText(word + ' ')
    .run();
  autoOnAccept(word);
  autoActiveIndex.value = 0;
  autoPosition.value = null;
}

function updateAutoState() {
  if (!editor.value) return;
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


// Context menu items
const contextMenuItems = computed(() => {
  const selectedText = getSelectedText();
  const hasSelection = selectedText && selectedText.trim().length > 0;

  return [
    {
      label: 'Add To Material',
      icon: 'i-lucide-material',
      disabled: !hasSelection,
      onSelect: () => {
        if (selectedText) {
          emit('addToMaterial', selectedText);
        }
      },
    },
    {
      label: isSpeaking.value ? 'Stop Reading' : ttsError.value ? 'TTS Unavailable' : 'Read Aloud',
      icon: isSpeaking.value ? 'i-lucide-volume-x' : ttsError.value ? 'i-lucide-alert-circle' : 'i-lucide-volume-2',
      disabled: !hasSelection || !ttsAvailable.value,
      onSelect: isSpeaking.value ? stopSpeaking : handleReadAloud,
    },
    {
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
    },
    // {
    //   label: isSummarizing.value
    //     ? 'Summarizing...'
    //     : isDownloading.value
    //       ? 'Downloading Model...'
    //       : 'Summarize Text',
    //   icon: isSummarizing.value
    //     ? 'i-lucide-loader'
    //     : isDownloading.value
    //       ? 'i-lucide-download'
    //       : 'i-lucide-sparkles',
    //   disabled: !hasSelection || isSummarizing.value || isDownloading.value,
    //   onSelect: handleSummarize,
    // },
  ];
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const current = editor.value.getHTML();
    if (current === value) return;
    editor.value.commands.setContent(value || "");
  },
  { immediate: true }
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
  if (editor.value) {
    try {
      editor.value.destroy();
    } catch (e) {
      /* ignore */
    }
    editor.value = null;
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
          if (autoSuggestions.value.length > 0) {
            acceptSuggestion(autoSuggestions.value[autoActiveIndex.value]);
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
      // disable StarterKit document to avoid duplicate 'doc' name
      StarterKit.configure({ document: false }),
      CustomDocument,
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle.configure({ types: [ListItem.name] }),
      Image,
      // drop cursor intentionally omitted
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      CustomTaskItem,
      AutocompleteExtension,
    ],
    content: props.modelValue || "",
  });
  // Emit updates for v-model
  editor.value.on("update", () => {
    const html = editor.value?.getHTML();
    emit("update:modelValue", html || "");
    updateAutoState();
  });

  // dev transaction logger (safe)
  try {
    editor.value.on("transaction", ({ transaction }) => {
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

/* Basic list spacing */
.tiptap ul,
.tiptap ol {
  padding: 0 1rem;
  margin: 1.25rem 1rem 1.25rem 0.4rem;
  list-style: none;
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

/* code blocks */
.tiptap code {
  background-color: var(--purple-light);
  border-radius: 0.4rem;
  color: var(--color-light);
  font-size: 0.85rem;
  padding: 0.25em 0.3em;
}

.tiptap pre {
  background: var(--color-dark);
  border-radius: 0.5rem;
  color: var(--color-light);
  font-family: "JetBrainsMono", monospace;
  margin: 1.5rem 0;
  padding: 0.75rem 1rem;
}

/* blockquote & hr */
.tiptap blockquote {
  border-left: 3px solid var(--gray-3);
  margin: 1.5rem 0;
  padding-left: 1rem;
}

.tiptap hr {
  border: none;
  border-top: 1px solid var(--color-neutral);
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
