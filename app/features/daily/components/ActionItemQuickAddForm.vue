<template>
  <form class="inline-action" aria-label="Quick add action item" @submit.prevent="submit"
    @keydown.esc.prevent="emit('cancel')">
    <div class="inline-action__main">
      <!-- Deliberately not disabled while saving: the commit is local and
      near-instant, and toggling `disabled` mid-save yanks focus (and drops IME
      composition) right as the user starts the next item. `saving` still guards
      re-entry in submit(). -->
      <SmartActionInput ref="titleEl" v-model="title" :tokens="parsed.tokens" aria-label="Action item title"
        placeholder="What needs to happen?" />
      <UiButton type="submit" icon="plus" size="lg" :loading="saving"
        :disabled="!parsed.title.trim() || parsed.issues.length > 0">
        Add
      </UiButton>
    </div>

    <div v-if="parsed.tokens.length" class="inline-action__interpretation" aria-live="polite">
      <UiIcon name="calendar-clock" size="14px" />
      <span>{{ previewSummary }}</span>
      <span v-if="parsed.issues.length" class="inline-action__warning">
        {{ parsed.issues.join(" · ") }}
      </span>
      <span class="inline-action__explain">Hover highlighted text for details</span>
    </div>

    <!-- Timing and repeat stay out of the way until there is something to apply
    them to. An empty field has no options worth showing, and collapsing them
    back after each add is what lets submit() reset them to defaults without
    hiding state the user can't see (see resetDraft). -->
    <Transition name="reveal">
      <div v-if="optionsVisible" class="reveal">
        <div class="reveal__inner">
          <div ref="optionsEl" class="inline-action__options">
            <UiSegmentedControl :model-value="timingMode" label="Action timing" :items="timingOptions"
              @update:model-value="setTimingMode" />
            <!-- Same collapse as the options panel, turned on its side: the
            track width animates so the repeat select is pushed across rather
            than teleporting, and the gap rides inside the clip so it can't
            step out at the end. -->
            <Transition name="time-slide">
              <div v-if="timingMode === 'TIMED'" class="time-slide">
                <div class="time-slide__inner">
                  <div class="time-slide__content">
                    <UiInput :model-value="localTime" class="inline-action__time" aria-label="Action time" type="time"
                      size="xs" required @update:model-value="setLocalTime" />
                  </div>
                </div>
              </div>
            </Transition>
            <UiSelect :model-value="frequency" class="inline-action__repeat" aria-label="Repeat" size="sm"
              :items="repeatOptions" value-key="value" label-key="label" @update:model-value="setFrequency" />
            <span class="inline-action__tail">
              <UiParagraph size="xs" color="content-secondary" class="inline-action__hint">
                Enter adds · Esc closes
              </UiParagraph>
              <!-- <UiIconButton type="button" icon="x" label="Close quick add" size="sm" @click="emit('cancel')" /> -->
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <UiAlert v-if="error" tone="error" :title="error" />
  </form>
</template>

<script setup lang="ts">
import type { RecurrenceRuleDTO } from "@shared/utils/daily.contract";
import { formatDateKey } from "@shared/utils/daily-recurrence";
import {
  buildRecurrenceRule,
  type RecurrenceChoice,
} from "../domain/actionItemMutation";
import { parseActionInput } from "../domain/parseActionInput";
import { useDaily } from "../composables/useDaily";
import { useReflowEase } from "../composables/useReflowEase";
import SmartActionInput from "./SmartActionInput.vue";

const props = defineProps<{ dateKey: string }>();
const emit = defineEmits<{
  cancel: [];
  saved: [];
}>();

const DEFAULT_TIME = "09:00";

const daily = useDaily();
const toast = useToast();
const titleEl = ref<InstanceType<typeof SmartActionInput> | null>(null);
const title = ref("");
const timingMode = ref<"ALL_DAY" | "TIMED">("ALL_DAY");
const localTime = ref(DEFAULT_TIME);
const frequency = ref<RecurrenceChoice>("NONE");
const timingTouched = ref(false);
const recurrenceTouched = ref(false);
const draftReference = ref(new Date());
const draftTimeZone = ref(
  import.meta.client ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
);
const saving = ref(false);
const error = ref<string | null>(null);

