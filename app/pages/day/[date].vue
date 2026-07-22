<template>
  <div class="day-page">
    <header class="day-page__header">
      <div class="day-page__topline">
        <NuxtLink to="/" class="day-page__app-link">
          <UiIcon name="i-lucide-layout-grid" class="h-4 w-4" />
          Apps
        </NuxtLink>
        <NuxtLink
          :to="accountLink"
          class="day-page__account-link"
          aria-label="Daily account settings"
        >
          <UiIcon name="i-lucide-user-round" class="h-5 w-5" />
        </NuxtLink>
      </div>

      <div class="day-page__date-nav">
        <UiIconButton
          icon="i-lucide-chevron-left"
          label="Previous day"
          @click="go(-1)"
        />
        <div class="day-page__date-title">
          <p>{{ eyebrow }}</p>
          <ui-title tag="h1">{{ dayTitle }}</ui-title>
        </div>
        <UiIconButton
          icon="i-lucide-chevron-right"
          label="Next day"
          @click="go(1)"
        />
      </div>

      <nav class="day-page__week" aria-label="Nearby days">
        <NuxtLink
          v-for="day in weekDays"
          :key="day.dateKey"
          :to="`/day/${day.dateKey}`"
          class="day-page__day-chip"
          :class="{ 'day-page__day-chip--active': day.dateKey === dateKey }"
          :aria-current="day.dateKey === dateKey ? 'date' : undefined"
        >
          <span>{{ day.weekday }}</span>
          <strong>{{ day.day }}</strong>
        </NuxtLink>
      </nav>
    </header>

    <UiAlert v-if="daily.error.value" tone="error" :title="daily.error.value" />

    <section class="day-page__section" aria-labelledby="actions-title">
      <div class="day-page__section-head">
        <div>
          <ui-title id="actions-title" tag="h2">Action items</ui-title>
          <p>{{ openCount }} open · {{ completedCount }} completed</p>
        </div>
        <UiButton icon="i-lucide-plus" size="sm" @click="actionSheetOpen = true"
          >Add</UiButton
        >
      </div>

      <div v-if="activeItems.length" class="action-list">
        <article
          v-for="item in activeItems"
          :key="item.occurrenceKey"
          class="action-row"
          :class="{
            'action-row--completed': item.occurrence?.status === 'COMPLETED',
          }"
        >
          <UiCheckbox
            :model-value="item.occurrence?.status === 'COMPLETED'"
            :aria-label="`Mark ${item.actionItem.title} complete`"
            @update:model-value="
              daily.setCompleted(dateKey, item, Boolean($event))
            "
          />
          <div class="action-row__main">
            <p class="action-row__title">{{ item.actionItem.title }}</p>
            <div class="action-row__meta">
              <UiPill
                v-if="timing(item)"
                size="sm"
                :label="timing(item)"
                :color="
                  isOverdue(item)
                    ? 'var(--color-error)'
                    : 'var(--color-content-secondary)'
                "
                variant="soft"
              />
              <span
                v-if="item.actionItem.recurrence"
                class="action-row__repeat"
              >
                <UiIcon name="i-lucide-repeat-2" class="h-3.5 w-3.5" />
                {{ repeatLabel(item) }}
              </span>
              <span v-if="isOverdue(item)" class="action-row__overdue"
                >Overdue</span
              >
            </div>
          </div>
          <UiIconButton
            icon="i-lucide-calendar-clock"
            label="Move action item"
            size="sm"
            @click="openMove(item)"
          />
        </article>
      </div>
      <UiEmptyState
        v-else-if="!daily.loadingDates.value[dateKey]"
        icon="i-lucide-list-checks"
        title="No action items"
        description="Plan something for this day, or leave it open."
      >
        <UiButton variant="soft" @click="actionSheetOpen = true"
          >Add an action</UiButton
        >
      </UiEmptyState>
      <UiSkeleton v-else class="h-24" />

      <div v-if="movedItems.length" class="moved-list">
        <p class="moved-list__label">Moved from this day</p>
        <div
          v-for="item in movedItems"
          :key="item.occurrenceKey"
          class="moved-row"
        >
          <span>{{ item.actionItem.title }}</span>
          <span
            >Moved to {{ formatShortDate(item.activePlacement!.dateKey) }}</span
          >
        </div>
      </div>
    </section>

    <section class="day-page__section" aria-labelledby="note-title">
      <div class="day-page__section-head">
        <div>
          <ui-title id="note-title" tag="h2">Daily note</ui-title>
          <p>One continuous note for this day</p>
        </div>
        <span class="day-page__save-state">{{ noteSaveState }}</span>
      </div>
      <DailyRichEditor
        :key="dateKey"
        :model-value="noteContent"
        @update:model-value="onNoteChange"
      />
    </section>

    <ActionItemSheet v-model:open="actionSheetOpen" :initial-date="dateKey" />
    <RescheduleActionSheet
      v-model:open="moveSheetOpen"
      :visible-date="dateKey"
      :item="movingItem"
    />
  </div>
</template>

<script setup lang="ts">
import type { DayItemDTO } from "@shared/utils/daily.contract";
import ActionItemSheet from "~/features/daily/components/ActionItemSheet.vue";
import DailyRichEditor from "~/features/daily/components/DailyRichEditor.vue";
import RescheduleActionSheet from "~/features/daily/components/RescheduleActionSheet.vue";
import { useDaily } from "~/features/daily/composables/useDaily";
import { registerDailyDraftFlusher } from "~/features/daily/composables/dailyEditorRuntimeState";
import { useDebounce } from "~/utils/debounce";
import {
  addDateKeyDays,
  dateKeyInTimeZone,
  formatDateKey,
  isDateKey,
  parseDateKey,
} from "@shared/utils/daily-recurrence";

