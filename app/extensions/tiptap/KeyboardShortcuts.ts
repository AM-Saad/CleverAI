import { Extension } from "@tiptap/core";

/**
 * Custom keyboard shortcuts extension for the Tiptap editor.
 *
 * Adds shortcuts that are NOT included in StarterKit defaults:
 * - Heading toggles (Mod-Shift-1/2/3)
 * - Code block toggle (Mod-Shift-c)
 * - Blockquote toggle (Mod-Shift-q)
 * - Insert table (Mod-Shift-t)
 * - Task toggle complete (Mod-Shift-m)
 */
export const KeyboardShortcutsExtension = Extension.create({
  name: "customKeyboardShortcuts",

  addKeyboardShortcuts() {
    return {
      // ── Headings ─────────────────────────────────────────────
      "Mod-Shift-1": () =>
        this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      "Mod-Shift-2": () =>
        this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "Mod-Shift-3": () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),

      // ── Blocks ───────────────────────────────────────────────
      "Mod-Shift-c": () =>
        this.editor.chain().focus().toggleCodeBlock().run(),
      "Mod-Shift-q": () =>
        this.editor.chain().focus().toggleBlockquote().run(),

      // ── Insert ───────────────────────────────────────────────
      "Mod-Shift-t": () => {
        // Only insert table if not already in one
        if (this.editor.isActive("table")) return false;
        return this.editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },

      "Mod-Shift-d": () => {
        if (this.editor.isActive("codeBlock") || this.editor.isActive("table")) return false;
        return this.editor
          .chain()
          .focus()
          .insertContent({ type: "paper", attrs: { lines: [] } })
          .run();
      },

      // ── Tasks ────────────────────────────────────────────────
      "Mod-Shift-m": () => {
        const state = this.editor.state;
        const pos = state.selection.$from;
        const node = pos.node(pos.depth);
        if (node.type.name !== "taskItem") return false;
        return this.editor
          .chain()
          .focus()
          .updateAttributes("taskItem", { checked: !node.attrs.checked })
          .run();
      },
    };
  },
});
