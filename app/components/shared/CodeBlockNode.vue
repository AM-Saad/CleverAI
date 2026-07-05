<template>
  <NodeViewWrapper class="code-block-wrapper" :data-language="selectedLanguage">
    <!-- Language selector bar -->
    <div class="code-block-header" contenteditable="false">
      <div class="code-block-lang-selector">
        <select
          v-model="selectedLanguage"
          class="code-block-lang-select"
          @change="onLanguageChange"
        >
          <option :value="null">Auto-detect</option>
          <option
            v-for="lang in availableLanguages"
            :key="lang"
            :value="lang"
          >
            {{ lang }}
          </option>
        </select>
        <div class="code-block-lang-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      <UiToolbarButton
        class="code-block-copy-btn"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        label="Copy code"
        @click="copyCode"
      />
    </div>

    <!-- Code content -->
    <pre><NodeViewContent as="code" /></pre>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";

const props = defineProps(nodeViewProps);
const copied = ref(false);

const availableLanguages = [
  "arduino",
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "go",
  "graphql",
  "ini",
  "java",
  "javascript",
  "json",
  "kotlin",
  "less",
  "lua",
  "makefile",
  "markdown",
  "objectivec",
  "perl",
  "php",
  "php-template",
  "plaintext",
  "python",
  "python-repl",
  "r",
  "ruby",
  "rust",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "vbnet",
  "wasm",
  "xml",
  "yaml",
];

const selectedLanguage = computed({
  get: () => props.node.attrs.language,
  set: (language: string | null) => {
    props.updateAttributes({ language });
  },
});

function onLanguageChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  props.updateAttributes({ language: target.value || null });
}

async function copyCode() {
  const text = props.node.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Fallback copy
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
}
</script>
