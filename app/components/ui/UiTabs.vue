<template>
  <header :class="['border-b py-2 mb-4', borderClass]">
    <nav class="flex gap-x-5">
      <button
        v-for="(tab, index) in items"
        :key="index"
        type="button"
        :class="[
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
      "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300",
  },
  buttonBaseClass: {
    type: String,
    default: "flex items-center gap-2 font-medium text-xs transition-colors",
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
