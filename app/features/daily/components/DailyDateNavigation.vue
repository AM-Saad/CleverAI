<template>
  <header class="day-header">
    <div class="day-header__date-nav">
      <UiIconButton icon="chevron-left" label="Previous day" @click="$emit('navigate', -1)" />

      <UiPopover v-model:open="pickerOpen" :content="{ align: 'center', side: 'bottom', sideOffset: 8 }">
        <button type="button" class="day-header__date-trigger" :class="{ 'day-header__date-trigger--open': pickerOpen }"
          :aria-expanded="pickerOpen" aria-haspopup="dialog" aria-label="Open date picker">
          <!-- design-allow: date navigation header popover trigger -->
          <div class="day-header__date-title">
            <p>{{ eyebrow }}</p>
            <div class="day-header__title-row">
              <UiTitle tag="h1" size="xs">{{ title }}</UiTitle>
              <UiIcon name="calendar" class="day-header__calendar-icon"
                :class="{ 'day-header__calendar-icon--active': pickerOpen }" />
            </div>
          </div>
        </button>

        <template #content>
          <DailyDatePicker :active-date-key="activeDateKey" :open="pickerOpen" @select-date="onSelectDate"
            @close="pickerOpen = false" />
        </template>
      </UiPopover>

      <UiIconButton icon="chevron-right" label="Next day" @click="$emit('navigate', 1)" />
    </div>

    <!-- Date dial. The strip scrolls natively (so momentum and snapping are the
         platform's), and every chip's position is a pure function of its index,
         so nothing here has to measure the DOM per frame. -->
    <nav class="day-header__dial-wrapper" aria-label="Nearby days">
      <div class="day-header__fixed-selector" aria-hidden="true" />

      <div ref="stripRef" class="day-header__dial-strip"
        :class="{ 'day-header__dial-strip--seeking': isProgrammaticScroll }" @scroll.passive="onScroll"
        @scrollend="onScrollEnd" @wheel="onWheel" @pointerdown.passive="onPointerDown"
        @touchstart.passive="onTouchChange" @touchend.passive="onTouchChange" @touchcancel.passive="onTouchChange"
        @keydown="onDialKeydown">
        <NuxtLink v-for="(day, index) in days" :key="day.dateKey"
          v-memo="[falloff(index), day.dateKey === activeDateKey]" :to="`/day/${day.dateKey}`" :prefetch="false"
          class="day-header__dial-item" :data-falloff="falloff(index)"
          :class="{ 'day-header__dial-item--active': day.dateKey === activeDateKey }"
          :tabindex="index === focusedIndex ? 0 : -1" :aria-label="day.label"
          :aria-current="day.dateKey === activeDateKey ? 'date' : undefined">
          <span>{{ day.weekday }}</span>
          <strong>{{ day.day }}</strong>
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useHaptics } from "~/composables/pwa/useHaptics";
import { createDateDialInteractionGate } from "../presentation/dateDialInteraction";
import DailyDatePicker from "./DailyDatePicker.vue";

/**
 * The dial is a scroll position, and everything else is derived from it.
 *
 *   focusedIndex = round(scrollLeft / pitch)
 *
 * Chips are uniformly sized, so the day under the selector is arithmetic — no
 * per-frame DOM measurement, and no element refs that can go stale while the
 * 91-day window slides underneath.
 *
 * Selection is deliberately separate from routing: the highlight and haptics
 * follow the finger immediately, and the route commits once exactly, after
 * motion settles. Scrubbing past six days is one navigation, not six.
 */

const props = defineProps<{
  activeDateKey: string;
  eyebrow: string;
  title: string;
  days: readonly { dateKey: string; weekday: string; day: number; label?: string }[];
  accountLink: string | Record<string, unknown>;
}>();

const emit = defineEmits<{
  navigate: [amount: number];
  selectDate: [dateKey: string];
}>();

