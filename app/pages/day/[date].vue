<template>
  <div class="day-page">
    <DailyDateNavigation
      :active-date-key="dateKey"
      :eyebrow="eyebrow"
      :title="dayTitle"
      :days="weekDays"
      :account-link="accountLink"
      @navigate="go"
      @select-date="goDate"
    />

    <UiAlert v-if="daily.error.value" tone="error" :title="daily.error.value" />

    <DailyActionSection
      :date-key="dateKey"
      :items="activeActionModels"
      :moved-items="movedActionModels"
      :open-count="openCount"
      :completed-count="completedCount"
      :loading="Boolean(daily.loadingDates.value[dateKey])"
      :conflicts="actionConflicts"
      :occurrence-conflicts="occurrenceConflicts"
      :resolving-action-item-id="resolvingActionItemId"
      :resolving-occurrence-id="resolvingOccurrenceId"
      @toggle="toggleAction"
      @move="openMove"
      @resolve-conflict="resolveActionConflict"
      @resolve-occurrence-conflict="resolveOccurrenceConflict"
    />

    <DailyNoteSection
      :date-key="dateKey"
      :model-value="noteContent"
      :save-state="noteSaveState"
      :conflict="noteConflict"
      :sync-issue="noteSyncIssue"
      @update:model-value="onNoteChange"
      @blur="flushPendingSave()"
      @resolve="resolveNoteConflict"
    />

    <RescheduleActionSheet
      v-model:open="moveSheetOpen"
      :visible-date="dateKey"
      :item="movingItem"
    />
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
import DailyActionSection from "~/features/daily/components/DailyActionSection.vue";
import DailyDateNavigation from "~/features/daily/components/DailyDateNavigation.vue";
import DailyNoteSection from "~/features/daily/components/DailyNoteSection.vue";
import RescheduleActionSheet from "~/features/daily/components/RescheduleActionSheet.vue";
import { useDaily } from "~/features/daily/composables/useDaily";
import { useDailyNoteDraft } from "~/features/daily/composables/useDailyNoteDraft";
import type { DailyActionConflict } from "~/features/daily/repositories/dailyLocalRepository";
import type { DailyOccurrenceConflict } from "~/features/daily/repositories/dailyLocalRepository";
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
const moveSheetOpen = ref(false);
const movingItem = ref<DayItemDTO | null>(null);
const actionConflicts = ref<DailyActionConflict[]>([]);
const occurrenceConflicts = ref<DailyOccurrenceConflict[]>([]);
const resolvingActionItemId = ref<string | null>(null);
const resolvingOccurrenceId = ref<string | null>(null);
const onDailyLocalStateChanged = () => {
  void refreshActionConflicts();
};
onMounted(() => {
  window.addEventListener(
    "daily-local-state-changed",
    onDailyLocalStateChanged,
  );
});
onBeforeUnmount(() => {
  window.removeEventListener(
    "daily-local-state-changed",
    onDailyLocalStateChanged,
  );
});

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
  noteSyncIssue,
  noteSaveState,
  onNoteChange,
  flushPendingSave,
  resolveNoteConflict,
} = useDailyNoteDraft({
  dateKey,
  projectedContent: computed(() => projection.value?.note?.content),
});

async function ensureDraftDurableBeforeNavigation() {
  try {
    await flushPendingSave(dateKey.value, true);
    return true;
  } catch (saveError) {
    toast.add({
      title: "Note wasn’t saved locally",
      description:
        saveError instanceof Error
          ? saveError.message
          : "Stay on this day and try again.",
      color: "error",
    });
    return false;
  }
}

onBeforeRouteUpdate(ensureDraftDurableBeforeNavigation);
onBeforeRouteLeave(ensureDraftDurableBeforeNavigation);

const dayTitle = computed(() =>
  formatDateKey(dateKey.value, undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }),
);
const eyebrow = computed(() => {
  if (dateKey.value === today.value) return "Today";
  if (dateKey.value === addDateKeyDays(today.value, 1)) return "Tomorrow";
  if (dateKey.value === addDateKeyDays(today.value, -1)) return "Yesterday";
  return formatDateKey(dateKey.value, undefined, { year: "numeric" });
});
// The dial's 91-day window recentres on every navigation, so each one rebuilt
// and re-formatted all 91 chips. `toLocaleDateString` is expensive enough that
// ~180 calls per dial tick is felt on a phone — and consecutive windows share
// 90 of their 91 days, so caching per date key turns nearly all of it into
// lookups. Lives in setup (not module scope) so it dies with the page.
const dayChipCache = new Map<
  string,
  { dateKey: string; weekday: string; day: number; label: string }
>();
const DAY_CHIP_CACHE_LIMIT = 400;

