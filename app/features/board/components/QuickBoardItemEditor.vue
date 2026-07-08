<template>
  <div class="qbi">
    <div class="qbi__bar">
      <UiIconButton
        icon="i-lucide-chevron-left"
        label="Back to capture"
        size="sm"
        @click="emit('back')"
      />
      <span class="qbi__target">
        <UiIcon name="i-lucide-kanban" class="h-3.5 w-3.5" />
        {{ columnLabel }}
      </span>
    </div>

    <div
      ref="bodyEl"
      class="qbi__body tiptap"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      data-placeholder="What needs doing?"
      @input="onBodyInput"
    />
    <!-- design-allow: native rich-text board quick-capture body -->

    <div class="qbi__footer">
      <UiButton
        variant="ghost"
        tone="neutral"
        leading-icon="i-lucide-maximize-2"
        @click="emit('open-full')"
      >
        Open full card
      </UiButton>
      <UiButton pill tone="primary" @click="emit('done')">Done</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    columnLabel?: string;
    autofocus?: boolean;
  }>(),
  { columnLabel: "Unassigned", autofocus: true },
);

const emit = defineEmits<{
  (e: "update:content", value: string): void;
  (e: "open-full"): void;
  (e: "done"): void;
  (e: "back"): void;
}>();

const bodyEl = ref<HTMLElement | null>(null);

function onBodyInput() {
  emit("update:content", bodyEl.value?.innerHTML ?? "");
}

onMounted(() => {
  if (!props.autofocus || !bodyEl.value) return;
  nextTick(() => bodyEl.value?.focus());
});
</script>

<style scoped>
.qbi {
  display: flex;
  min-height: 34dvh;
  flex-direction: column;
  gap: var(--space-2);
}
.qbi__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: calc(-1 * var(--space-1));
}
.qbi__target {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--color-content-secondary);
  font-size: 12px;
  font-weight: 700;
}
.qbi__body {
  flex: 1;
  min-height: 180px;
  outline: none;
  color: var(--color-content-on-surface);
  font-size: 15px;
  line-height: 1.7;
}
.qbi__body:empty::before {
  content: attr(data-placeholder);
  color: var(--color-content-disabled);
}
.qbi__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
}
</style>
