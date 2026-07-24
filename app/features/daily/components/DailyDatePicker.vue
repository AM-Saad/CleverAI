<template>
  <div class="daily-date-picker" role="dialog" aria-label="Date picker" @keydown="onKeydown">
    <!-- Header: Navigation & Month/Year Display -->
    <div class="daily-date-picker__header">
      <div class="daily-date-picker__title-group">
        <button type="button" class="daily-date-picker__month-toggle" :aria-expanded="showMonthYearSelector" aria-label="Toggle month and year selector" @click="showMonthYearSelector = !showMonthYearSelector"> <!-- design-allow: date picker month/year toggle -->
          <span class="daily-date-picker__month-label">{{ currentMonthLabel }}</span>
          <UiIcon
            name="i-lucide-chevron-down"
            class="daily-date-picker__chevron"
            :class="{ 'daily-date-picker__chevron--open': showMonthYearSelector }"
          />
        </button>
      </div>

      <div class="daily-date-picker__nav-actions">
        <UiIconButton
          icon="i-lucide-chevron-left"
          label="Previous month"
          size="sm"
          variant="ghost"
          tone="neutral"
          @click="changeMonth(-1)"
        />
        <UiIconButton
          icon="i-lucide-chevron-right"
          label="Next month"
          size="sm"
          variant="ghost"
          tone="neutral"
          @click="changeMonth(1)"
        />
      </div>
    </div>

    <!-- Quick Presets Bar -->
    <div class="daily-date-picker__presets">
      <UiButton
        v-for="preset in presets"
        :key="preset.id"
        size="xs"
        :variant="preset.dateKey === activeDateKey ? 'solid' : 'soft'"
        :tone="preset.dateKey === activeDateKey ? 'primary' : 'neutral'"
        @click="selectDateKey(preset.dateKey)"
      >
        {{ preset.label }}
      </UiButton>
    </div>

    <!-- View Mode 1: Month/Year Direct Selector Grid -->
    <div v-if="showMonthYearSelector" class="daily-date-picker__selector-view">
      <div class="daily-date-picker__year-row">
        <UiIconButton
          icon="i-lucide-chevron-left"
          label="Previous year"
          size="sm"
          variant="ghost"
          tone="neutral"
          @click="viewYear -= 1"
        />
        <span class="daily-date-picker__year-display">{{ viewYear }}</span>
        <UiIconButton
          icon="i-lucide-chevron-right"
          label="Next year"
          size="sm"
          variant="ghost"
          tone="neutral"
          @click="viewYear += 1"
        />
      </div>

      <div class="daily-date-picker__months-grid">
        <button v-for="(mName, idx) in monthNamesShort" :key="mName" type="button" class="daily-date-picker__month-cell" :class="{ 'daily-date-picker__month-cell--active': idx === viewMonth }" @click="selectMonth(idx)"> <!-- design-allow: date picker month grid cell -->
          {{ mName }}
        </button>
      </div>

      <div class="daily-date-picker__direct-jump">
        <span class="daily-date-picker__jump-label">Jump to date</span>
        <UiInput
          type="date"
          :model-value="displayDateKey"
          class="daily-date-picker__jump-input"
          @update:model-value="onDirectDateInput"
        />
      </div>
    </div>

    <!-- View Mode 2: Standard 7-Day Month Grid -->
    <div v-else class="daily-date-picker__calendar-view">
      <!-- Weekday Headers -->
      <div class="daily-date-picker__weekdays" role="row">
        <span
          v-for="w in weekdayHeaders"
          :key="w"
          class="daily-date-picker__weekday"
          role="columnheader"
        >
          {{ w }}
        </span>
      </div>

      <!-- Days Grid -->
      <div
        ref="gridRef"
        class="daily-date-picker__days-grid"
        role="grid"
        aria-label="Calendar dates"
      >
        <button v-for="cell in calendarCells" :key="cell.dateKey" type="button" class="daily-date-picker__day-cell" :class="{ 'daily-date-picker__day-cell--selected': cell.dateKey === activeDateKey, 'daily-date-picker__day-cell--today': cell.isToday && cell.dateKey !== activeDateKey, 'daily-date-picker__day-cell--outside': !cell.isCurrentMonth, 'daily-date-picker__day-cell--focused': cell.dateKey === focusedDateKey }" :tabindex="cell.dateKey === focusedDateKey ? 0 : -1" :aria-selected="cell.dateKey === activeDateKey" :aria-label="cell.fullLabel" @click="selectDateKey(cell.dateKey)" @focus="focusedDateKey = cell.dateKey"> <!-- design-allow: date picker calendar day grid cell -->
          <span class="daily-date-picker__day-number">{{ cell.dayNumber }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  addDateKeyDays,
  dateKeyInTimeZone,
  formatDateKey,
  isDateKey,
  parseDateKey,
} from "@shared/utils/daily-recurrence";