/** Quiet time after the last scroll before the route commits. */
const SETTLE_MS = 140;
/** Wheel delta that equals one day. */
const WHEEL_STEP_PX = 40;
/** Chips beyond this distance from centre all share the faded resting style. */
const FALLOFF_LIMIT = 4;

const haptics = useHaptics();

const pickerOpen = ref(false);
const stripRef = ref<HTMLElement | null>(null);
const focusedIndex = ref(0);
const isProgrammaticScroll = ref(false);

/** Distance between adjacent chip centres, measured from the real DOM so the
 *  dial keeps working under browser text scaling or a token change. */
const pitch = ref(0);

const activeIndex = computed(() =>
  props.days.findIndex((day) => day.dateKey === props.activeDateKey),
);

/** The day the user is currently pointing at — not necessarily the route yet. */
const focusedKey = computed(() => props.days[focusedIndex.value]?.dateKey ?? props.activeDateKey);

function falloff(index: number) {
  return Math.min(FALLOFF_LIMIT, Math.abs(index - focusedIndex.value));
}

function clampIndex(index: number) {
  return Math.max(0, Math.min(props.days.length - 1, index));
}

/**
 * The day sitting under the selector, captured as the index moves rather than
 * derived from one afterwards.
 *
 * It has to be recorded here because `days` is renumbered on every commit: a
 * computed over the array would silently change meaning the moment the window
 * recentres, and the post-commit repositioning below would then slide away
 * from a day the user never chose.
 */
let centeredKey = props.activeDateKey;

function setFocusedIndex(index: number) {
  const next = clampIndex(index);
  if (next === focusedIndex.value) return false;
  focusedIndex.value = next;
  const key = props.days[next]?.dateKey;
  if (key) centeredKey = key;
  return true;
}

// ── Geometry ─────────────────────────────────────────────────────
// The strip is padded by half its width minus half a chip, so chip 0 sits dead
// centre at scrollLeft 0 and chip i at scrollLeft i * pitch.

function measurePitch() {
  const strip = stripRef.value;
  const first = strip?.firstElementChild as HTMLElement | null;
  const second = first?.nextElementSibling as HTMLElement | null;
  if (!first) return;
  const next = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
  if (next > 0) pitch.value = next;
}

function scrollLeftFor(index: number) {
  return index * pitch.value;
}

function indexFromScroll(scrollLeft: number) {
  if (pitch.value <= 0) return focusedIndex.value;
  return clampIndex(Math.round(scrollLeft / pitch.value));
}

// ── Programmatic scrolling ───────────────────────────────────────
// Driven here rather than via scrollTo({behavior:'smooth'}) because retargeting
// a native smooth scroll mid-flight snaps to the new target instead of blending
// — visible when prev/next is tapped repeatedly. A generation token means an
// interrupted run can never clear the flag belonging to a newer one.

let scrollGeneration = 0;
let scrollAnimationId: number | null = null;
let resolveScrollAnimation: (() => void) | null = null;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function stopScrollAnimation() {
  if (scrollAnimationId !== null) {
    cancelAnimationFrame(scrollAnimationId);
    scrollAnimationId = null;
  }
  // Always settle the promise — a cancelled animation used to leave its awaiter
  // suspended forever.
  resolveScrollAnimation?.();
  resolveScrollAnimation = null;
}

function animateScrollLeft(strip: HTMLElement, target: number, duration: number) {
  stopScrollAnimation();

  const start = strip.scrollLeft;
  const distance = target - start;
  if (duration <= 0 || Math.abs(distance) < 1) {
    strip.scrollLeft = target;
    return Promise.resolve();
  }

  const startTime = performance.now();
  return new Promise<void>((resolve) => {
    resolveScrollAnimation = resolve;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      strip.scrollLeft = start + distance * easeOutCubic(t);
      if (t < 1) {
        scrollAnimationId = requestAnimationFrame(step);
        return;
      }
      scrollAnimationId = null;
      resolveScrollAnimation = null;
      resolve();
    };
    scrollAnimationId = requestAnimationFrame(step);
  });
}

