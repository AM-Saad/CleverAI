<script setup lang="ts">
const props = defineProps<{
  modelValue: "board" | "list";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: "board" | "list"): void;
}>();

const options = [
  { value: "board" as const, icon: "heroicons:view-columns", label: "Board" },
  { value: "list" as const, icon: "heroicons:list-bullet", label: "List" },
];
</script>

<template>
  <div class="flex items-center gap-1 bg-surface rounded-[var(--radius-lg)] p-1">
    <button v-for="option in options" :key="option.value"
      class="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-md)] text-sm font-medium transition-colors"
      :class="[
        modelValue === option.value
          ? 'bg-background text-content-on-background shadow-sm'
          : 'text-content-secondary hover:text-content-on-surface'
      ]" @click="emit('update:modelValue', option.value)">
      <Icon :name="option.icon" class="w-4 h-4" />
      <!-- <span>{{ option.label }}</span> -->
    </button>
  </div>
</template>