const props = defineProps<{
  activeDateKey: string;
}>();

const emit = defineEmits<{
  (e: "select-date", dateKey: string): void;
  (e: "close"): void;
}>();

const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";

const todayKey = computed(() => dateKeyInTimeZone(new Date(), timeZone));
const displayDateKey = computed(() =>
  isDateKey(props.activeDateKey) ? props.activeDateKey : todayKey.value,
);

const activeDateParsed = computed(() => parseDateKey(displayDateKey.value));

// Internal view month and year
const viewYear = ref(
  activeDateParsed.value ? activeDateParsed.value.getUTCFullYear() : new Date().getUTCFullYear(),
);
const viewMonth = ref(
  activeDateParsed.value ? activeDateParsed.value.getUTCMonth() : new Date().getUTCMonth(),
);

const focusedDateKey = ref(displayDateKey.value);
const showMonthYearSelector = ref(false);
const gridRef = ref<HTMLElement | null>(null);

// Reset view month & year when activeDateKey changes externally
watch(
  () => props.activeDateKey,
  (newKey) => {
    const parsed = parseDateKey(newKey);
    if (parsed) {
      viewYear.value = parsed.getUTCFullYear();
      viewMonth.value = parsed.getUTCMonth();
      focusedDateKey.value = newKey;
    }
  },
  { immediate: true },
);

// Weekday Headers (Monday-first)
const weekdayHeaders = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const monthNamesShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const currentMonthLabel = computed(() => {
  const dummyDate = new Date(Date.UTC(viewYear.value, viewMonth.value, 1));
  return dummyDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
});

// Quick Jump Presets
const presets = computed(() => {
  const tKey = todayKey.value;
  return [
    { id: "today", label: "Today", dateKey: tKey },
    { id: "tomorrow", label: "Tomorrow", dateKey: addDateKeyDays(tKey, 1) },
    { id: "yesterday", label: "Yesterday", dateKey: addDateKeyDays(tKey, -1) },
    { id: "next-week", label: "+7 Days", dateKey: addDateKeyDays(tKey, 7) },
  ];
});

// Calculate 7-column grid cells for current view month
const calendarCells = computed(() => {
  const year = viewYear.value;
  const month = viewMonth.value;
  const tKey = todayKey.value;

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1));
  // Convert UTC Sunday (0) to Monday-first (0-6)
  const firstDayWeekday = (firstDay.getUTCDay() + 6) % 7;

  const cells: Array<{
    dateKey: string;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    fullLabel: string;
  }> = [];

  // Leading padding days from previous month
  const prevMonthLastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDate - i;
    const prevDate = new Date(Date.UTC(year, month - 1, dayNum));
    const dKey = dateKeyFromUtc(prevDate);
    cells.push({
      dateKey: dKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dKey === tKey,
      fullLabel: formatDateLabel(dKey),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const currDate = new Date(Date.UTC(year, month, d));
    const dKey = dateKeyFromUtc(currDate);
    cells.push({
      dateKey: dKey,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dKey === tKey,
      fullLabel: formatDateLabel(dKey),
    });
  }

  // Trailing padding days to fill 7-column rows
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(Date.UTC(year, month + 1, i));
    const dKey = dateKeyFromUtc(nextDate);
    cells.push({
      dateKey: dKey,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dKey === tKey,
      fullLabel: formatDateLabel(dKey),
    });
  }

  return cells;
});

function dateKeyFromUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dKey: string): string {
  return formatDateKey(dKey, undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function changeMonth(delta: number) {
  let newMonth = viewMonth.value + delta;
  let newYear = viewYear.value;
  if (newMonth < 0) {
    newMonth = 11;
    newYear -= 1;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear += 1;
  }
  viewMonth.value = newMonth;
  viewYear.value = newYear;
}

function selectMonth(mIndex: number) {
  viewMonth.value = mIndex;
  showMonthYearSelector.value = false;
}

function selectDateKey(dKey: string) {
  if (!isDateKey(dKey)) return;
  focusedDateKey.value = dKey;
  emit("select-date", dKey);
  emit("close");
}

function onDirectDateInput(val: string | number) {
  const strVal = String(val);
  if (isDateKey(strVal)) {
    selectDateKey(strVal);
  }
}

// Keyboard Navigation inside calendar
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
    return;
  }

  if (showMonthYearSelector.value) return;

  const currentFocused = focusedDateKey.value;
  if (!isDateKey(currentFocused)) return;

  let delta = 0;

  switch (e.key) {
    case "ArrowLeft":
      delta = -1;
      break;
    case "ArrowRight":
      delta = 1;
      break;
    case "ArrowUp":
      delta = -7;
      break;
    case "ArrowDown":
      delta = 7;
      break;
    case "Home":
      // Start of week
      {
        const parsed = parseDateKey(currentFocused);
        if (parsed) {
          const weekday = (parsed.getUTCDay() + 6) % 7;
          delta = -weekday;
        }
      }
      break;
    case "End":
      // End of week
      {
        const parsed = parseDateKey(currentFocused);
        if (parsed) {
          const weekday = (parsed.getUTCDay() + 6) % 7;
          delta = 6 - weekday;
        }
      }
      break;
    case "PageUp":
      changeMonth(-1);
      e.preventDefault();
      return;
    case "PageDown":
      changeMonth(1);
      e.preventDefault();
      return;
    default:
      return;
  }

  if (delta !== 0) {
    e.preventDefault();
    const targetKey = addDateKeyDays(currentFocused, delta);
    focusedDateKey.value = targetKey;

    const parsed = parseDateKey(targetKey);
    if (parsed) {
      viewYear.value = parsed.getUTCFullYear();
      viewMonth.value = parsed.getUTCMonth();
    }

    void nextTick(() => {
      const el = gridRef.value?.querySelector<HTMLElement>(
        `[aria-label="${formatDateLabel(targetKey)}"]`
      );
      el?.focus();
    });
  }
}
</script>

<style scoped>
.daily-date-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  width: 320px;
  max-width: 90vw;
  background: var(--color-surface);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-dropdown);
  user-select: none;
}

/* Header */
.daily-date-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.daily-date-picker__title-group {
  display: flex;
  align-items: center;
}

.daily-date-picker__month-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-sm);
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.daily-date-picker__month-toggle:hover {
  background: var(--color-surface-strong);
}

.daily-date-picker__month-toggle:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
}

.daily-date-picker__chevron {
  width: 1rem;
  height: 1rem;
  color: var(--color-content-secondary);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.daily-date-picker__chevron--open {
  transform: rotate(180deg);
}

.daily-date-picker__nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* Presets Bar */
.daily-date-picker__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

/* Month/Year Direct Selector View */
.daily-date-picker__selector-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.daily-date-picker__year-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2);
}

.daily-date-picker__year-display {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--color-content-on-surface-strong);
}

.daily-date-picker__months-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.daily-date-picker__month-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--color-background);
  color: var(--color-content-on-surface);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-standard);
}

.daily-date-picker__month-cell:hover {
  background: var(--color-surface-strong);
  color: var(--color-content-on-surface-strong);
}

.daily-date-picker__month-cell--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}

.daily-date-picker__direct-jump {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-secondary);
}

.daily-date-picker__jump-label {
  font-size: var(--text-xs);
  color: var(--color-content-secondary);
  font-weight: 650;
}

/* Standard Calendar Grid */
.daily-date-picker__calendar-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.daily-date-picker__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  text-align: center;
}

.daily-date-picker__weekday {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-content-secondary);
  padding: var(--space-1) 0;
}

.daily-date-picker__days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
}

.daily-date-picker__day-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: none;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-content-on-surface);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.daily-date-picker__day-cell:hover:not(.daily-date-picker__day-cell--selected) {
  background: var(--color-surface-strong);
  color: var(--color-content-on-surface-strong);
}

.daily-date-picker__day-cell:active {
  transform: scale(0.94);
}

.daily-date-picker__day-cell:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: -1px;
  z-index: 1;
}

.daily-date-picker__day-cell--outside {
  color: var(--color-content-disabled);
  opacity: 0.6;
}

.daily-date-picker__day-cell--today {
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}

.daily-date-picker__day-cell--selected {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
</style>