/**
 * `scroll` and `scrollend` are dispatched asynchronously, so they arrive after
 * the move that caused them has already finished and cleared its flag. Without
 * a short tail the component reads its own scrolling as user input — which made
 * a single wheel gesture commit once per step instead of once in total.
 */
const SELF_DRIVEN_TAIL_MS = 160;
let selfDrivenUntil = 0;

function isSelfDriven() {
  return isProgrammaticScroll.value || performance.now() < selfDrivenUntil;
}

function cancelProgrammaticScroll() {
  scrollGeneration += 1;
  stopScrollAnimation();
  isProgrammaticScroll.value = false;
  // A real gesture takes precedence immediately.
  selfDrivenUntil = 0;
}

async function seekToIndex(index: number, animate: boolean) {
  const strip = stripRef.value;
  if (!strip || pitch.value <= 0) return;

  // Any glide still in flight is superseded — otherwise it keeps writing
  // scrollLeft after this one has set its own, and the older target wins.
  stopScrollAnimation();

  const generation = ++scrollGeneration;
  isProgrammaticScroll.value = true;
  setFocusedIndex(index);

  // Snapping has to stand down while we drive scrollLeft ourselves: every
  // assignment is its own scroll operation, and a mandatory snap container
  // would re-snap each one and stutter the animation. We land exactly on a
  // snap point, so re-enabling it is invisible.
  await nextTick();

  const target = scrollLeftFor(clampIndex(index));
  if (!animate || prefersReducedMotion()) {
    strip.scrollLeft = target;
  } else {
    // Snappy for a one-day nudge, still brisk for a month-long jump.
    const distance = Math.abs(target - strip.scrollLeft);
    const duration = Math.min(420, Math.max(200, distance * 0.9));
    await animateScrollLeft(strip, target, duration);
  }

  if (generation === scrollGeneration) {
    selfDrivenUntil = performance.now() + SELF_DRIVEN_TAIL_MS;
    isProgrammaticScroll.value = false;
  }
}

// ── Commit ───────────────────────────────────────────────────────

let settleTimer: ReturnType<typeof setTimeout> | null = null;
const interactionGate = createDateDialInteractionGate();

