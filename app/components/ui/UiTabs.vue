<template>
  <header :class="['max-w-full min-w-fit', borderClass]">
    <nav :class="['py-2 mb-4 flex ', direction === 'row' ? 'flex-row border-b border-muted gap-5 text-sm' : 'flex-col gap-7']">
      <button
        v-for="(tab, index) in items"
        :key="index"
        type="button"
        :class="[
          'cursor-pointer ',
          buttonBaseClass,
          activeIndexLocal === index ? activeClass : inactiveClass,
        ]"
        @click="onSelect(index)"
      >
        <UIcon v-if="tab.icon" :name="String(tab.icon)" class="w-4 h-4" />
        <span>{{ tab.name }}</span>
      </button>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { toRef } from "vue";
const props = defineProps({
  items: {
    type: Array as () => Array<Record<string, unknown>>,
    required: true,
  },
  modelValue: {
    type: Number,
    default: 0,
  },
  borderClass: {
    type: String,
    default: "border-muted dark:border-gray-700",
  },
  activeClass: {
    type: String,
    default: "border-primary text-primary dark:text-primary",
  },
  inactiveClass: {
    type: String,
    default:
      "border-transparent text-muted dark:text-neutral hover:text-muted hover:border-gray-300",
  },
  buttonBaseClass: {
    type: String,
    default: "flex items-center gap-2 font-medium  transition-colors",
  },
  direction: {
    type: String,
    default: "column",
  },
});

const emit = defineEmits(["update:modelValue", "select"]);

const activeIndexLocal = toRef(props, "modelValue");

function onSelect(index: number) {
  emit("update:modelValue", index);
  emit("select", index);
}
</script>

<style scoped>
.border-b {
  border-bottom-width: 1px;
}
</style>
