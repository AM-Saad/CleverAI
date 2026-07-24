<template>
  <div class="day-page">
    <DailyDateNavigation :active-date-key="dateKey" :eyebrow="eyebrow" :title="dayTitle" :days="weekDays"
      :account-link="accountLink" @navigate="go" @select-date="goDate" />

    <UiAlert v-if="daily.error.value" tone="error" :title="daily.error.value" />

    <DailyActionSection :items="activeActionModels" :moved-items="movedActionModels" :open-count="openCount"
      :completed-count="completedCount" :loading="Boolean(daily.loadingDates.value[dateKey])"
      @add="actionSheetOpen = true" @toggle="toggleAction" @move="openMove" />

    <DailyNoteSection :date-key="dateKey" :model-value="noteContent" :save-state="noteSaveState"
      :conflict="noteConflict" @update:model-value="onNoteChange" @blur="flushPendingSave()"
      @resolve="resolveNoteConflict" />

    <ActionItemSheet v-model:open="actionSheetOpen" :initial-date="dateKey" />
    <RescheduleActionSheet v-model:open="moveSheetOpen" :visible-date="dateKey" :item="movingItem" />
  </div>
</template>

<script setup lang="ts">
import type { DayItemDTO } from "@shared/utils/daily.contract";
import {
  addDateKeyDays,
  dateKeyInTimeZone,
  formatDateKey,
  isDateKey,
  parseDateKey,
} from "@shared/utils/daily-recurrence";
import ActionItemSheet from "~/features/daily/components/ActionItemSheet.vue";
import DailyActionSection from "~/features/daily/components/DailyActionSection.vue";
import DailyDateNavigation from "~/features/daily/components/DailyDateNavigation.vue";
import DailyNoteSection from "~/features/daily/components/DailyNoteSection.vue";
import RescheduleActionSheet from "~/features/daily/components/RescheduleActionSheet.vue";
import { useDaily } from "~/features/daily/composables/useDaily";
import { useDailyNoteDraft } from "~/features/daily/composables/useDailyNoteDraft";
import { toDailyActionViewModel } from "~/features/daily/presentation/dailyActionViewModel";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const toast = useToast();
const daily = useDaily();
const routeDateKey = computed(() => String(route.params.date));
const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";
const today = computed(() => dateKeyInTimeZone(new Date(), timeZone));
const dateKey = computed(() =>
  isDateKey(routeDateKey.value) ? routeDateKey.value : today.value,
);
const projection = computed(() => daily.projections.value[dateKey.value]);
const actionSheetOpen = ref(false);
const moveSheetOpen = ref(false);
const movingItem = ref<DayItemDTO | null>(null);

const activeItems = computed(() =>
  (projection.value?.items ?? []).filter(
    (item) => item.activePlacement?.dateKey === dateKey.value || item.virtual,
  ),
);
const movedItems = computed(() =>
  (projection.value?.items ?? []).filter(
    (item) =>
      item.historyPlacement?.dateKey === dateKey.value &&
      item.activePlacement?.dateKey !== dateKey.value,
  ),
);
const activeActionModels = computed(() =>
  activeItems.value.map((item) =>
    toDailyActionViewModel(item, dateKey.value, today.value),
  ),
);
const movedActionModels = computed(() =>
  movedItems.value.map((item) =>
    toDailyActionViewModel(item, dateKey.value, today.value),
  ),
);
const completedCount = computed(
  () => activeActionModels.value.filter((item) => item.completed).length,
);
const openCount = computed(
  () => activeActionModels.value.length - completedCount.value,
);

const {
  noteContent,
  noteConflict,
  noteSaveState,
  onNoteChange,
  flushPendingSave,
  resolveNoteConflict,
} = useDailyNoteDraft({
  dateKey,
  projectedContent: computed(() => projection.value?.note?.content),
});

const dayTitle = computed(() =>
  formatDateKey(dateKey.value, undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }),
);
const eyebrow = computed(() => {
  if (dateKey.value === today.value) return "Today";
  if (dateKey.value === addDateKeyDays(today.value, 1)) return "Tomorrow";
  if (dateKey.value === addDateKeyDays(today.value, -1)) return "Yesterday";
  return formatDateKey(dateKey.value, undefined, { year: "numeric" });
});
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const key = addDateKeyDays(dateKey.value, index - 3);
    const value = parseDateKey(key)!;
    return {
      dateKey: key,
      weekday: formatDateKey(key, undefined, { weekday: "narrow" }),
      day: value.getUTCDate(),
    };
  }),
);
const accountLink = computed(() => ({
  path: "/account",
  query: { app: "daily", returnTo: `/day/${dateKey.value}` },
}));

watch(
  routeDateKey,
  async (value) => {
    if (!isDateKey(value)) {
      await navigateTo(`/day/${today.value}`, { replace: true });
      return;
    }
    await daily.loadDay(value);
    daily.prefetchAdjacentDays(value);
  },
  { immediate: true },
);

// Share-target's "Add to Today's Plan" lands here as ?addTask=; materialize it
// once the account is known, then drop the param so it can't replay.
const lastAddTaskToken = ref("");
async function consumeAddTaskRoute() {
  const raw = route.query.addTask;
  const title = String(Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
  if (!title || !daily.accountId.value) return;
  const token = `${title}:${dateKey.value}`;
  if (lastAddTaskToken.value === token) return;
  lastAddTaskToken.value = token;
  await daily.createAction({
    title,
    dateKey: dateKey.value,
    timingMode: "ALL_DAY",
  });
  toast.add({ title: "Added to today's plan", color: "success" });
  const { addTask: _addTask, ...query } = route.query;
  void _addTask;
  await navigateTo({ path: route.path, query }, { replace: true });
}
watch(
  [() => route.query.addTask, () => daily.accountId.value, dateKey],
  () => {
    void consumeAddTaskRoute();
  },
  { immediate: true },
);

function go(amount: number) {
  return navigateTo(`/day/${addDateKeyDays(dateKey.value, amount)}`);
}

function goDate(targetDateKey: string) {
  return navigateTo(`/day/${targetDateKey}`);
}

function itemByOccurrenceKey(occurrenceKey: string) {
  return (
    activeItems.value.find((item) => item.occurrenceKey === occurrenceKey) ??
    null
  );
}

function toggleAction(occurrenceKey: string, completed: boolean) {
  const item = itemByOccurrenceKey(occurrenceKey);
  if (item) void daily.setCompleted(dateKey.value, item, completed);
}

function openMove(occurrenceKey: string) {
  const item = itemByOccurrenceKey(occurrenceKey);
  if (!item) return;
  movingItem.value = item;
  moveSheetOpen.value = true;
}
</script>

<style scoped>
.day-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-bottom: var(--space-6);
  /* Exactly fill .ds-shell__main: grow into leftover height AND shrink to it.
     min-height:0 lifts the content floor (min-height:auto) so shrink can win;
     overflow-y makes overflowing content scroll inside this box, not the page. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>
