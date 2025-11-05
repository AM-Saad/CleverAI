<template>
  <div class="tiptap-editor" @click="{
    if (isFullScreen) {
      $event.stopPropagation();
    }
  }">
    <div v-if="editor" class="flex gap-2 mb-2">
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('bold'))"
        @click.prevent="toggleBold">B</UButton>
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('italic'))"
        @click.prevent="toggleItalic">I</UButton>
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('heading', { level: 1 }))"
        @click.prevent="toggleH1">H1</UButton>
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('heading', { level: 2 }))"
        @click.prevent="toggleH2">H2</UButton>
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('bulletList'))"
        @click.prevent="toggleBulletList">• List</UButton>
      <UButton variant="soft" size="xs" type="button" :class="buttonClass(editor.isActive('orderedList'))"
        @click.prevent="toggleOrderedList">1. List</UButton>
      <!-- <UButton variant="soft"  size="xs" type="button" :class="buttonClass(editor.isActive('link'))" @click.prevent="setLinkPrompt">Link</UButton> -->
    </div>

    <editor-content :id="id" :editor="editor" class="rounded-2xl bg-gray-50 p-3"/>
  </div>
</template>

<script>
import { Editor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export default {
  name: "SharedTiptapEditor",

  components: {
    EditorContent,
  },

  props: {
    // support v-model via modelValue
    modelValue: {
      type: String,
      default: "",
    },
    isFullScreen: {
      type: Boolean,
      default: false,
    },
    id: {
      type: String,
      default: "",
    },
  },

  emits: ["update:modelValue"],

  data() {
    return {
      editor: null,
    };
  },

  watch: {
    modelValue(value) {
      if (!this.editor) return;
      const current = this.editor.getHTML();
      if (current === value) return;
      this.editor.commands.setContent(value || "", false);
    },
  },

  mounted() {
    this.editor = new Editor({
      content: this.modelValue || "",
      extensions: [StarterKit, Link.configure({ openOnClick: true })],
      editorProps: {
        attributes: {
          class:
            "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-1 focus:outline-none",
        },
      },
    });

    // Emit updates for v-model
    this.editor.on("update", () => {
      const html = this.editor.getHTML();
      this.$emit("update:modelValue", html);
    });
  },

  beforeUnmount() {
    if (this.editor) this.editor.destroy();
  },

  methods: {
    buttonClass(active) {
      return [
        // 'px-2 py-1 rounded text-sm border',
        active ? "bg-amber-200 border-amber-400" : "bg-white border-amber-100",
      ];
    },

    toggleBold() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleBold().run();
    },

    toggleItalic() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleItalic().run();
    },

    toggleH1() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleHeading({ level: 1 }).run();
    },

    toggleH2() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleHeading({ level: 2 }).run();
    },

    toggleBulletList() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleBulletList().run();
    },

    toggleOrderedList() {
      if (!this.editor) return;
      this.editor.chain().focus().toggleOrderedList().run();
    },

    setLinkPrompt() {
      if (!this.editor) return;
      const previous = this.editor.getAttributes("link").href || "";
      const url = window.prompt("Enter URL", previous);
      if (url === null) return;
      if (url === "") {
        this.editor.chain().focus().unsetLink().run();
        return;
      }
      this.editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url, target: "_blank", rel: "noopener" })
        .run();
    },
  },
};
</script>