definePageMeta({ middleware: "auth" });

const route = useRoute();
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
const noteContent = ref<unknown>({
  type: "doc",
  content: [{ type: "paragraph" }],
});
const noteSaveState = ref("Saved locally");
let pendingNote: { dateKey: string; content: unknown } | null = null;

async function commitPendingNote() {
  const change = pendingNote;
  pendingNote = null;
  if (!change) return;
  await daily.saveNote(change.dateKey, change.content).catch(() => undefined);
  noteSaveState.value = daily.isSyncing.value ? "Syncing…" : "Saved locally";
}
// 650ms trailing debounce, but never longer than 2s without a durable save —
// otherwise continuous typing with no pause could go unsaved indefinitely,
// same guarantee Notes' useNoteDraft.ts gives its own content debounce.
const { debouncedFunc: scheduleNoteSave, flush: flushNoteSave } = useDebounce(
  commitPendingNote,
  650,
  2000,
);
const unregisterDailyDraftFlusher = registerDailyDraftFlusher(() =>
  flushNoteSave(),
);
onScopeDispose(unregisterDailyDraftFlusher);

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
const completedCount = computed(
  () =>
    activeItems.value.filter((item) => item.occurrence?.status === "COMPLETED")
      .length,
);
const openCount = computed(
  () => activeItems.value.length - completedCount.value,
);

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
  },
  { immediate: true },
);

watch(
  () => projection.value?.note?.content,
  (value) => {
    if (value) noteContent.value = value;
    else noteContent.value = { type: "doc", content: [{ type: "paragraph" }] };
  },
  { immediate: true },
);

function go(amount: number) {
  return navigateTo(`/day/${addDateKeyDays(dateKey.value, amount)}`);
}

function onNoteChange(value: unknown) {
  noteContent.value = value;
  noteSaveState.value = "Saving locally…";
  pendingNote = { dateKey: dateKey.value, content: value };
  scheduleNoteSave();
}

function openMove(item: DayItemDTO) {
  movingItem.value = item;
  moveSheetOpen.value = true;
}

function effectivePlacement(item: DayItemDTO) {
  return item.activePlacement?.dateKey === dateKey.value
    ? item.activePlacement
    : null;
}

function timing(item: DayItemDTO) {
  const placement = effectivePlacement(item);
  const mode = placement?.timingMode ?? item.actionItem.timingMode;
  if (mode === "ALL_DAY") return "All day";
  return placement?.localTime ?? item.actionItem.localTime ?? "Timed";
}

function isOverdue(item: DayItemDTO) {
  if (item.occurrence?.status === "COMPLETED") return false;
  if (dateKey.value < today.value) return true;
  if (dateKey.value > today.value) return false;
  const placement = effectivePlacement(item);
  const mode = placement?.timingMode ?? item.actionItem.timingMode;
  if (mode === "ALL_DAY") return false;
  const localTime = placement?.localTime ?? item.actionItem.localTime;
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return Boolean(localTime && localTime < currentTime);
}

function repeatLabel(item: DayItemDTO) {
  const frequency = item.actionItem.recurrence?.frequency ?? "";
  return frequency.charAt(0) + frequency.slice(1).toLowerCase();
}

function formatShortDate(value: string) {
  return formatDateKey(value, undefined, { month: "short", day: "numeric" });
}

onBeforeUnmount(() => void flushNoteSave());
</script>

<style scoped>
.day-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  padding: var(--space-4) var(--space-4) var(--space-10);
}

.day-page__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.day-page__topline,
.day-page__date-nav,
.day-page__section-head,
.action-row,
.action-row__meta,
.moved-row {
  display: flex;
  align-items: center;
}

.day-page__topline,
.day-page__section-head {
  justify-content: space-between;
}

.day-page__app-link,
.day-page__account-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
  font-weight: 650;
}

.day-page__account-link {
  justify-content: center;
  width: var(--target-touch);
  height: var(--target-touch);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
}

.day-page__date-nav {
  justify-content: space-between;
}

.day-page__date-title {
  text-align: center;
}

.day-page__date-title p,
.day-page__section-head p,
.day-page__save-state {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.day-page__date-title h1 {
  font-size: var(--text-xl);
}

.day-page__week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
}

.day-page__day-chip {
  display: flex;
  min-height: 54px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-xl);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.day-page__day-chip--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.day-page__day-chip strong {
  font-size: var(--text-base);
}

.day-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.day-page__section-head h2 {
  font-size: var(--text-lg);
}

.action-list {
  overflow: hidden;
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--color-surface);
}

.action-row {
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-secondary);
}

.action-row:last-child {
  border-bottom: 0;
}

.action-row__main {
  min-width: 0;
  flex: 1;
}

.action-row__title {
  overflow: hidden;
  color: var(--color-content-on-surface);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-row--completed .action-row__title {
  color: var(--color-content-disabled);
  text-decoration: line-through;
}

.action-row__meta {
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.action-row__repeat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.action-row__overdue {
  color: var(--color-error);
  font-weight: 700;
}

.moved-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-left: 3px solid var(--color-secondary);
}

.moved-list__label {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
}

.moved-row {
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-content-disabled);
  font-size: var(--text-sm);
}
</style>
