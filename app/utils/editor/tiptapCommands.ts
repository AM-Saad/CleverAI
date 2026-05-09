import type { ChainedCommands } from "@tiptap/vue-3";
import type { Editor } from "@tiptap/vue-3";

type MarkName = "bold" | "italic" | "strike";

const run = (chain: ChainedCommands, command: () => ChainedCommands) =>
  command().run();

const extendWhenActive = (editor: Editor, chain: ChainedCommands, mark: string) => {
  if (editor.isActive(mark)) {
    chain.extendMarkRange(mark);
  }
  return chain;
};

export function toggleInlineMark(editor: Editor, mark: MarkName) {
  const chain = extendWhenActive(editor, editor.chain().focus(), mark);

  switch (mark) {
    case "bold":
      return run(chain, () => chain.toggleBold());
    case "italic":
      return run(chain, () => chain.toggleItalic());
    case "strike":
      return run(chain, () => chain.toggleStrike());
  }
}

export function setTextColor(editor: Editor, color: string) {
  const chain = extendWhenActive(editor, editor.chain().focus(), "textStyle");
  return chain.setColor(color).run();
}

export function clearFormatting(editor: Editor) {
  return editor
    .chain()
    .focus()
    .unsetColor()
    .unsetAllMarks()
    .clearNodes()
    .run();
}
