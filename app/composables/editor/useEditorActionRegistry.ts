import type { Editor } from "@tiptap/vue-3";
import type { ResolvedContext } from "./useEditorContext";

// ─── Types ─────────────────────────────────────────────────────────
export type ActionCategory =
  | "formatting"
  | "heading"
  | "block"
  | "table"
  | "list"
  | "task"
  | "insert"
  | "ai"
  | "export"
  | "general";

export interface EditorAction {
  id: string;
  label: string;
  icon: string;
  /** Keyboard shortcut in Tiptap format (Mod-b, Mod-Shift-1, etc.) */
  shortcut?: string;
  /** Human-readable shortcut label for tooltips (⌘B, ⌘⇧1, etc.) */
  shortcutLabel?: string;
  category: ActionCategory;
  /**
   * Runtime check: is this action applicable given the current editor context?
   * Return false to hide the action from menus entirely.
   */
  isAvailable: (ctx: ResolvedContext) => boolean;
  /** Is the action currently toggled "on" (e.g., bold active)? */
  isActive?: (editor: Editor) => boolean;
  /** Execute the action */
  execute: (editor: Editor) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────
const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

/** Format a Mod-style shortcut into a human-readable label */
function formatShortcut(shortcut: string): string {
  return shortcut
    .replace(/Mod/g, isMac ? "⌘" : "Ctrl")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/-/g, "");
}

// ─── Build the action registry ─────────────────────────────────────
export function createEditorActions(): EditorAction[] {
  const actions: EditorAction[] = [
    // ── Formatting (inline marks) ────────────────────────────────
    {
      id: "format.bold",
      label: "Bold",
      icon: "i-lucide-bold",
      shortcut: "Mod-b",
      category: "formatting",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("bold"),
      execute: (ed) => ed.chain().focus().toggleBold().run(),
    },
    {
      id: "format.italic",
      label: "Italic",
      icon: "i-lucide-italic",
      shortcut: "Mod-i",
      category: "formatting",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("italic"),
      execute: (ed) => ed.chain().focus().toggleItalic().run(),
    },
    {
      id: "format.strike",
      label: "Strikethrough",
      icon: "i-lucide-strikethrough",
      shortcut: "Mod-Shift-x",
      category: "formatting",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("strike"),
      execute: (ed) => ed.chain().focus().toggleStrike().run(),
    },
    {
      id: "format.code",
      label: "Inline Code",
      icon: "i-lucide-code",
      shortcut: "Mod-e",
      category: "formatting",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("code"),
      execute: (ed) => ed.chain().focus().toggleCode().run(),
    },
    {
      id: "format.clear",
      label: "Clear Formatting",
      icon: "i-lucide-remove-formatting",
      category: "formatting",
      isAvailable: (ctx) => ctx.hasSelection && !ctx.isInCodeBlock,
      execute: (ed) =>
        ed.chain().focus().unsetColor().unsetAllMarks().clearNodes().run(),
    },

    // ── Headings ─────────────────────────────────────────────────
    {
      id: "heading.paragraph",
      label: "Paragraph",
      icon: "i-lucide-text",
      category: "heading",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      isActive: (ed) =>
        !ed.isActive("heading") &&
        !ed.isActive("codeBlock") &&
        !ed.isActive("blockquote"),
      execute: (ed) => ed.chain().focus().setParagraph().run(),
    },
    {
      id: "heading.h1",
      label: "Heading 1",
      icon: "i-lucide-heading-1",
      shortcut: "Mod-Shift-1",
      category: "heading",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      isActive: (ed) => ed.isActive("heading", { level: 1 }),
      execute: (ed) =>
        ed.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading.h2",
      label: "Heading 2",
      icon: "i-lucide-heading-2",
      shortcut: "Mod-Shift-2",
      category: "heading",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      isActive: (ed) => ed.isActive("heading", { level: 2 }),
      execute: (ed) =>
        ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "heading.h3",
      label: "Heading 3",
      icon: "i-lucide-heading-3",
      shortcut: "Mod-Shift-3",
      category: "heading",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      isActive: (ed) => ed.isActive("heading", { level: 3 }),
      execute: (ed) =>
        ed.chain().focus().toggleHeading({ level: 3 }).run(),
    },

    // ── Blocks ───────────────────────────────────────────────────
    {
      id: "block.codeBlock",
      label: "Code Block",
      icon: "i-lucide-file-code",
      shortcut: "Mod-Shift-c",
      category: "block",
      isAvailable: () => true,
      isActive: (ed) => ed.isActive("codeBlock"),
      execute: (ed) => ed.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "block.blockquote",
      label: "Blockquote",
      icon: "i-lucide-quote",
      shortcut: "Mod-Shift-q",
      category: "block",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("blockquote"),
      execute: (ed) => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "block.horizontalRule",
      label: "Horizontal Rule",
      icon: "i-lucide-minus",
      category: "block",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      execute: (ed) => ed.chain().focus().setHorizontalRule().run(),
    },

    // ── Lists ────────────────────────────────────────────────────
    {
      id: "list.bullet",
      label: "Bullet List",
      icon: "i-lucide-list",
      shortcut: "Mod-Shift-8",
      category: "list",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("bulletList"),
      execute: (ed) => ed.chain().focus().toggleBulletList().run(),
    },
    {
      id: "list.ordered",
      label: "Ordered List",
      icon: "i-lucide-list-ordered",
      shortcut: "Mod-Shift-9",
      category: "list",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("orderedList"),
      execute: (ed) => ed.chain().focus().toggleOrderedList().run(),
    },

    // ── Tasks ────────────────────────────────────────────────────
    {
      id: "task.toggleList",
      label: "Todo List",
      icon: "i-lucide-list-checks",
      category: "task",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      isActive: (ed) => ed.isActive("taskList"),
      execute: (ed) => ed.chain().focus().toggleTaskList().run(),
    },
    {
      id: "task.toggleComplete",
      label: "Toggle Complete",
      icon: "i-lucide-check",
      shortcut: "Mod-Shift-m",
      category: "task",
      isAvailable: (ctx) => ctx.isInTaskItem,
      execute: (ed) => {
        const state = ed.state;
        const pos = state.selection.$from;
        const node = pos.node(pos.depth);
        if (node.type.name !== "taskItem") return;
        ed.chain()
          .focus()
          .updateAttributes("taskItem", { checked: !node.attrs.checked })
          .run();
      },
    },
    {
      id: "task.indent",
      label: "Indent Task",
      icon: "i-lucide-indent-increase",
      category: "task",
      isAvailable: (ctx) => ctx.isInTaskItem,
      execute: (ed) =>
        ed.chain().focus().sinkListItem("taskItem").run(),
    },
    {
      id: "task.outdent",
      label: "Outdent Task",
      icon: "i-lucide-indent-decrease",
      category: "task",
      isAvailable: (ctx) => ctx.isInTaskItem,
      execute: (ed) =>
        ed.chain().focus().liftListItem("taskItem").run(),
    },

    // ── Table ────────────────────────────────────────────────────
    {
      id: "table.addRowBefore",
      label: "Add Row Before",
      icon: "i-lucide-table-rows-split",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().addRowBefore().run(),
    },
    {
      id: "table.addRowAfter",
      label: "Add Row After",
      icon: "i-lucide-table-rows-split",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().addRowAfter().run(),
    },
    {
      id: "table.deleteRow",
      label: "Delete Row",
      icon: "i-lucide-trash-2",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().deleteRow().run(),
    },
    {
      id: "table.addColumnBefore",
      label: "Add Column Before",
      icon: "i-lucide-columns-3",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().addColumnBefore().run(),
    },
    {
      id: "table.addColumnAfter",
      label: "Add Column After",
      icon: "i-lucide-columns-3",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().addColumnAfter().run(),
    },
    {
      id: "table.deleteColumn",
      label: "Delete Column",
      icon: "i-lucide-trash-2",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().deleteColumn().run(),
    },
    {
      id: "table.toggleHeaderRow",
      label: "Toggle Header Row",
      icon: "i-lucide-table",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().toggleHeaderRow().run(),
    },
    {
      id: "table.mergeOrSplit",
      label: "Merge / Split Cells",
      icon: "i-lucide-combine",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().mergeOrSplit().run(),
    },
    {
      id: "table.delete",
      label: "Delete Table",
      icon: "i-lucide-x",
      category: "table",
      isAvailable: (ctx) => ctx.isInTable,
      execute: (ed) => ed.chain().focus().deleteTable().run(),
    },

    // ── Insert ───────────────────────────────────────────────────
    {
      id: "insert.table",
      label: "Insert Table",
      icon: "i-lucide-table",
      shortcut: "Mod-Shift-t",
      category: "insert",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      execute: (ed) =>
        ed
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: "insert.image",
      label: "Insert Image",
      icon: "i-lucide-image",
      category: "insert",
      isAvailable: (ctx) => !ctx.isInCodeBlock,
      execute: (ed) => {
        const url = window.prompt("Image URL");
        if (url) ed.chain().focus().setImage({ src: url }).run();
      },
    },
    {
      id: "insert.paper",
      label: "Insert Sketch",
      icon: "i-lucide-pen-tool",
      shortcut: "Mod-Shift-d",
      category: "insert",
      isAvailable: (ctx) => !ctx.isInCodeBlock && !ctx.isInTable,
      execute: (ed) => {
        ed.chain()
          .focus()
          .insertContent({ type: "paper", attrs: { lines: [] } })
          .run();
      },
    },
  ];

  // Compute shortcutLabel from shortcut
  for (const action of actions) {
    if (action.shortcut && !action.shortcutLabel) {
      action.shortcutLabel = formatShortcut(action.shortcut);
    }
  }

  return actions;
}

