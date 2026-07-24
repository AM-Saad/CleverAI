<template>
  <NodeViewWrapper tag="li" data-type="taskItem" :data-checked="node.attrs.checked" class="task-item-node">
    <span class="task-item-checkbox-wrapper" contenteditable="false">
      <UiCheckbox
        :model-value="Boolean(node.attrs.checked)"
        :disabled="!editor?.isEditable"
        @update:model-value="onCheckChange"
      />
    </span>
    <NodeViewContent class="task-item-content" :class="{ 'task-item-content--checked': node.attrs.checked }" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from "@tiptap/vue-3";

const props = defineProps(nodeViewProps);

function onCheckChange(val: boolean | "indeterminate") {
  if (typeof props.updateAttributes === "function") {
    props.updateAttributes({ checked: Boolean(val) });
  }
}
</script>

<style scoped>
.task-item-node {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: var(--space-1.5) 0;
  list-style: none;
}

.task-item-checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  margin-top: 0.2em;
  user-select: none;
}

.task-item-content {
  flex: 1 1 0%;
  min-width: 0;
}

.task-item-content--checked {
  text-decoration: line-through;
  color: var(--color-content-disabled);
}
</style>
