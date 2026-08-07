<template>
  <form
    class="row-edit"
    :aria-label="`Edit ${item.title}`"
    @submit.prevent="save"
    @keydown.esc.prevent="emit('cancel')"
  >
    <div ref="reflowEl" class="row-edit__line">
      <div class="row-edit__content">
        <!-- Present but inert: it holds the title input on the same left edge
        as every other row's title, which is what makes the swap read as the
        row changing rather than a panel replacing it. Completion is a separate
        action from editing, so it stays out of the draft. -->
        <UiCheckbox
          :model-value="item.completed"
          disabled
          :aria-label="`${item.title} is ${item.completed ? 'complete' : 'open'} — finish editing to change`"
        />
        <UiInput
          ref="titleEl"
          v-model="title"
          class="row-edit__title"
          aria-label="Action item title"
          autocomplete="off"
          size="sm"
        />
      </div>

      <div class="row-edit__actions">
        <!-- The stacked form's 130px segmented control does not belong in a
        row. Two states need one control: the icon shows what the item *is*,
        and pressing it switches. -->
        <UiIconButton
          type="button"
          :icon="timingMode === 'TIMED' ? 'clock-3' : 'sun'"
          :label="
            timingMode === 'TIMED'
              ? 'Timed — switch to all day'
              : 'All day — set a time'
          "
          :pressed="timingMode === 'TIMED'"
          size="sm"
          @click="toggleTiming"
        />

        <Transition name="time-slide">
          <div v-if="timingMode === 'TIMED'" class="time-slide">
            <div class="time-slide__inner">
              <div class="time-slide__content">
                <UiInput
                  v-model="localTime"
                  class="row-edit__time"
                  aria-label="Action time"
                  type="time"
                  size="xs"
                  required
                />
              </div>
            </div>
          </div>
        </Transition>

        <UiSelect
          v-model="frequency"
          class="row-edit__repeat"
          aria-label="Repeat"
          size="xs"
          :items="repeatOptions"
          value-key="value"
          label-key="label"
        />

        <UiIconButton
          type="submit"
          icon="check"
          label="Save changes"
          tone="primary"
          variant="soft"
          size="sm"
          :loading="saving"
          :disabled="!title.trim()"
        />
        <UiIconButton
          type="button"
          icon="x"
          label="Cancel edit"
          size="sm"
          @click="emit('cancel')"
        />
      </div>
    </div>

    <UiAlert v-if="error" tone="error" :title="error" />
  </form>
</template>

<script setup lang="ts">
/**
 * Inline editor that takes over an action row in place.
 *
 * Deliberately mirrors DailyActionRow's geometry — same padding, same bottom
 * border, checkbox then title on the left, controls on the right — so entering
 * edit reads as the row's own affordances switching rather than a form
 * replacing it. The stacked ActionItemQuickAddForm stays as-is for quick-add,
 * where there is no row to preserve.
 */
import {
  buildRecurrenceRule,
  type RecurrenceChoice,
} from "../domain/actionItemMutation";
import type { DailyActionViewModel } from "../presentation/dailyActionViewModel";
import { useDaily } from "../composables/useDaily";
import { useReflowEase } from "../composables/useReflowEase";
import UiIconButton from "~/components/ui/UiIconButton.vue";

const props = defineProps<{
  dateKey: string;
  item: DailyActionViewModel;
}>();
const emit = defineEmits<{ cancel: []; saved: [] }>();

const DEFAULT_TIME = "09:00";

const daily = useDaily();
const titleEl = ref<{ $el?: HTMLElement } | null>(null);
const title = ref(props.item.title);
const timingMode = ref<"ALL_DAY" | "TIMED">(props.item.timingMode);
const localTime = ref(props.item.localTime ?? DEFAULT_TIME);
const frequency = ref<RecurrenceChoice>(
  props.item.recurrence?.frequency ?? "NONE",
);
const saving = ref(false);
const error = ref<string | null>(null);