const parsed = computed(() =>
  parseActionInput(title.value, {
    referenceInstant: draftReference.value,
    timeZone: draftTimeZone.value,
    selectedDateKey: props.dateKey,
  }),
);

/** Options appear once there is a title to apply them to. */
const optionsVisible = computed(() => Boolean(title.value.trim()));

type ActionDraft = {
  title: string;
  timingMode: "ALL_DAY" | "TIMED";
  localTime: string;
  frequency: RecurrenceChoice;
  timingTouched: boolean;
  recurrenceTouched: boolean;
  reference: Date;
  timeZone: string;
};

const readDraft = (): ActionDraft => ({
  title: title.value,
  timingMode: timingMode.value,
  localTime: localTime.value,
  frequency: frequency.value,
  timingTouched: timingTouched.value,
  recurrenceTouched: recurrenceTouched.value,
  reference: draftReference.value,
  timeZone: draftTimeZone.value,
});

function writeDraft(draft: ActionDraft) {
  title.value = draft.title;
  timingMode.value = draft.timingMode;
  localTime.value = draft.localTime;
  frequency.value = draft.frequency;
  timingTouched.value = draft.timingTouched;
  recurrenceTouched.value = draft.recurrenceTouched;
  draftReference.value = draft.reference;
  draftTimeZone.value = draft.timeZone;
}

/** Back to a clean slate between quick-adds.
 *
 * Timing and repeat have to reset along with the title, not just the title:
 * the options row collapses once the field empties, so anything left set here
 * would silently apply to the next item from behind a collapsed panel — add one
 * "Daily" item and every later one inherits it without showing that anywhere. */
