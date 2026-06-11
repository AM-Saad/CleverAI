<template>
  <SharedNoteToolbarControls :controls="toolbarControls" />

  <shared-dialog-modal :show="showImageModal" title="Add Image from URL" @close="showImageModal = false">
    <template #body>
      <div class="space-y-4 pt-2">
        <UiLabel tag="label" for="image-url-input">Image URL</UiLabel>
        <u-input
          id="image-url-input"
          v-model="imageUrlInput"
          placeholder="https://example.com/image.png"
          class="w-full mt-1.5"
          @keyup.enter="confirmAddImage"
        />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <u-button variant="ghost" color="neutral" @click="showImageModal = false">Cancel</u-button>
        <u-button color="primary" :disabled="!imageUrlInput.trim()" @click="confirmAddImage">Add Image</u-button>
      </div>
    </template>
  </shared-dialog-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import type { NoteToolbarControl } from "~/components/shared/NoteToolbarControls.vue";
import {
  clearFormatting,
  setTextColor,
  toggleInlineMark,
} from "~/utils/editor/tiptapCommands";

const props = defineProps<{
  editor: Editor;
}>();

const currentColor = ref<string | undefined>(undefined);
const currentCellBgColor = ref<string | undefined>(undefined);
const showImageModal = ref(false);
const imageUrlInput = ref("");

function updateColor() {
  if (props.editor) {
    currentColor.value = props.editor.getAttributes('textStyle').color || undefined;
  }
}

function updateCellBgColor() {
  if (props.editor && props.editor.isActive('table')) {
    const { state } = props.editor;
    const { selection } = state;
    let color = undefined;
    state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        color = node.attrs.backgroundColor;
        return false;
      }
    });
    currentCellBgColor.value = color || undefined;
  } else {
    currentCellBgColor.value = undefined;
  }
}

onMounted(() => {
  if (props.editor) {
    props.editor.on('transaction', updateColor);
    props.editor.on('selectionUpdate', updateColor);
    props.editor.on('transaction', updateCellBgColor);
    props.editor.on('selectionUpdate', updateCellBgColor);
    updateColor();
    updateCellBgColor();
  }
});

onUnmounted(() => {
  if (props.editor) {
    props.editor.off('transaction', updateColor);
    props.editor.off('selectionUpdate', updateColor);
    props.editor.off('transaction', updateCellBgColor);
    props.editor.off('selectionUpdate', updateCellBgColor);
  }
});

function addImage(): void {
  imageUrlInput.value = "";
  showImageModal.value = true;
}

function confirmAddImage(): void {
  const url = imageUrlInput.value.trim();
  if (url) {
    props.editor.chain().focus().setImage({ src: url }).run();
    showImageModal.value = false;
  }
}

function addTaskItem(): void {
  if (props.editor.isActive("taskList")) {
    props.editor.chain().focus().splitListItem("taskItem").run();
  } else {
    props.editor.chain().focus().toggleTaskList().run();
  }
}

function toggleTaskItem(): void {
  const state = props.editor.state;
  const pos = state.selection.$from;
  const node = pos.node(pos.depth);

  if (node.type.name !== "taskItem") return;

  const isChecked = node.attrs.checked;

  props.editor
    .chain()
    .focus()
    .updateAttributes("taskItem", { checked: !isChecked })
    .run();
}

const headingsItems = computed<any[][]>(() => [[
  {
    label: "Paragraph",
    icon: "i-lucide-text",
    onSelect: () => props.editor.chain().focus().setParagraph().run(),
  },
  {
    label: "H1",
    icon: "i-lucide-hash",
    onSelect: () => props.editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "H2",
    icon: "i-lucide-hash",
    onSelect: () => props.editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "H3",
    icon: "i-lucide-hash",
    onSelect: () => props.editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bold",
    icon: "i-lucide-bold",
    onSelect: () => toggleInlineMark(props.editor, "bold"),
  },
  {
    label: "Italic",
    icon: "i-lucide-italic",
    onSelect: () => toggleInlineMark(props.editor, "italic"),
  },
  {
    label: "Strike",
    icon: "i-lucide-strikethrough",
    onSelect: () => toggleInlineMark(props.editor, "strike"),
  },
  {
    label: "Clear formatting",
    icon: "i-lucide-remove-formatting",
    onSelect: () => clearFormatting(props.editor),
  },
]]);

const tasksItems = computed<any[][]>(() => [[
  {
    label: "Toggle Todo List",
    icon: "i-lucide-list-check",
    onSelect: () => props.editor.chain().focus().toggleTaskList().run(),
  },
  {
    label: "Add Task Item",
    icon: "i-lucide-plus",
    onSelect: () => addTaskItem(),
  },
  {
    label: "Toggle Complete",
    icon: "i-lucide-check",
    onSelect: () => toggleTaskItem(),
  },
  {
    label: "Indent Task",
    icon: "i-lucide-indent",
    onSelect: () => props.editor.chain().focus().sinkListItem("taskItem").run(),
  },
  {
    label: "Outdent Task",
    icon: "i-lucide-outdent",
    onSelect: () => props.editor.chain().focus().liftListItem("taskItem").run(),
  },
]]);

