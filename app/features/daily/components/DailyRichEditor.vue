<template>
  <div class="daily-editor">
    <UiToolbar v-if="editor" aria-label="Daily note formatting" class="daily-editor__toolbar">
      <UiToolbarButton icon="i-lucide-bold" label="Bold" :active="editor.isActive('bold')"
        @click="editor.chain().focus().toggleBold().run()" />
      <UiToolbarButton icon="i-lucide-heading-2" label="Heading" :active="editor.isActive('heading', { level: 2 })"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" />
      <UiToolbarButton icon="i-lucide-list" label="Bullet list" :active="editor.isActive('bulletList')"
        @click="editor.chain().focus().toggleBulletList().run()" />
      <UiToolbarButton icon="i-lucide-square-check-big" label="Task list" :active="editor.isActive('taskList')"
        @click="editor.chain().focus().toggleTaskList().run()" />
      <UiToolbarButton icon="i-lucide-pencil-ruler" label="Insert sketch" @click="insertSketch" />
    </UiToolbar>
    <EditorContent :editor="editor ?? undefined" class="daily-editor__content" />
  </div>
</template>

<script setup lang="ts">
import type { JSONContent } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { Editor, EditorContent } from "@tiptap/vue-3";
import Paper from "~/components/shared/Paper.js";

const props = defineProps<{ modelValue?: unknown; readonly?: boolean }>();
const emit = defineEmits<{
  (event: "update:modelValue", value: JSONContent): void;
}>();
const applyingExternal = ref(false);

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const content = () => {
  const value = props.modelValue;
  return value && typeof value === "object"
    ? (value as JSONContent)
    : emptyDocument;
};

const editor = shallowRef<Editor | null>(null);

onMounted(() => {
  editor.value = new Editor({
    content: content(),
    editable: !props.readonly,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write down what matters today…" }),
      Paper,
    ],
    onUpdate: ({ editor: instance }) => {
      if (!applyingExternal.value)
        emit("update:modelValue", instance.getJSON());
    },
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value || !value || typeof value !== "object") return;
    if (JSON.stringify(editor.value.getJSON()) === JSON.stringify(value))
      return;
    applyingExternal.value = true;
    editor.value.commands.setContent(value as JSONContent, {
      emitUpdate: false,
    });
    applyingExternal.value = false;
  },
  { deep: true },
);

watch(
  () => props.readonly,
  (value) => editor.value?.setEditable(!value),
);

function insertSketch() {
  editor.value
    ?.chain()
    .focus()
    .insertContent({
      type: "paper",
      attrs: { lines: [], height: 280 },
    })
    .run();
}

onBeforeUnmount(() => editor.value?.destroy());
</script>

<style scoped>
.daily-editor {
  min-height: 320px;
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--color-surface);
  overflow: hidden;
}

.daily-editor__toolbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  border-bottom: 1px solid var(--color-secondary);
  background: var(--color-surface);
  padding: var(--space-2);
}

.daily-editor__content {
  min-height: 270px;
  padding: var(--space-4);
}

.daily-editor__content :deep(.tiptap) {
  min-height: 235px;
  outline: none;
  line-height: 1.7;
  color: var(--color-content-on-surface);
}

.daily-editor__content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--color-content-disabled);
}

.daily-editor__content :deep(.tiptap h2) {
  margin: var(--space-5) 0 var(--space-2);
  font-size: var(--text-xl);
  font-weight: 700;
}

.daily-editor__content :deep(.tiptap ul) {
  margin: var(--space-2) 0;
  padding-left: var(--space-6);
  list-style: disc;
}

.daily-editor__content :deep(.tiptap ul[data-type="taskList"]) {
  padding: 0;
  list-style: none;
}

.daily-editor__content :deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  gap: var(--space-2);
}

.daily-editor__content .ProseMirror-focused {
  outline: 0 !important
}
</style>
