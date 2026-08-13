<template>
  <div class="day-page">
    <DailyDateNavigation
      :active-date-key="dateKey"
      :today-date-key="today"
      :eyebrow="eyebrow"
      :title="dayTitle"
      :days="weekDays"
      :account-link="accountLink"
      :needs-attention="showDayRolloverNotice"
      @navigate="go"
      @select-date="goDate"
    />

    <UiAlert
      v-if="showDayRolloverNotice"
      tone="warning"
      variant="soft"
      icon="calendar"
      title="A new day has started"
      :description="dayRolloverDescription"
      role="status"
    >
      <template #actions>
        <UiButton size="xs" tone="primary" variant="solid" @click="goToToday">
          Go to today
        </UiButton>
        <UiButton
          size="xs"
          tone="neutral"
          variant="ghost"
          @click="dismissDayRolloverNotice"
        >
          Stay here
        </UiButton>
      </template>
    </UiAlert>

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
      @remove="openDelete"
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
    <DeleteActionItemDialog
      v-model:open="deleteDialogOpen"
      :title="deletingItem?.actionItem.title ?? ''"
      :repeating="Boolean(deletingItem?.actionItem.recurrence)"
      :loading="deleteSaving"
      @delete-occurrence="performDelete('occurrence')"
      @delete-series="performDelete('series')"
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
import DeleteActionItemDialog from "~/features/daily/components/DeleteActionItemDialog.vue";
import DailyNoteSection from "~/features/daily/components/DailyNoteSection.vue";
import RescheduleActionSheet from "~/features/daily/components/RescheduleActionSheet.vue";
import { useDaily } from "~/features/daily/composables/useDaily";
import { useDailyNoteDraft } from "~/features/daily/composables/useDailyNoteDraft";
import type { DailyActionConflict } from "~/features/daily/repositories/dailyLocalRepository";
import type { DailyOccurrenceConflict } from "~/features/daily/repositories/dailyLocalRepository";
import { toDailyActionViewModel } from "~/features/daily/presentation/dailyActionViewModel";
import { shouldShowDayRolloverAttention } from "~/features/daily/presentation/dayRolloverAttention";

definePageMeta({ middleware: "auth" });

const route = useRoute();
const toast = useToast();
const daily = useDaily();
const routeDateKey = computed(() => String(route.params.date));
const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";
const currentInstant = ref(new Date());
const today = computed(() => dateKeyInTimeZone(currentInstant.value, timeZone));
const dateKey = computed(() =>
  isDateKey(routeDateKey.value) ? routeDateKey.value : today.value,
);
const showDayRolloverNotice = ref(false);
const projection = computed(() => daily.projections.value[dateKey.value]);
const moveSheetOpen = ref(false);
const movingItem = ref<DayItemDTO | null>(null);
const deleteDialogOpen = ref(false);
const deletingItem = ref<DayItemDTO | null>(null);
const deleteSaving = ref(false);
const actionConflicts = ref<DailyActionConflict[]>([]);
const occurrenceConflicts = ref<DailyOccurrenceConflict[]>([]);

/** Assign only when the contents actually differ, so a recomputed-but-identical
 * list doesn't churn prop identity and re-render everything downstream. */
function publishIfChanged<T>(target: Ref<T[]>, next: T[]) {
  if (target.value.length === next.length) {
    if (!next.length) return;
    if (JSON.stringify(target.value) === JSON.stringify(next)) return;
  }
  target.value = next;
}
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
    (item) =>
      item.occurrence?.status !== "CANCELLED" &&
      (item.activePlacement?.dateKey === dateKey.value || item.virtual),
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

const dayRolloverDescription = computed(() => {
  const viewedLabel = formatDateKey(dateKey.value, undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const todayLabel = formatDateKey(today.value, undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return `You're viewing ${viewedLabel}. Today is ${todayLabel}.`;
});

function refreshCurrentDay() {
  const previousTodayKey = today.value;
  currentInstant.value = new Date();
  const currentTodayKey = today.value;

  if (
    shouldShowDayRolloverAttention({
      previousTodayKey,
      currentTodayKey,
      visibleDateKey: dateKey.value,
    })
  ) {
    showDayRolloverNotice.value = true;
  }
}

function onVisibilityChange() {
  if (!document.hidden) refreshCurrentDay();
}

let currentDayInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  window.addEventListener("focus", refreshCurrentDay);
  document.addEventListener("visibilitychange", onVisibilityChange);
  currentDayInterval = setInterval(() => {
    if (!document.hidden) refreshCurrentDay();
  }, 60_000);
});

