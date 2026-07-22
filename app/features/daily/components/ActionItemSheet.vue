<template>
  <UiSheet
    :open="open"
    title="Add action item"
    @update:open="emit('update:open', $event)"
  >
    <form class="action-form" @submit.prevent="submit">
      <UiFormField label="Action" required>
        <UiInput
          v-model="title"
          placeholder="What needs to happen?"
          autofocus
          required
        />
      </UiFormField>

      <UiFormField label="When">
        <UiButtonGroup>
          <UiButton
            type="button"
            :variant="timingMode === 'ALL_DAY' ? 'solid' : 'soft'"
            @click="timingMode = 'ALL_DAY'"
            >All day</UiButton
          >
          <UiButton
            type="button"
            :variant="timingMode === 'TIMED' ? 'solid' : 'soft'"
            @click="timingMode = 'TIMED'"
            >Timed</UiButton
          >
        </UiButtonGroup>
      </UiFormField>

      <div class="action-form__row">
        <UiFormField label="Date" class="action-form__field">
          <UiInput v-model="dateKey" type="date" required />
        </UiFormField>
        <UiFormField
          v-if="timingMode === 'TIMED'"
          label="Time"
          class="action-form__field"
        >
          <UiInput v-model="localTime" type="time" required />
        </UiFormField>
      </div>

      <UiFormField label="Repeats">
        <UiSelect
          v-model="frequency"
          :items="repeatOptions"
          value-key="value"
          label-key="label"
        />
      </UiFormField>

      <UiAlert v-if="error" tone="error" :title="error" />

      <UiButton type="submit" block :loading="saving" :disabled="!title.trim()">
        Add to {{ formattedDate }}
      </UiButton>
    </form>
  </UiSheet>
</template>

<script setup lang="ts">
import type { RecurrenceRuleDTO } from "@shared/utils/daily.contract";
import {
  formatDateKey,
  parseDateKey,
  weekdayForDateKey,
} from "@shared/utils/daily-recurrence";
import { useDaily } from "~/features/daily/composables/useDaily";

const props = defineProps<{ open: boolean; initialDate: string }>();
const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
  (event: "created"): void;
}>();
const daily = useDaily();

const title = ref("");
const dateKey = ref(props.initialDate);
const localTime = ref("09:00");
const timingMode = ref<"ALL_DAY" | "TIMED">("ALL_DAY");
const frequency = ref("NONE");
const saving = ref(false);
const error = ref<string | null>(null);

const repeatOptions = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const formattedDate = computed(() => {
  return formatDateKey(dateKey.value, undefined, {
    month: "short",
    day: "numeric",
  });
});

watch(
  () => props.initialDate,
  (value) => {
    dateKey.value = value;
  },
);
watch(
  () => props.open,
  (value) => {
    if (value) {
      dateKey.value = props.initialDate;
      error.value = null;
    }
  },
);

function recurrence(): RecurrenceRuleDTO | null {
  if (frequency.value === "NONE") return null;
  const date = parseDateKey(dateKey.value)!;
  return {
    frequency: frequency.value as RecurrenceRuleDTO["frequency"],
    interval: 1,
    weekdays:
      frequency.value === "WEEKLY"
        ? [weekdayForDateKey(dateKey.value)]
        : undefined,
    monthDay: ["MONTHLY", "YEARLY"].includes(frequency.value)
      ? date.getUTCDate()
      : undefined,
    month: frequency.value === "YEARLY" ? date.getUTCMonth() + 1 : undefined,
    missingDayPolicy: "LAST_DAY",
    ends: "NEVER",
  };
}

async function submit() {
  if (!title.value.trim()) return;
  saving.value = true;
  error.value = null;
  try {
    await daily.createAction({
      title: title.value,
      dateKey: dateKey.value,
      timingMode: timingMode.value,
      localTime: timingMode.value === "TIMED" ? localTime.value : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence: recurrence(),
    });
    title.value = "";
    frequency.value = "NONE";
    emit("created");
    emit("update:open", false);
  } catch (submitError) {
    error.value =
      submitError instanceof Error
        ? submitError.message
        : "Unable to add action";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.action-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.action-form__row {
  display: flex;
  gap: var(--space-3);
}

.action-form__field {
  flex: 1;
}
</style>
