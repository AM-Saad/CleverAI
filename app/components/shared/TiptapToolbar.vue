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

  <!-- Group: Colors -->
  <UDropdownMenu :modal="false" :items="colorsItems" :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
    <shared-note-toolbar-button title="Colors" icon="i-lucide-palette" />
  </UDropdownMenu>

  <div class="h-5 w-px bg-secondary mx-1 shrink-0"></div>


  <!-- Undo / Redo -->
  <shared-note-toolbar-button title="Undo" @click="props.editor.chain().focus().undo().run()"
    :disabled="!props.editor.can().chain().focus().undo().run()" icon="i-lucide-undo" />

  <shared-note-toolbar-button title="Redo" @click="props.editor.chain().focus().redo().run()"
    :disabled="!props.editor.can().chain().focus().redo().run()" icon="i-lucide-redo" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Editor } from '@tiptap/vue-3';


const props = defineProps<{
  editor: Editor;
}>();

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
]]);

const colorsItems = computed<any[][]>(() => [[
  {
    label: "Primary",
    icon: "i-lucide-circle",
    onSelect: () => props.editor.chain().focus().setColor("#2563EB").run(),
  },
  {
    label: "Secondary",
    icon: "i-lucide-circle",
    onSelect: () => props.editor.chain().focus().setColor("#6B7280").run(),
  },
  {
    label: "Red",
    icon: "i-lucide-circle",
    onSelect: () => props.editor.chain().focus().setColor("#EF4444").run(),
  },
  {
    label: "Green",
    icon: "i-lucide-circle",
    onSelect: () => props.editor.chain().focus().setColor("#10B981").run(),
  },
  {
    label: "Yellow",
    icon: "i-lucide-circle",
    onSelect: () => props.editor.chain().focus().setColor("#F59E0B").run(),
  },
]]);
</script>