function resetDraft() {
  writeDraft({
    title: "",
    timingMode: "ALL_DAY",
    localTime: DEFAULT_TIME,
    frequency: "NONE",
    timingTouched: false,
    recurrenceTouched: false,
    reference: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

/** Narrow screens can't fit segmented + time + repeat + close on one line, so
 * turning on TIMED pushes repeat/close to a second line. Keeping the row
 * compact in ALL_DAY makes that reflow unavoidable; this eases it instead of
 * letting the panel gain a whole line in one frame. */
const { reflowEl: optionsEl, easeReflow } = useReflowEase();
watch(timingMode, easeReflow);

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
  nextTick(() => titleEl.value?.focus());
}

function recurrence(startDate: string): RecurrenceRuleDTO | null {
  return buildRecurrenceRule({
    frequency: frequency.value,
    startDate,
  });
}

function setTimingMode(value: string) {
  if (value !== "ALL_DAY" && value !== "TIMED") return;
  timingTouched.value = true;
  timingMode.value = value;
}

function setLocalTime(value: string | number | null | undefined) {
  timingTouched.value = true;
  localTime.value = String(value ?? DEFAULT_TIME);
}

function setFrequency(value: unknown) {
  if (
    typeof value !== "string" ||
    !["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(value)
  ) {
    return;
  }
  recurrenceTouched.value = true;
  frequency.value = value as RecurrenceChoice;
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

const previewSummary = computed(() => {
  const date = formatDateKey(parsed.value.dateKey, undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const mode = timingTouched.value ? timingMode.value : parsed.value.timingMode;
  const timeValue = timingTouched.value
    ? localTime.value
    : (parsed.value.localTime ?? DEFAULT_TIME);
  const time = mode === "TIMED" ? formatTime(timeValue) : "All day";
  const repeat =
    frequency.value === "NONE"
      ? ""
      : ` · ${frequency.value[0]}${frequency.value.slice(1).toLowerCase()}`;
  return `${date} · ${time}${repeat}`;
});

watch(title, (next, previous) => {
  if (!previous.trim() && next.trim()) {
    draftReference.value = new Date();
    draftTimeZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
});

watch(
  parsed,
  (value) => {
    if (!timingTouched.value) {
      timingMode.value = value.timingMode;
      localTime.value = value.localTime ?? DEFAULT_TIME;
    }
    if (!recurrenceTouched.value) {
      frequency.value = value.recurrence?.frequency ?? "NONE";
    }
  },
  { immediate: true },
);

async function undoCreated(dateKey: string, actionItemId: string) {
  try {
    await daily.archiveAction(dateKey, actionItemId);
    toast.add({ title: "Action item removed", color: "neutral" });
  } catch (undoError) {
    toast.add({
      title: "Couldn’t undo action item",
      description:
        undoError instanceof Error ? undoError.message : "Try again.",
      color: "error",
    });
  }
}

async function submit() {
  const interpretation = parsed.value;
  const value = interpretation.title.trim();
  if (!value || saving.value) return;

  saving.value = true;
  error.value = null;
  // Snapshot everything the save needs before touching the refs — the reset
  // below rewinds them, and `recurrence()` reads `frequency` off the live ref.
  const draft = readDraft();
  const submittedTimingMode = draft.timingTouched
    ? draft.timingMode
    : interpretation.timingMode;
  const submittedLocalTime = draft.timingTouched
    ? draft.localTime
    : interpretation.localTime;
  const submitted = {
    timingMode: submittedTimingMode,
    localTime: submittedTimingMode === "TIMED" ? submittedLocalTime : null,
    recurrence: draft.recurrenceTouched
      ? recurrence(interpretation.dateKey)
      : interpretation.recurrence,
  };
  // The form stays open for the next item, so clear the field up front rather
  // than after the save resolves — the whole point of it is rattling off
  // several items in a row, and even a local commit is long enough to swallow
  // the first keystrokes of the next one.
  resetDraft();
  focus();
  try {
    const created = await daily.createAction({
      title: value,
      dateKey: interpretation.dateKey,
      timezone: interpretation.timezone,
      ...submitted,
    });
    if (interpretation.tokens.some((token) => token.accepted)) {
      const actions = [
        {
          label: "Undo",
          onClick: () =>
            undoCreated(interpretation.dateKey, created.actionItemId),
        },
      ];
      if (interpretation.dateKey !== props.dateKey) {
        actions.unshift({
          label: "View",
          onClick: async () => {
            await navigateTo(`/day/${interpretation.dateKey}`);
          },
        });
      }
      toast.add({
        title: "Action item created",
        description: `${value} · ${interpretation.summary}`,
        color: "success",
        actions,
      });
    }
    emit("saved");
  } catch (submitError) {
    // Only restore the draft if the field is still untouched — the user may
    // already be typing the next item, and clobbering that would be worse than
    // losing the prefill. The typed value is repeated in the error either way.
    if (!title.value.trim()) {
      writeDraft(draft);
      focus();
    }
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
  padding: var(--space-1);
  /* border: 1px solid var(--color-border); */
  border-radius: var(--radius-lg);
  /* background: var(--color-surface-subtle); */
}

.inline-action__main,
.inline-action__options {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.inline-action__interpretation {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.inline-action__warning {
  color: var(--color-warning-text);
}

.inline-action__explain {
  margin-inline-start: auto;
  white-space: nowrap;
}

.inline-action__main> :first-child {
  min-width: 0;
  flex: 1;
}

.inline-action__options {
  flex-wrap: wrap;
  /* Stands in for the parent's flex gap, which `.reveal` cancels. Living here
     rather than on the clipped box is what lets the spacing collapse to zero
     instead of stepping away on unmount — see the .reveal comment. */
  padding-block-start: var(--space-2);
}

.inline-action__time {
  max-width: 8.5rem;
}

/* Horizontal twin of `.reveal`, and the same three rules for the same reasons:
   an `fr` track so the width animates and the neighbours are pushed instead of
   jumping, `min-width: 0` so the track can shrink under its content, and the
   parent's inline gap cancelled by a negative margin then reinstated as padding
   one level in — on `__content`, never on the clipped `__inner`, or the box
   floors at 8px and drops it in a single frame when the input unmounts. */
.time-slide {
  display: grid;
  grid-template-columns: 1fr;
  margin-inline-start: calc(-1 * var(--space-2));
}

.time-slide__inner {
  min-width: 0;
  overflow: hidden;
}

.time-slide__content {
  padding-inline-start: var(--space-2);
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

/* A short lead-in on the field itself, so it reads as sliding out of the
   segmented control rather than being stretched into existence. Small on
   purpose — a large offset would drift out of step with the track it rides. */
.time-slide-enter-from .time-slide__content,
.time-slide-leave-to .time-slide__content {
  transform: translateX(-0.5rem);
}

/* Sized to content, not stretched: the tail's auto margin is what claims the
   free space, so the controls stay a tight group on the left instead of a wide
   half-empty select. The narrow breakpoint below restores flex so they fill the
   row once they wrap. */
.inline-action__repeat {
  min-width: 9rem;
}

/* Hint + close sit together at the trailing edge, away from the submit button,
   so the main row reads as one unambiguous action. */
.inline-action__tail {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-inline-start: auto;
}

.inline-action__hint {
  white-space: nowrap;
}

/* Real height animation, not a clip-path wipe.
 *
 * A wipe only animates paint: the row claims its full height on the first
 * frame, so everything below it jumps instantly while the content fades in
 * behind. Animating `grid-template-rows` between 0fr and 1fr eases the *layout*
 * open, so the error slot and the whole action list underneath ride the same
 * curve instead of snapping ahead of it. `min-height: 0` on the inner track is
 * what lets a grid item shrink below its content height.
 *
 * The parent is a flex column with a `gap`, and that gap is not part of any
 * child's box — so it survives the collapse and would vanish in one frame when
 * the element unmounts. The negative margin cancels it, and the spacing is put
 * back as padding on the *content* rather than on `.reveal__inner`.
 *
 * That last detail is the whole thing. Padding on the clipped element itself
 * cannot be crushed below its own size — with `box-sizing: border-box` a 0-height
 * box with 8px of padding still occupies 8px, so the collapse bottomed out at
 * 8px and dropped the rest instantly on unmount. Padding one level in is
 * ordinary content: it gets clipped with everything else and animates to zero. */
.reveal {
  display: grid;
  grid-template-rows: 1fr;
  margin-block-start: calc(-1 * var(--space-2));
}

.reveal__inner {
  min-height: 0;
  overflow: hidden;
}

/* Same duration both ways; only the curve differs.
 *
 * Shortening the exit is right for an overlay that should get out of the way,
 * but wrong here: this collapse *is* a layout change, so cutting its time just
 * compresses the distance the list travels. What made closing feel rough was
 * the curve — `--ease-standard` is a hard decelerate, so on the way out it
 * dumped most of the movement into the first few frames and then crawled.
 * `--ease-exit` paces it evenly instead.
 *
 * Opacity is deliberately shorter than the collapse: content clears at 120ms
 * while the space keeps closing to 200ms, so the tail of the collapse is empty
 * and any sub-pixel settling happens out of sight. On open it trails 60ms
 * behind so the content isn't crossfading against a box that is still sizing. */
.reveal-enter-active {
  transition:
    grid-template-rows var(--duration-normal) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard) 60ms;
}

/* Longer than the open on paper, shorter in practice. `fr` units don't map
   linearly to pixels: collapsing this row reaches its final height at ~53% of
   the declared duration and the remainder is dead time on an already-closed
   box. Measured, not guessed — 320ms declared is ~165ms of real movement
   against the open's 200ms, which is the ratio a close wants. */
.reveal-leave-active {
  transition:
    grid-template-rows var(--duration-slow) var(--ease-exit),
    opacity var(--duration-fast) var(--ease-exit);
}

.reveal-enter-from,
.reveal-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (max-width: 30rem) {
  .inline-action__main {
    align-items: stretch;
  }

  /* The time field is no longer a direct flex child, so flexing it here would
     do nothing — and flexing `.time-slide` instead would let flex, not the grid
     track, decide its width, which kills the collapse. It takes a fixed width
     and the clip does the work. */
  /* .inline-action__time {
    width: 8rem;
  } */

  .inline-action__repeat {
    min-width: 8rem;
    flex: 1;
  }

  .inline-action__hint {
    display: none;
  }

  .inline-action__explain {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {

  .reveal-enter-active,
  .reveal-leave-active,
  .time-slide-enter-active,
  .time-slide-leave-active,
  .time-slide-enter-active .time-slide__content,
  .time-slide-leave-active .time-slide__content {
    transition-duration: 0.01ms;
    transition-delay: 0ms;
  }
}
</style>