// Short labels: the stacked form can afford "No repeat", a row cannot.
const repeatOptions = [
  { value: "NONE", label: "Once" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
] as const;

/** Adding the time field can push the controls onto a second line on narrow
 * screens; ease that rather than letting the row jump a whole line. */
const { reflowEl, easeReflow } = useReflowEase();

function toggleTiming() {
  void easeReflow();
  timingMode.value = timingMode.value === "TIMED" ? "ALL_DAY" : "TIMED";
}

async function save() {
  const value = title.value.trim();
  if (!value || saving.value) return;

  saving.value = true;
  error.value = null;
  try {
    await daily.updateAction({
      id: props.item.actionItemId,
      visibleDateKey: props.dateKey,
      title: value,
      timingMode: timingMode.value,
      localTime: timingMode.value === "TIMED" ? localTime.value : null,
      timezone:
        props.item.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence: buildRecurrenceRule({
        frequency: frequency.value,
        startDate: props.item.startDate,
        existing: props.item.recurrence ?? null,
      }),
      placementId: props.item.activePlacementId,
    });
    emit("saved");
  } catch (saveError) {
    error.value =
      saveError instanceof Error ? saveError.message : "Unable to save action";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  // Select rather than just focus: the row was opened on an item that already
  // has a title, so the common intent is to replace it, not append to it.
  nextTick(() => {
    const input = titleEl.value?.$el?.querySelector?.("input");
    input?.focus();
    input?.select();
  });
});
</script>

<style scoped>
/* Geometry copied from DailyActionRow on purpose — padding, border and the
   content/actions split have to match or the swap shifts the list. */
.row-edit__line,
.row-edit__content,
.row-edit__actions {
  display: flex;
  align-items: center;
}

.row-edit__line {
  gap: var(--space-3);
  justify-content: space-between;
  flex-wrap: wrap;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-secondary);
}

.row-edit__content {
  gap: var(--space-3);
  flex: 2 1 12rem;
  min-width: 0;
}

.row-edit__title {
  min-width: 0;
  flex: 1;
}

.row-edit__actions {
  gap: var(--space-1);
  flex: 0 1 auto;
}

.row-edit__time {
  width: 7rem;
}

.row-edit__repeat {
  width: 7.5rem;
}

/* Horizontal collapse, same three rules as the stacked form: an `fr` track so
   the width animates and the controls beside it are pushed rather than
   jumping, `min-width: 0` so the track can shrink under its content, and the
   parent gap cancelled by a negative margin then reinstated as padding one
   level in — on `__content`, never on the clipped `__inner`, or the box floors
   at the padding and drops it in a single frame on unmount. */
.time-slide {
  display: grid;
  grid-template-columns: 1fr;
  margin-inline-start: calc(-1 * var(--space-1));
}

.time-slide__inner {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.time-slide__content {
  padding-inline-start: var(--space-1);
}

.time-slide-enter-active {
  transition:
    grid-template-columns var(--duration-normal) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard) 40ms;
}

.time-slide-enter-active .time-slide__content {
  transition: transform var(--duration-normal) var(--ease-standard);
}

.time-slide-leave-active {
  transition:
    grid-template-columns var(--duration-normal) var(--ease-exit),
    opacity var(--duration-fast) var(--ease-exit);
}

.time-slide-leave-active .time-slide__content {
  transition: transform var(--duration-normal) var(--ease-exit);
}

.time-slide-enter-from,
.time-slide-leave-to {
  grid-template-columns: 0fr;
  opacity: 0;
}

.time-slide-enter-from .time-slide__content,
.time-slide-leave-to .time-slide__content {
  transform: translateX(-0.5rem);
}

@media (max-width: 30rem) {
  .row-edit__content {
    flex-basis: 100%;
  }

  .row-edit__actions {
    flex: 1 1 auto;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .time-slide-enter-active,
  .time-slide-leave-active,
  .time-slide-enter-active .time-slide__content,
  .time-slide-leave-active .time-slide__content {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }
}
</style>
