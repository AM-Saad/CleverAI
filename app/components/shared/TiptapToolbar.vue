<template>
  <!-- Group: Headings -->
  <UDropdownMenu :modal="false" :items="headingsItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Formatting" icon="i-lucide-type" />
  </UDropdownMenu>

  <!-- Group: Blocks -->
  <UDropdownMenu :modal="false" :items="blocksItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Blocks" icon="i-lucide-layout" />
  </UDropdownMenu>

  <!-- Group: Lists -->
  <UDropdownMenu :modal="false" :items="listsItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Lists" icon="i-lucide-list" />
  </UDropdownMenu>

  <!-- Group: Tasks -->
  <UDropdownMenu :modal="false" :items="tasksItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Tasks" icon="i-lucide-list-check" />
  </UDropdownMenu>

  <!-- Group: Insert -->
  <UDropdownMenu :modal="false" :items="insertItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Insert" icon="i-lucide-plus-square" />
  </UDropdownMenu>

  <!-- Group: Table -->
  <UDropdownMenu :modal="false" :items="tableItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Table" icon="i-lucide-table" />
  </UDropdownMenu>

  <!-- Group: Colors -->
  <SharedNoteColorPickerButton
    title="Text Color"
    icon="i-lucide-palette"
    :icon-only="true"
    :modelValue="currentColor"
    @update:modelValue="val => props.editor.chain().focus().setColor(val).run()"
  />

  <div class="h-5 w-px bg-secondary mx-1 shrink-0"></div>


  <!-- Undo / Redo -->
  <shared-note-toolbar-button title="Undo" @click="props.editor.chain().focus().undo().run()"
    :disabled="!props.editor.can().chain().focus().undo().run()" icon="i-lucide-undo" />

  <shared-note-toolbar-button title="Redo" @click="props.editor.chain().focus().redo().run()"
    :disabled="!props.editor.can().chain().focus().redo().run()" icon="i-lucide-redo" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Editor } from '@tiptap/vue-3';


const props = defineProps<{
  editor: Editor;
}>();

const currentColor = ref<string | undefined>(undefined);

function updateColor() {
  if (props.editor) {
    currentColor.value = props.editor.getAttributes('textStyle').color || undefined;
  }
}

onMounted(() => {
  if (props.editor) {
    props.editor.on('transaction', updateColor);
    props.editor.on('selectionUpdate', updateColor);
    updateColor();
  }
});

onUnmounted(() => {
  if (props.editor) {
    props.editor.off('transaction', updateColor);
    props.editor.off('selectionUpdate', updateColor);
  }
});

function addImage(): void {
  const url = window.prompt("URL");
  if (url) {
    props.editor.chain().focus().setImage({ src: url }).run();
  }
}

function addTaskItem(): void {
  props.editor
    .chain()
    .focus()
    .insertContent('<li data-type="taskItem" data-checked="false"><p></p></li>')
    .run();
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
    onSelect: () => props.editor.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    icon: "i-lucide-italic",
    onSelect: () => props.editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "Strike",
    icon: "i-lucide-strikethrough",
    onSelect: () => props.editor.chain().focus().toggleStrike().run(),
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


</script>
