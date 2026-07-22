<template>
  <UiSheet :open="open" title="Move action item" @update:open="emit('update:open', $event)">
    <RescheduleActionForm :title="item?.actionItem.title" :initial-date="initialDate" :initial-time="initialTime"
      :saving="saving" @submit="submit" />
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
const initialDate = computed(() => props.item?.activePlacement?.dateKey ?? props.visibleDate);
const initialTime = computed(
  () => props.item?.activePlacement?.localTime ?? props.item?.actionItem.localTime ?? null,
);

async function submit(targetDate: string, targetTime: string | null) {
  if (!props.item) return;
  saving.value = true;
  try {
    await daily.reschedule(props.visibleDate, props.item, targetDate, targetTime);
    emit("update:open", false);
  } finally {
    saving.value = false;
  }
}
</script>
