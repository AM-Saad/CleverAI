<template>
  <UiSheet
    :open="open"
    title="Move action item"
    @update:open="emit('update:open', $event)"
  >
    <form class="move-form" @submit.prevent="submit">
      <p class="move-form__title">{{ item?.actionItem.title }}</p>
      <UiFormField label="New date">
        <UiInput v-model="targetDate" type="date" required />
      </UiFormField>
      <UiFormField label="Time" hint="Leave empty to make it an all-day item">
        <UiInput v-model="targetTime" type="time" />
      </UiFormField>
      <UiButton type="submit" block :loading="saving">Move item</UiButton>
    </form>
  </UiSheet>
</template>

<script setup lang="ts">
import type { DayItemDTO } from "@shared/utils/daily.contract";
import { useDaily } from "~/features/daily/composables/useDaily";

const props = defineProps<{
  open: boolean;
  visibleDate: string;
  item: DayItemDTO | null;
}>();
const emit = defineEmits<{ (event: "update:open", value: boolean): void }>();
const daily = useDaily();
const targetDate = ref(props.visibleDate);
const targetTime = ref<string | null>(null);
const saving = ref(false);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    targetDate.value =
      props.item?.activePlacement?.dateKey ?? props.visibleDate;
    targetTime.value =
      props.item?.activePlacement?.localTime ??
      props.item?.actionItem.localTime ??
      null;
  },
);

async function submit() {
  if (!props.item) return;
  saving.value = true;
  try {
    await daily.reschedule(
      props.visibleDate,
      props.item,
      targetDate.value,
      targetTime.value || null,
    );
    emit("update:open", false);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.move-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.move-form__title {
  color: var(--color-content-secondary);
  font-weight: 600;
}
</style>
