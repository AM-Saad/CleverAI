<template>
  <form ref="formEl" class="inline-action" :aria-label="item ? 'Edit action item' : 'Quick add action item'"
    @submit.prevent="submit" @keydown.esc.prevent="emit('cancel')">
    <div class="inline-action__main">
      <UiInput v-model="title" aria-label="Action item title" placeholder="What needs to happen?" autocomplete="off"
        :disabled="saving" />
      <UiButton type="submit" size="sm" :icon="item ? 'check' : 'plus'" :loading="saving"
        :disabled="!title.trim()">
        {{ item ? "Save" : "Add" }}
      </UiButton>
      <UiIconButton type="button" icon="x" label="Cancel" size="sm" :disabled="saving"
        @click="emit('cancel')" />
    </div>

    <div class="inline-action__options">
      <UiSegmentedControl v-model="timingMode" label="Action timing" size="sm" :items="timingOptions" />
      <UiInput v-if="timingMode === 'TIMED'" v-model="localTime" class="inline-action__time" aria-label="Action time"
        type="time" size="xs" required />
      <UiSelect v-model="frequency" class="inline-action__repeat" aria-label="Repeat" size="xs" :items="repeatOptions"
        value-key="value" label-key="label" />
    </div>

    <UiAlert v-if="error" tone="error" :title="error" />
    <UiParagraph v-else-if="!item" size="xs" color="content-secondary" class="inline-action__hint">
      Enter adds · Esc closes
    </UiParagraph>
  </form>
</template>

<script setup lang="ts">
import type { RecurrenceRuleDTO } from "@shared/utils/daily.contract";
import {
  parseDateKey,
  weekdayForDateKey,
} from "@shared/utils/daily-recurrence";
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import { useDaily } from "../composables/useDaily";
import UiIconButton from "~/components/ui/UiIconButton.vue";

const props = defineProps<{
  dateKey: string;
  item?: DailyActionViewModel;
}>();
const emit = defineEmits<{
  cancel: [];
  saved: [];
}>();

const daily = useDaily();
const formEl = ref<HTMLFormElement | null>(null);
const title = ref(props.item?.title ?? "");
const timingMode = ref<"ALL_DAY" | "TIMED">(
  props.item?.timingMode ?? "ALL_DAY",
);
const localTime = ref(props.item?.localTime ?? "09:00");
const frequency = ref(props.item?.recurrence?.frequency ?? "NONE");
const saving = ref(false);
const error = ref<string | null>(null);

const timingOptions = [
  { value: "ALL_DAY", label: "All day", icon: "sun" },
  { value: "TIMED", label: "Time", icon: "clock-3" },
] as const;
const repeatOptions = [
  { value: "NONE", label: "No repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
] as const;

function focus() {
  nextTick(() => formEl.value?.querySelector("input")?.focus());
}

function recurrence(): RecurrenceRuleDTO | null {
  if (frequency.value === "NONE") return null;
  if (
    props.item?.recurrence &&
    props.item.recurrence.frequency === frequency.value
  ) {
    return props.item.recurrence;
  }

  const startDate = props.item?.startDate ?? props.dateKey;
  const date = parseDateKey(startDate)!;
  return {
    frequency: frequency.value as RecurrenceRuleDTO["frequency"],
    interval: 1,
    weekdays:
      frequency.value === "WEEKLY" ? [weekdayForDateKey(startDate)] : undefined,
    monthDay: ["MONTHLY", "YEARLY"].includes(frequency.value)
      ? date.getUTCDate()
      : undefined,
    month: frequency.value === "YEARLY" ? date.getUTCMonth() + 1 : undefined,
    missingDayPolicy: "LAST_DAY",
    ends: "NEVER",
  };
}

async function submit() {
  const value = title.value.trim();
  if (!value || saving.value) return;

  saving.value = true;
  error.value = null;
  const timezone =
    props.item?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    if (props.item) {
      await daily.updateAction({
        id: props.item.actionItemId,
        visibleDateKey: props.dateKey,
        title: value,
        timingMode: timingMode.value,
        localTime: timingMode.value === "TIMED" ? localTime.value : null,
        timezone,
        recurrence: recurrence(),
        placementId: props.item.activePlacementId,
      });
    } else {
      await daily.createAction({
        title: value,
        dateKey: props.dateKey,
        timingMode: timingMode.value,
        localTime: timingMode.value === "TIMED" ? localTime.value : null,
        timezone,
        recurrence: recurrence(),
      });
      title.value = "";
    }
    emit("saved");
    focus();
  } catch (submitError) {
    error.value =
      submitError instanceof Error
        ? submitError.message
        : "Unable to save action";
  } finally {
    saving.value = false;
  }
}

onMounted(focus);
defineExpose({ focus });
</script>

<style scoped>
.inline-action {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
}

.inline-action__main,
.inline-action__options {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.inline-action__main> :first-child {
  min-width: 0;
  flex: 1;
}

.inline-action__options {
  flex-wrap: wrap;
}

.inline-action__time {
  width: 8.5rem;
}

.inline-action__repeat {
  min-width: 9rem;
  flex: 1;
}

.inline-action__hint {
  align-self: flex-end;
}

@media (max-width: 30rem) {
  .inline-action__main {
    align-items: stretch;
  }

  .inline-action__time,
  .inline-action__repeat {
    min-width: 8rem;
    flex: 1;
  }

  .inline-action__hint {
    display: none;
  }
}
</style>