onBeforeUnmount(() => {
  window.removeEventListener("focus", refreshCurrentDay);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (currentDayInterval !== null) clearInterval(currentDayInterval);
});

watch(dateKey, () => {
  showDayRolloverNotice.value = false;
});

function dismissDayRolloverNotice() {
  showDayRolloverNotice.value = false;
}

function goToToday() {
  return navigateTo(`/day/${today.value}`);
}

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

function openDelete(occurrenceKey: string) {
  const item = itemByOccurrenceKey(occurrenceKey);
  if (!item) return;
  deletingItem.value = item;
  deleteDialogOpen.value = true;
}

async function undoActionDelete(input: {
  scope: "occurrence" | "series";
  actionItemId: string;
  occurrenceKey: string;
  visibleDateKey: string;
}) {
  try {
    if (input.scope === "occurrence") {
      await daily.restoreOccurrence(input.visibleDateKey, input.occurrenceKey);
    } else {
      await daily.restoreAction(input.visibleDateKey, input.actionItemId);
    }
    toast.add({ title: "Action item restored", color: "success" });
  } catch (undoError) {
    toast.add({
      title: "Couldn’t restore action item",
      description:
        undoError instanceof Error ? undoError.message : "Try again.",
      color: "error",
    });
  }
}

async function performDelete(scope: "occurrence" | "series") {
  const item = deletingItem.value;
  if (!item || deleteSaving.value) return;
  deleteSaving.value = true;
  const visibleDateKey = dateKey.value;
  try {
    if (scope === "occurrence" && item.actionItem.recurrence) {
      await daily.cancelOccurrence(visibleDateKey, item);
    } else {
      scope = "series";
      await daily.archiveAction(visibleDateKey, item.actionItem.id);
    }
    deleteDialogOpen.value = false;
    const undoInput = {
      scope,
      actionItemId: item.actionItem.id,
      occurrenceKey: item.occurrenceKey,
      visibleDateKey,
    } as const;
    toast.add({
      title:
        scope === "occurrence"
          ? "Occurrence removed"
          : item.actionItem.recurrence
            ? "Repeating series removed"
            : "Action item removed",
      description: "History was preserved.",
      color: "neutral",
      actions: [
        {
          label: "Undo",
          onClick: () => undoActionDelete(undoInput),
        },
      ],
    });
  } catch (deleteError) {
    toast.add({
      title: "Couldn’t remove action item",
      description:
        deleteError instanceof Error ? deleteError.message : "Try again.",
      color: "error",
    });
  } finally {
    deleteSaving.value = false;
  }
}

async function refreshActionConflicts() {
  const itemIds = new Set(
    (projection.value?.actionItems ?? []).map((item) => item.id),
  );
  const occurrenceKeys = new Set(
    (projection.value?.items ?? []).map((item) => item.occurrenceKey),
  );
  const [actions, occurrences] = await Promise.all([
    daily.getActionConflicts(),
    daily.getOccurrenceConflicts(),
  ]);
  // This runs after every sync, and on almost every day both lists are empty.
  // Assigning a fresh [] over an existing [] still changes the prop identity,
  // which re-renders every action row — so only publish a real change.
  publishIfChanged(
    actionConflicts,
    actions.filter((conflict) => itemIds.has(conflict.actionItemId)),
  );
  publishIfChanged(
    occurrenceConflicts,
    occurrences.filter((conflict) => {
      if (occurrenceKeys.has(conflict.occurrenceKey)) return true;
      const localDate = String(conflict.localOccurrence.originalDateKey ?? "");
      const serverDate = String(
        conflict.serverOccurrence.originalDateKey ?? "",
      );
      const localPlacementDate = String(conflict.localPlacement?.dateKey ?? "");
      const serverPlacementDate = String(
        conflict.serverPlacement?.dateKey ?? "",
      );
      return [
        localDate,
        serverDate,
        localPlacementDate,
        serverPlacementDate,
      ].includes(dateKey.value);
    }),
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
  /* padding-bottom: var(--space-6); */
  /* Exactly fill .ds-shell__main: grow into leftover height AND shrink to it.
     min-height:0 lifts the content floor (min-height:auto) so shrink can win;
     overflow-y makes overflowing content scroll inside this box, not the page. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
</style>
