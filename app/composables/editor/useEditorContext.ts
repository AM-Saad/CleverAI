import { ref, watch, type Ref } from "vue";
import type { Editor } from "@tiptap/vue-3";

// ─── Types ─────────────────────────────────────────────────────────
export type NodeContext =
  | "text"
  | "paragraph"
  | "heading"
  | "codeBlock"
  | "table"
  | "tableCell"
  | "tableRow"
  | "tableHeader"
  | "image"
  | "taskItem"
  | "taskList"
  | "blockquote"
  | "bulletList"
  | "orderedList"
  | "listItem"
  | "horizontalRule"
  | "paper";

export interface ResolvedContext {
  /** The direct parent node type name */
  nodeType: string;
  /** Whether there is a non-empty text selection */
  hasSelection: boolean;
  /** The selected text (empty string if no selection) */
  selectedText: string;
  /** Length of the selected text */
  selectionLength: number;

  // ── Contextual booleans (avoids repeated isActive checks) ────
  isInTable: boolean;
  isInCodeBlock: boolean;
  isInTaskList: boolean;
  isInTaskItem: boolean;
  isInBlockquote: boolean;
  isInList: boolean;
  isInHeading: boolean;
  isInImage: boolean;
  isInPaper: boolean;

  /** The heading level if inside a heading, otherwise null */
  headingLevel: number | null;

  /** Active inline marks */
  isBold: boolean;
  isItalic: boolean;
  isStrike: boolean;
  isCode: boolean;
}

// ─── Default context ───────────────────────────────────────────────
function defaultContext(): ResolvedContext {
  return {
    nodeType: "paragraph",
    hasSelection: false,
    selectedText: "",
    selectionLength: 0,
    isInTable: false,
    isInCodeBlock: false,
    isInTaskList: false,
    isInTaskItem: false,
    isInBlockquote: false,
    isInList: false,
    isInHeading: false,
    isInImage: false,
    isInPaper: false,
    headingLevel: null,
    isBold: false,
    isItalic: false,
    isStrike: false,
    isCode: false,
  };
}

// ─── Resolve the editor's current selection into a context ─────────
function resolveContext(editor: Editor): ResolvedContext {
  const state = editor.state;
  const { from, to } = state.selection;
  const hasSelection = from !== to;

  let selectedText = "";
  if (hasSelection) {
    try {
      selectedText = state.doc.textBetween(from, to, "\n");
    } catch {
      selectedText = "";
    }
  }

  const $from = state.selection.$from;
  const parentNodeType = $from.parent.type.name;

  // Walk up the node tree to detect ancestor context
  const isInTable = editor.isActive("table");
  const isInCodeBlock = editor.isActive("codeBlock");
  const isInTaskList = editor.isActive("taskList");
  const isInTaskItem = editor.isActive("taskItem");
  const isInBlockquote = editor.isActive("blockquote");
  const isInList =
    editor.isActive("bulletList") || editor.isActive("orderedList");
  const isInHeading = editor.isActive("heading");
  const isInImage = editor.isActive("image");
  const isInPaper = editor.isActive("paper");

  let headingLevel: number | null = null;
  if (isInHeading) {
    // Try each heading level to find the active one
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive("heading", { level })) {
        headingLevel = level;
        break;
      }
    }
  }

  return {
    nodeType: parentNodeType,
    hasSelection,
    selectedText,
    selectionLength: selectedText.length,
    isInTable,
    isInCodeBlock,
    isInTaskList,
    isInTaskItem,
    isInBlockquote,
    isInList,
    isInHeading,
    isInImage,
    isInPaper,
    headingLevel,
    isBold: editor.isActive("bold"),
    isItalic: editor.isActive("italic"),
    isStrike: editor.isActive("strike"),
    isCode: editor.isActive("code"),
  };
}

// ─── Composable ────────────────────────────────────────────────────
/**
 * Reactive composable that resolves the current editor context
 * (cursor position, node type, selection state, active marks)
 * and keeps it updated on every selection / transaction change.
 */
export function useEditorContext(editor: Ref<Editor | null>) {
  const context = ref<ResolvedContext>(defaultContext());

  function update() {
    if (!editor.value) return;
    context.value = resolveContext(editor.value);
  }

  watch(
    () => editor.value,
    (ed, _, onCleanup) => {
      if (!ed) return;

      ed.on("selectionUpdate", update);
      ed.on("transaction", update);

      // Initial resolve
      update();

      onCleanup(() => {
        ed.off("selectionUpdate", update);
        ed.off("transaction", update);
      });
    },
    { immediate: true },
  );

  return { context, update };
}