// ─── Query helpers ─────────────────────────────────────────────────

/** Get all actions for a specific category that are available in the given context */
export function getActionsForCategory(
  actions: EditorAction[],
  category: ActionCategory,
  ctx: ResolvedContext,
): EditorAction[] {
  return actions.filter(
    (a) => a.category === category && a.isAvailable(ctx),
  );
}

/** Get all available actions grouped by category, for context menu rendering */
export function getContextMenuGroups(
  actions: EditorAction[],
  ctx: ResolvedContext,
  /** Extra categories to exclude (e.g. "formatting" is handled by BubbleMenu) */
  excludeCategories: ActionCategory[] = [],
): EditorAction[][] {
  const categoryOrder: ActionCategory[] = [
    "formatting",
    "heading",
    "block",
    "table",
    "task",
    "list",
    "insert",
    "ai",
    "export",
    "general",
  ];

  const groups: EditorAction[][] = [];

  for (const category of categoryOrder) {
    if (excludeCategories.includes(category)) continue;
    const categoryActions = getActionsForCategory(actions, category, ctx);
    if (categoryActions.length > 0) {
      groups.push(categoryActions);
    }
  }

  return groups;
}

/** Convert EditorAction[] to Nuxt UI context-menu item format */
export function toMenuItems(
  actions: EditorAction[],
  editor: Editor,
): Array<{
  label: string;
  icon: string;
  shortcutLabel?: string;
  onSelect: () => void;
}> {
  return actions.map((action) => ({
    label: action.label,
    icon: action.icon,
    shortcutLabel: action.shortcutLabel,
    onSelect: () => action.execute(editor),
  }));
}
