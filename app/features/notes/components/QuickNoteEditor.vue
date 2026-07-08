<template>
  <div class="qne">
    <input ref="titleEl" class="qne__title" placeholder="Untitled note" dir="auto" enterkeyhint="next" aria-label="Note title" @input="emit('update:title', ($event.target as HTMLInputElement).value)" @keydown.enter.prevent="focusBody" /> <!-- design-allow: native quick-capture title field (matches the full editor's title) -->
    <div
      ref="bodyEl"
      class="qne__body tiptap"
      contenteditable="true"
      dir="auto"
      role="textbox"
      aria-multiline="true"
      aria-label="Note content"
      @input="onBodyInput"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * QuickNoteEditor — the minimal writable surface for quick capture (title +
 * text body). Hosted by QuickNoteSheet (notes page) and CaptureSheet (the
 * in-place "New note" morph). Fully uncontrolled while typing: the inputs are
 * seeded once on mount so store round-trips can never clobber the caret —
 * the note may not even exist yet (lazy create on first character).
 */
import { onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    /** Seed values applied once on mount (the editor remounts per open). */
    initialTitle?: string;
    initialContent?: string;
    autofocus?: boolean;
  }>(),
  { initialTitle: "", initialContent: "", autofocus: true },
);

const emit = defineEmits<{
  (e: "update:title", v: string): void;
  (e: "update:content", v: string): void;
}>();

const titleEl = ref<HTMLInputElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);

function onBodyInput() {
  emit("update:content", bodyEl.value?.innerHTML ?? "");
}
function focusBody() {
  bodyEl.value?.focus();
}

onMounted(() => {
  if (titleEl.value) titleEl.value.value = props.initialTitle;
  if (bodyEl.value) bodyEl.value.innerHTML = props.initialContent;
  if (props.autofocus) titleEl.value?.focus();
});
</script>

<style scoped>
.qne {
  display: flex;
  flex-direction: column;
  min-height: 34dvh;
}
.qne__title {
  width: 100%;
  border: none;
  background: transparent;
  padding: var(--space-1) 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--color-content-on-surface-strong);
  outline: none;
}
.qne__title::placeholder {
  color: var(--color-content-disabled);
}
.qne__body {
  flex: 1;
  margin-top: var(--space-2);
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--color-content-on-surface);
  outline: none;
}
.qne__body:empty::before {
  content: "Start writing…";
  color: var(--color-content-disabled);
}
.qne__body ::selection {
  background: color-mix(in srgb, var(--color-primary) 22%, transparent);
}
</style>