function clearSettleTimer() {
  if (settleTimer !== null) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

/**
 * A flick crosses several detents in one motion; committing at each would
 * navigate through every day passed over. So the route only moves once the
 * strip has been quiet AND the finger is off it — a pause mid-drag is not a
 * decision.
 */
function scheduleCommit() {
  interactionGate.markScrolling();
  clearSettleTimer();
  settleTimer = setTimeout(() => {
    settleTimer = null;
    interactionGate.markScrollSettled();
    commitFocused();
  }, SETTLE_MS);
}

function commitFocused() {
  if (!interactionGate.isReadyToCommit()) return;
  const key = focusedKey.value;
  if (key && key !== props.activeDateKey) emit("selectDate", key);
}

// ── Input ────────────────────────────────────────────────────────

function onScroll() {
  const strip = stripRef.value;
  if (!strip) return;

  // A move we started already knows its destination. Reading the index back out
  // of a mid-flight scroll position would drag it to wherever the animation
  // currently is, which silently undid queued steps when they arrived faster
  // than the glide could finish.
  if (isSelfDriven()) return;

  // The detent the user just crossed.
  if (setFocusedIndex(indexFromScroll(strip.scrollLeft))) haptics.selection();
  scheduleCommit();
}

/** The precise end-of-scroll signal where it exists; the debounce above is the
 *  fallback on browsers without it, so both paths land on the same commit. */
function onScrollEnd() {
  if (isSelfDriven()) return;
  clearSettleTimer();
  interactionGate.markScrollSettled();
  commitFocused();
}

function onPointerDown(event: PointerEvent) {
  interactionGate.startPointer(event.pointerId);
  // The finger takes over from any glide already in flight.
  cancelProgrammaticScroll();
}

function onPointerUp(event: PointerEvent) {
  if (!interactionGate.endPointer(event.pointerId)) return;
  // If scrollend arrived while the pointer was held, both conditions are now
  // satisfied. If momentum is still running, its settle signal commits later.
  commitFocused();
}

function onPointerCancel(event: PointerEvent) {
  if (!interactionGate.endPointer(event.pointerId)) return;
  // Touch scrolling often cancels its pointer before the finger is lifted.
  // The independent touch count keeps the commit blocked in that interval.
  commitFocused();
}

function onTouchChange(event: TouchEvent) {
  interactionGate.setActiveTouchCount(event.touches.length);
  commitFocused();
}

function onWheel(event: WheelEvent) {
  const strip = stripRef.value;
  if (!strip) return;
  event.preventDefault();

  const raw =
    Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (Math.abs(raw) < 1) return;

  wheelAccumulator += raw;
  const steps = Math.trunc(wheelAccumulator / WHEEL_STEP_PX);
  if (steps === 0) return;

  wheelAccumulator -= steps * WHEEL_STEP_PX;
  stepFocus(steps);
}

let wheelAccumulator = 0;

/** Moves the dial without committing; the settle timer does that once. */
function stepFocus(delta: number) {
  const next = clampIndex(focusedIndex.value + delta);
  if (next === focusedIndex.value) return;
  haptics.selection();
  void seekToIndex(next, true);
  scheduleCommit();
}

function onDialKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();

  const next = clampIndex(focusedIndex.value + (event.key === "ArrowLeft" ? -1 : 1));
  if (next === focusedIndex.value) return;

  haptics.selection();
  void seekToIndex(next, true);
  scheduleCommit();

  // preventScroll: focusing a child of a scroll container otherwise scrolls it
  // into view and fights the animation we just started.
  void nextTick(() => {
    const chip = stripRef.value?.children[next] as HTMLElement | undefined;
    chip?.focus({ preventScroll: true });
  });
}

function onSelectDate(dateKey: string) {
  pickerOpen.value = false;
  // Emit only. The page owns navigation; doing both here fired two identical
  // router pushes for every selection.
  emit("selectDate", dateKey);
}

// ── Keeping the dial and the route in step ───────────────────────
// The 91-day window recentres on the active date, so every commit renumbers
// every chip and the strip's contents shift under a scroll offset the browser
// leaves untouched. Re-anchoring on the day that was centred before the
// renumber cancels that shift exactly: when the dial itself made the choice the
// two indices match and nothing moves, and when the choice came from elsewhere
// what's left is a clean slide from where the user was looking.

watch(
  () => props.activeDateKey,
  async () => {
    const strip = stripRef.value;
    const target = activeIndex.value;
    if (!strip || target < 0 || pitch.value <= 0) {
      if (target >= 0) setFocusedIndex(target);
      return;
    }

    const from = props.days.findIndex((day) => day.dateKey === centeredKey);

    // Jumped clean out of the old window — there is no position to slide from.
    if (from < 0) {
      await seekToIndex(target, false);
      return;
    }

    stopScrollAnimation();
    scrollGeneration += 1;
    isProgrammaticScroll.value = true;
    strip.scrollLeft = scrollLeftFor(from);
    await seekToIndex(target, from !== target);
  },
  { flush: "post" },
);

// ── Lifecycle ────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();
  measurePitch();

  const index = activeIndex.value;
  if (index >= 0) {
    focusedIndex.value = index;
    centeredKey = props.activeDateKey;
    if (stripRef.value && pitch.value > 0) {
      stripRef.value.scrollLeft = scrollLeftFor(index);
    }
  }

  if (stripRef.value) {
    resizeObserver = new ResizeObserver(() => {
      const before = pitch.value;
      measurePitch();
      // A layout change moves every snap point; re-anchor so the selector keeps
      // framing the same day instead of drifting between two.
      if (pitch.value !== before && stripRef.value) {
        stripRef.value.scrollLeft = scrollLeftFor(focusedIndex.value);
      }
    });
    resizeObserver.observe(stripRef.value);
  }

  // Listen at the window boundary so releasing a mouse drag outside the strip
  // still completes the interaction without capturing clicks away from links.
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerCancel, { passive: true });
});

