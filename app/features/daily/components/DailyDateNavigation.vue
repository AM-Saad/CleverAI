<template>
  <header class="day-header">
    <div class="day-header__date-nav">
      <UiIconButton
        icon="i-lucide-chevron-left"
        label="Previous day"
        @click="$emit('navigate', -1)"
      />

      <UiPopover
        v-model:open="pickerOpen"
        :content="{ align: 'center', side: 'bottom', sideOffset: 8 }"
      >
        <button type="button" class="day-header__date-trigger" :class="{ 'day-header__date-trigger--open': pickerOpen }" :aria-expanded="pickerOpen" aria-haspopup="dialog" aria-label="Open date picker"> <!-- design-allow: date navigation header popover trigger -->
          <div class="day-header__date-title">
            <p>{{ eyebrow }}</p>
            <div class="day-header__title-row">
              <UiTitle tag="h1">{{ title }}</UiTitle>
              <UiIcon
                name="i-lucide-calendar"
                class="day-header__calendar-icon"
                :class="{ 'day-header__calendar-icon--active': pickerOpen }"
              />
            </div>
          </div>
        </button>

        <template #content>
          <DailyDatePicker
            :active-date-key="activeDateKey"
            @select-date="onSelectDate"
            @close="pickerOpen = false"
          />
        </template>
      </UiPopover>

      <UiIconButton
        icon="i-lucide-chevron-right"
        label="Next day"
        @click="$emit('navigate', 1)"
      />
    </div>

    <nav class="day-header__week" aria-label="Nearby days">
      <NuxtLink
        v-for="day in days"
        :key="day.dateKey"
        :to="`/day/${day.dateKey}`"
        class="day-header__day-chip"
        :class="{
          'day-header__day-chip--active': day.dateKey === activeDateKey,
        }"
        :aria-current="day.dateKey === activeDateKey ? 'date' : undefined"
      >
        <span>{{ day.weekday }}</span>
        <strong>{{ day.day }}</strong>
      </NuxtLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";
import DailyDatePicker from "./DailyDatePicker.vue";

defineProps<{
  activeDateKey: string;
  eyebrow: string;
  title: string;
  days: readonly { dateKey: string; weekday: string; day: number }[];
  accountLink: string | Record<string, unknown>;
}>();

const emit = defineEmits<{
  navigate: [amount: number];
  selectDate: [dateKey: string];
}>();

const pickerOpen = ref(false);

function onSelectDate(dateKey: string) {
  pickerOpen.value = false;
  emit("selectDate", dateKey);
  void navigateTo(`/day/${dateKey}`);
}
</script>

<style scoped>
.day-header {
  display: flex;
  gap: var(--space-4);
  justify-content: space-between;
}

.day-header__topline,
.day-header__date-nav {
  display: flex;
  align-items: center;
}

.day-header__topline,
.day-header__date-nav {
  justify-content: space-between;
  gap: var(--space-2);
}

.day-header__app-link,
.day-header__account-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
  font-weight: 650;
}

.day-header__account-link {
  justify-content: center;
  width: var(--target-touch);
  height: var(--target-touch);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
}

.day-header__date-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

.day-header__date-trigger:hover {
  background: var(--color-surface-subtle);
  border-color: var(--color-secondary);
}

.day-header__date-trigger--open {
  background: var(--color-surface);
  border-color: var(--color-secondary);
  box-shadow: var(--shadow-card);
}

.day-header__date-trigger:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 1px;
}

.day-header__date-title {
  text-align: center;
}

.day-header__date-title p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  margin: 0;
}

.day-header__title-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.day-header__date-title :deep(h1) {
  font-size: var(--text-xs);
  margin: 0;
}

.day-header__calendar-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-content-secondary);
  transition: color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.day-header__date-trigger:hover .day-header__calendar-icon,
.day-header__calendar-icon--active {
  color: var(--color-primary);
  transform: scale(1.1);
}

.day-header__week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
  align-items: center;
}

.day-header__day-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-md);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  padding: 0 var(--space-1);
}

.day-header__day-chip--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.day-header__day-chip strong {
  font-size: var(--text-base);
}

@media (max-width: 639px) {
  .day-header {
    flex-direction: column;
  }
}
</style>
