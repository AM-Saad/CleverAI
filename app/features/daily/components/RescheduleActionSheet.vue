<template>
  <UiSheet
    :open="open"
    title="Move action item"
    @update:open="emit('update:open', $event)"
  >
    <UiAlert v-if="error" tone="error" :title="error" />
    <RescheduleActionForm
      :title="item?.actionItem.title"
      :initial-date="initialDate"
      :initial-time="initialTime"
      :saving="saving"
      @submit="submit"
    />
  </UiSheet>
</template>

<script setup lang="ts">
import type { DayItemDTO } from "@shared/utils/daily.contract";
import { useDaily } from "../composables/useDaily";
import RescheduleActionForm from "~/features/daily/components/RescheduleActionForm.vue";

const props = defineProps<{
  open: boolean;
  visibleDate: string;
  item: DayItemDTO | null;
}>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const daily = useDaily();
const saving = ref(false);
const error = ref<string | null>(null);
const initialDate = computed(
  () => props.item?.activePlacement?.dateKey ?? props.visibleDate,
);
const initialTime = computed(
  () =>
    props.item?.activePlacement?.localTime ??
    props.item?.actionItem.localTime ??
    null,
);

async function submit(targetDate: string, targetTime: string | null) {
  if (!props.item) return;
  saving.value = true;
  error.value = null;
  try {
    await daily.reschedule(
      props.visibleDate,
      props.item,
      targetDate,
      targetTime,
    );
    emit("update:open", false);
  } catch (submitError) {
    error.value =
      submitError instanceof Error
        ? submitError.message
        : "Unable to move this action item.";
  } finally {
    saving.value = false;
  }
}

watch(
  () => [props.open, props.item?.occurrenceKey] as const,
  () => {
    error.value = null;
  },
);
</script>