const blocksItems = computed<any[][]>(() => [[
  {
    label: "Code block",
    icon: "i-lucide-code",
    onSelect: () => props.editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Blockquote",
    icon: "i-lucide-quote",
    onSelect: () => props.editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: "Horizontal rule",
    icon: "i-lucide-minus",
    onSelect: () => props.editor.chain().focus().setHorizontalRule().run(),
  },
]]);

const listsItems = computed<any[][]>(() => [[
  {
    label: "Bullet list",
    icon: "i-lucide-list",
    onSelect: () => props.editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Ordered list",
    icon: "i-lucide-list-number",
    onSelect: () => props.editor.chain().focus().toggleOrderedList().run(),
  },
]]);

const insertItems = computed<any[][]>(() => [[
  {
    label: "Add image from URL",
    icon: "i-lucide-image",
    onSelect: () => addImage(),
  },
  {
    label: "Insert table",
    icon: "i-lucide-table",
    onSelect: () => props.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
]]);

const tableItems = computed<any[][]>(() => [[
  {
    label: "Add row before",
    icon: "i-lucide-row-spacing",
    onSelect: () => props.editor.chain().focus().addRowBefore().run(),
  },
  {
    label: "Add row after",
    icon: "i-lucide-row-spacing",
    onSelect: () => props.editor.chain().focus().addRowAfter().run(),
  },
  {
    label: "Delete row",
    icon: "i-lucide-trash-2",
    onSelect: () => props.editor.chain().focus().deleteRow().run(),
  },
], [
  {
    label: "Add column before",
    icon: "i-lucide-columns",
    onSelect: () => props.editor.chain().focus().addColumnBefore().run(),
  },
  {
    label: "Add column after",
    icon: "i-lucide-columns",
    onSelect: () => props.editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: "Delete column",
    icon: "i-lucide-trash-2",
    onSelect: () => props.editor.chain().focus().deleteColumn().run(),
  },
], [
  {
    label: "Toggle header row",
    icon: "i-lucide-table-2",
    onSelect: () => props.editor.chain().focus().toggleHeaderRow().run(),
  },
  {
    label: "Merge/split cells",
    icon: "i-lucide-combine",
    onSelect: () => props.editor.chain().focus().mergeOrSplit().run(),
  },
  {
    label: "Delete table",
    icon: "i-lucide-x",
    onSelect: () => props.editor.chain().focus().deleteTable().run(),
  },
]]);

const toolbarControls = computed<NoteToolbarControl[]>(() => [
  {
    type: "dropdown",
    id: "formatting",
    title: "Formatting",
    icon: "text-icon",
    items: headingsItems.value,
  },
  {
    type: "dropdown",
    id: "blocks",
    title: "Blocks",
    icon: "blocks",
    items: blocksItems.value,
  },
  {
    type: "dropdown",
    id: "lists",
    title: "Lists",
    icon: "list",
    items: listsItems.value,
  },
  {
    type: "dropdown",
    id: "tasks",
    title: "Tasks",
    icon: "list-check",
    items: tasksItems.value,
  },
  {
    type: "dropdown",
    id: "insert",
    title: "Insert",
    icon: "plus-square",
    items: insertItems.value,
  },
  {
    type: "dropdown",
    id: "table",
    title: "Table",
    icon: "table",
    items: tableItems.value,
  },
  {
    type: "color",
    id: "text-color",
    title: "Text Color",
    icon: "color-picker",
    iconOnly: true,
    modelValue: currentColor.value,
    onUpdate: (value) => setTextColor(props.editor, value),
  },
  {
    type: "color",
    id: "cell-bg-color",
    title: "Cell Background",
    icon: "color-bucket",
    iconOnly: true,
    disabled: !props.editor.isActive("table"),
    modelValue: currentCellBgColor.value,
    onUpdate: (value) => props.editor.chain().focus().setCellAttribute('backgroundColor', value).run(),
  },
  {
    type: "separator",
    id: "edit-separator",
  },
  {
    type: "button",
    id: "undo",
    title: "Undo",
    icon: "undo",
    disabled: !props.editor.can().chain().focus().undo().run(),
    onSelect: () => props.editor.chain().focus().undo().run(),
  },
  {
    type: "button",
    id: "redo",
    title: "Redo",
    icon: "redo",
    disabled: !props.editor.can().chain().focus().redo().run(),
    onSelect: () => props.editor.chain().focus().redo().run(),
  },
]);

</script>