onBeforeUnmount(() => {
  cancelProgrammaticScroll();
  clearSettleTimer();
  interactionGate.reset();
  resizeObserver?.disconnect();
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
});
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
  justify-content: space-between;
  gap: var(--space-2);
}

.day-header__date-nav {
  flex: 1 0 200px;
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

/* ─── Dial ─────────────────────────────────────────────────────── */
.day-header__dial-wrapper {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  height: 3rem;
  display: flex;
  align-items: center;
  mask-image: linear-gradient(to right,
      transparent 0%,
      black 18%,
      black 82%,
      transparent 100%);
  -webkit-mask-image: linear-gradient(to right,
      transparent 0%,
      black 18%,
      black 82%,
      transparent 100%);
}

/* The selector never moves; the strip moves under it. */
.day-header__fixed-selector {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3.29rem;
  height: 2.5rem;
  border-radius: calc(var(--radius-lg) - 2px);
  background: var(--color-primary);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-content-on-background) 18%, transparent);
  pointer-events: none;
  z-index: 2;
}

.day-header__dial-strip {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  /* Chips are added and removed at both ends as the window recentres. Scroll
     anchoring would silently adjust scrollLeft to compensate, which collides
     with the re-anchoring this component does deliberately — turning it off
     keeps the position a value we own outright. */
  overflow-anchor: none;
  /* Detents come from the platform, so a flick keeps its native momentum and
     still lands square under the selector. */
  scroll-snap-type: x mandatory;
  /* Ours is the only smooth scrolling here; an inherited `smooth` would animate
     on top of the rAF drive and make every seek mushy. */
  scroll-behavior: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 calc(50% - 1.75rem);
}

/* While we drive scrollLeft ourselves, snapping has to stand down: each
   assignment is its own scroll operation and would otherwise be re-snapped. */
.day-header__dial-strip--seeking {
  scroll-snap-type: none;
}

.day-header__dial-strip::-webkit-scrollbar {
  display: none;
}

.day-header__dial-item {
  position: relative;
  z-index: 6;
  display: flex;
  flex: 0 0 3.5rem;
  width: 3.5rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-lg);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  scroll-snap-align: center;
  text-decoration: none;
  background: transparent;
  border: 1px solid transparent;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: color var(--duration-fast) var(--ease-standard),
    transform var(--duration-normal) var(--ease-standard),
    opacity var(--duration-normal) var(--ease-standard);
}

/* Falloff from the selector. The step values do the shaping; the transition
   above interpolates as the index under the selector changes, which is what
   reads as a dial rather than an on/off highlight. */
.day-header__dial-item[data-falloff="0"] {
  opacity: 1;
  transform: scale(1.05);
  color: var(--color-on-primary);
}

.day-header__dial-item[data-falloff="1"] {
  opacity: 0.78;
  transform: scale(0.94);
}

.day-header__dial-item[data-falloff="2"] {
  opacity: 0.6;
  transform: scale(0.88);
}

.day-header__dial-item[data-falloff="3"] {
  opacity: 0.46;
  transform: scale(0.84);
}

.day-header__dial-item[data-falloff="4"] {
  opacity: 0.36;
  transform: scale(0.82);
}

.day-header__dial-item:hover:not([data-falloff="0"]) {
  opacity: 0.9;
}

.day-header__dial-item:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
}

.day-header__dial-item strong {
  font-size: var(--text-base);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {

  .day-header__dial-item,
  .day-header__calendar-icon,
  .day-header__date-trigger {
    transition: none;
  }
}

@media (max-width: 639px) {
  .day-header {
    flex-direction: column;
  }

  .day-header__date-nav {
    flex: 1 0 auto
  }
}
</style>