function dayChip(key: string) {
  const cached = dayChipCache.get(key);
  if (cached) return cached;

  const value = parseDateKey(key)!;
  const chip = {
    dateKey: key,
    weekday: formatDateKey(key, undefined, { weekday: "narrow" }),
    day: value.getUTCDate(),
    // A screen reader announcing "M 3" is useless; the dial reads this instead.
    label: formatDateKey(key, undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };

  if (dayChipCache.size >= DAY_CHIP_CACHE_LIMIT) dayChipCache.clear();
  dayChipCache.set(key, chip);
  return chip;
}

const weekDays = computed(() => {
  const anchor = dateKey.value;
  return Array.from({ length: 91 }, (_, index) =>
    dayChip(addDateKeyDays(anchor, index - 45)),
  );
});
const accountLink = computed(() => ({
  path: "/account",
  query: { app: "daily", returnTo: `/day/${dateKey.value}` },
}));

watch(
  [routeDateKey, () => daily.accountId.value],
  async ([value, currentAccountId]) => {
    if (!isDateKey(value)) {
      await navigateTo(`/day/${today.value}`, { replace: true });
      return;
    }
    if (!currentAccountId) return;
    await daily.loadDay(value);
    await refreshActionConflicts();
    daily.prefetchAdjacentDays(value);
  },
  { immediate: true },
);

watch(
  () => daily.isSyncing.value,
  (isSyncing, wasSyncing) => {
    if (wasSyncing && !isSyncing) void refreshActionConflicts();
  },
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

async function toggleAction(occurrenceKey: string, completed: boolean) {
  const item = itemByOccurrenceKey(occurrenceKey);
  if (!item) return;
  try {
    await daily.setCompleted(dateKey.value, item, completed);
  } catch (toggleError) {
    toast.add({
      title: "Couldn’t save action state",
      description:
        toggleError instanceof Error
          ? toggleError.message
          : "Your previous state was kept.",
      color: "error",
    });
  }
}

function openMove(occurrenceKey: string) {
  const item = itemByOccurrenceKey(occurrenceKey);
  if (!item) return;
  movingItem.value = item;
  moveSheetOpen.value = true;
}

async function refreshActionConflicts() {
  const itemIds = new Set(
    (projection.value?.items ?? []).map((item) => item.actionItem.id),
  );
  const occurrenceKeys = new Set(
    (projection.value?.items ?? []).map((item) => item.occurrenceKey),
  );
  const [actions, occurrences] = await Promise.all([
    daily.getActionConflicts(),
    daily.getOccurrenceConflicts(),
  ]);
  actionConflicts.value = actions.filter((conflict) =>
    itemIds.has(conflict.actionItemId),
  );
  occurrenceConflicts.value = occurrences.filter((conflict) =>
    occurrenceKeys.has(conflict.occurrenceKey),
  );
}

async function resolveActionConflict(payload: {
  actionItemId: string;
  strategy: "keep-local" | "keep-server";
}) {
  if (resolvingActionItemId.value) return;
  resolvingActionItemId.value = payload.actionItemId;
  try {
    const synced = await daily.resolveActionConflict(
      dateKey.value,
      payload.actionItemId,
      payload.strategy,
    );
    await refreshActionConflicts();
    const stillConflicted = actionConflicts.value.some(
      (conflict) => conflict.actionItemId === payload.actionItemId,
    );
    toast.add({
      title: stillConflicted
        ? "Server changed again — review latest versions"
        : payload.strategy === "keep-server"
          ? "Server version restored"
          : synced
            ? "Your action item was synced"
            : "Your choice was saved and will sync when connected",
      color: stillConflicted ? "warning" : "success",
    });
  } catch (resolveError) {
    toast.add({
      title: "Couldn’t resolve action item",
      description:
        resolveError instanceof Error
          ? resolveError.message
          : "Try again while connected.",
      color: "error",
    });
    await refreshActionConflicts();
  } finally {
    resolvingActionItemId.value = null;
  }
}

async function resolveOccurrenceConflict(payload: {
  occurrenceId: string;
  strategy: "keep-local" | "keep-server";
}) {
  if (resolvingOccurrenceId.value) return;
  resolvingOccurrenceId.value = payload.occurrenceId;
  try {
    const synced = await daily.resolveOccurrenceConflict(
      dateKey.value,
      payload.occurrenceId,
      payload.strategy,
    );
    await refreshActionConflicts();
    const stillConflicted = occurrenceConflicts.value.some(
      (conflict) => conflict.occurrenceId === payload.occurrenceId,
    );
    toast.add({
      title: stillConflicted
        ? "Server changed again — review latest versions"
        : payload.strategy === "keep-server"
          ? "Server occurrence restored"
          : synced
            ? "Your occurrence was synced"
            : "Your choice was saved and will sync when connected",
      color: stillConflicted ? "warning" : "success",
    });
  } catch (resolveError) {
    toast.add({
      title: "Couldn’t resolve action occurrence",
      description:
        resolveError instanceof Error
          ? resolveError.message
          : "Try again while connected.",
      color: "error",
    });
    await refreshActionConflicts();
  } finally {
    resolvingOccurrenceId.value = null;
  }
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
