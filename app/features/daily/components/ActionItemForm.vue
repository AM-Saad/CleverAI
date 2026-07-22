<template>
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
      <UiSegmentedControl
        v-model="timingMode"
        label="Action timing"
        :items="timingOptions"
      />
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
</template>

<script setup lang="ts">
import type { RecurrenceRuleDTO } from "@shared/utils/daily.contract";
import {
  formatDateKey,
  parseDateKey,
  weekdayForDateKey,
} from "@shared/utils/daily-recurrence";
import type { DailyNewActionInput } from "../composables/useDaily";

const props = defineProps<{
  initialDate: string;
  saving: boolean;
  error: string | null;
  resetKey: number;
}>();
const emit = defineEmits<{ submit: [input: DailyNewActionInput] }>();

const title = ref("");
const dateKey = ref(props.initialDate);
const localTime = ref("09:00");
const timingMode = ref<"ALL_DAY" | "TIMED">("ALL_DAY");
const frequency = ref("NONE");
const timingOptions = [
  { value: "ALL_DAY", label: "All day" },
  { value: "TIMED", label: "Timed" },
] as const;
const repeatOptions = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];
const formattedDate = computed(() =>
  formatDateKey(dateKey.value, undefined, { month: "short", day: "numeric" }),
);

watch(
  () => props.initialDate,
  (value) => {
    dateKey.value = value;
  },
);
watch(
  () => props.resetKey,
  () => {
    title.value = "";
    frequency.value = "NONE";
    timingMode.value = "ALL_DAY";
    dateKey.value = props.initialDate;
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

function submit() {
  if (!title.value.trim()) return;
  emit("submit", {
    title: title.value,
    dateKey: dateKey.value,
    timingMode: timingMode.value,
    localTime: timingMode.value === "TIMED" ? localTime.value : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrence: recurrence(),
  });
}
</script>

<style scoped>
.action-form {
  display: flex;
  flex-direction: column;
}
.action-form__row {
  display: flex;
  gap: var(--space-3);
}
.action-form__field {
  flex: 1;
}
</style>
