<template>
  <input
    ref="inputRef"
    type="file"
    class="hidden"
    :accept="accept"
    :multiple="multiple"
    @change="onChange"
  />
</template>

<script setup lang="ts">
/**
 * UiFileInput — the native file picker has no restylable chrome in any
 * browser, so this wraps the standard "hidden input + your own trigger"
 * pattern: mount it, hold a ref, call `pick()` from any trigger element
 * (a UiButton, a card, ...), and read the chosen files from `select`.
 */
import { ref } from "vue";

const inputRef = ref<HTMLInputElement | null>(null);
const { accept, multiple = false } = defineProps<{
  accept?: string;
  multiple?: boolean;
}>();
const emit = defineEmits<{ select: [files: FileList] }>();

function onChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files?.length) emit("select", files);
  (event.target as HTMLInputElement).value = "";
}

function pick() {
  inputRef.value?.click();
}

defineExpose({ pick });
</script>
