<template>
  <div ref="editorEl" class="smart-action-input" role="textbox" contenteditable="plaintext-only" aria-multiline="false"
    :aria-label="ariaLabel" :data-placeholder="placeholder" spellcheck="true" autocomplete="off" v-bind="$attrs"
    @input="onInput" @compositionstart="composing = true" @compositionend="onCompositionEnd"
    @keydown.enter="requestSubmit" />
</template>

<script setup lang="ts">
import type { ActionParseToken } from "../domain/parseActionInput";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    tokens: readonly ActionParseToken[];
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "",
    ariaLabel: "Action item title",
  },
);

const model = defineModel<string>({ default: "" });
const editorEl = ref<HTMLElement | null>(null);
const composing = ref(false);
let pendingCaret: number | null = null;

function plainText() {
  return (editorEl.value?.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n]+/g, " ");
}

function caretOffset() {
  const editor = editorEl.value;
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return null;
  const current = selection.getRangeAt(0);
  if (!editor.contains(current.startContainer)) return null;
  const before = current.cloneRange();
  before.selectNodeContents(editor);
  before.setEnd(current.startContainer, current.startOffset);
  return before.toString().length;
}

function restoreCaret(offset: number) {
  const editor = editorEl.value;
  if (!editor || document.activeElement !== editor) return;
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function render() {
  const editor = editorEl.value;
  if (!editor || composing.value) return;
  const text = model.value ?? "";
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const token of props.tokens) {
    const start = Math.max(cursor, Math.min(text.length, token.start));
    const end = Math.max(start, Math.min(text.length, token.end));
    if (start > cursor)
      fragment.append(document.createTextNode(text.slice(cursor, start)));
    if (end > start) {
      const mark = document.createElement("mark");
      mark.className = `smart-token smart-token--${token.kind}`;
      mark.title = token.label;
      mark.dataset.confidence = token.confidence;
      mark.dataset.accepted = String(token.accepted);
      mark.textContent = text.slice(start, end);
      fragment.append(mark);
    }
    cursor = end;
  }
  if (cursor < text.length)
    fragment.append(document.createTextNode(text.slice(cursor)));
  editor.replaceChildren(fragment);
  if (pendingCaret !== null) restoreCaret(pendingCaret);
  pendingCaret = null;
}

function onInput() {
  pendingCaret = caretOffset();
  const value = plainText();
  const changed = model.value !== value;
  model.value = value;
  // Model changes render through the watcher. Compositionend can arrive after
  // its last input already updated the model, so only that unchanged case needs
  // a direct render. Two renders would replace the DOM after caret restoration.
  if (!composing.value && !changed) nextTick(render);
}

function onCompositionEnd() {
  composing.value = false;
  onInput();
}

function requestSubmit(event: KeyboardEvent) {
  if (event.isComposing || composing.value) return;
  event.preventDefault();
  editorEl.value?.closest("form")?.requestSubmit();
}

function focus() {
  editorEl.value?.focus();
}

watch(
  () => [model.value, props.tokens] as const,
  () => nextTick(render),
  { deep: true },
);

onMounted(render);
defineExpose({ focus });
</script>

<style scoped>
.smart-action-input {
  min-width: 0;
  min-height: 2.5rem;
  overflow-x: auto;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-content-on-surface-strong);
  line-height: 1.5rem;
  white-space: pre;
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.smart-action-input:empty::before {
  color: var(--color-content-secondary);
  content: attr(data-placeholder);
  pointer-events: none;
}

.smart-action-input:focus-visible {
  border-color: var(--ds-focus-outline-color);
  box-shadow: inset 0 0 0 1px var(--ds-focus-outline-color);
}

.smart-action-input :deep(.smart-token) {
  padding: 0.06em 0.2em;
  border-radius: var(--radius-lg);
  color: inherit;
  cursor: help;
  font-size: var(--text-sm);
}

.smart-action-input :deep(.smart-token--date) {
  background: color-mix(in srgb, var(--color-info) 18%, transparent);
}

.smart-action-input :deep(.smart-token--time),
.smart-action-input :deep(.smart-token--datetime) {
  background: color-mix(in srgb, var(--color-accent-purple) 18%, transparent);
}

.smart-action-input :deep(.smart-token--recurrence) {
  background: color-mix(in srgb, var(--color-accent-orange) 18%, transparent);
}

.smart-action-input :deep(.smart-token--warning),
.smart-action-input :deep(.smart-token[data-confidence="medium"]) {
  background: color-mix(in srgb, var(--color-warning) 22%, transparent);
  text-decoration: underline dotted var(--color-warning-text);
  text-underline-offset: 0.18em;
}
</style>
