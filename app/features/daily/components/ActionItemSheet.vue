<template>
  <UiSheet :open="open" title="Add action item" @update:open="emit('update:open', $event)">
    <ActionItemForm :initial-date="initialDate" :saving="saving" :error="error" :reset-key="resetKey"
      @submit="submit" />
  </UiSheet>
</template>

<script setup lang="ts">
import type { DailyNewActionInput } from "../composables/useDaily";
import { useDaily } from "../composables/useDaily";
import ActionItemForm from "~/features/daily/components/ActionItemForm.vue";


defineProps<{ open: boolean; initialDate: string }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [];
}>();
const daily = useDaily();
const saving = ref(false);
const error = ref<string | null>(null);
const resetKey = ref(0);

async function submit(input: DailyNewActionInput) {
  saving.value = true;
  error.value = null;
  try {
    await daily.createAction(input);
    resetKey.value += 1;
    emit("created");
    emit("update:open", false);
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : "Unable to add action";
  } finally {
    saving.value = false;
  }
}
</script>
