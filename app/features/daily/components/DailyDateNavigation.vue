<template>
  <header class="day-header">
    <div class="day-header__date-nav">
      <UiIconButton icon="i-lucide-chevron-left" label="Previous day" @click="$emit('navigate', -1)" />

      <UiPopover v-model:open="pickerOpen" :content="{ align: 'center', side: 'bottom', sideOffset: 8 }">
        <button type="button" class="day-header__date-trigger" :class="{ 'day-header__date-trigger--open': pickerOpen }"
          :aria-expanded="pickerOpen" aria-haspopup="dialog" aria-label="Open date picker">
          <!-- design-allow: date navigation header popover trigger -->
          <div class="day-header__date-title">
            <p>{{ eyebrow }}</p>
            <div class="day-header__title-row">
              <UiTitle tag="h1" size="xs">{{ title }}</UiTitle>
              <UiIcon name="i-lucide-calendar" class="day-header__calendar-icon"
                :class="{ 'day-header__calendar-icon--active': pickerOpen }" />
            </div>
          </div>
        </button>

        <template #content>
          <DailyDatePicker :active-date-key="activeDateKey" :open="pickerOpen" @select-date="onSelectDate"
            @close="pickerOpen = false" />
        </template>
      </UiPopover>

      <UiIconButton icon="i-lucide-chevron-right" label="Next day" @click="$emit('navigate', 1)" />
    </div>

    <!-- 3D Cylindrical Dial Container with Fixed Center Selector -->
    <nav class="day-header__dial-wrapper" aria-label="Nearby days">
      <!-- Stationary center selector frame -->
      <div class="day-header__fixed-selector" aria-hidden="true" />

      <!-- Scrollable 3D Dial Strip -->
      <div ref="weekContainerRef" class="day-header__dial-strip" @scroll.passive="onScroll" @scrollend="onScrollEnd"
        @wheel="handleWheelScroll" @pointerdown.passive="onPointerDown" @pointerup.passive="onPointerUp"
        @pointercancel.passive="onPointerUp" @keydown="onDialKeydown">
        <NuxtLink v-for="day in days" :key="day.dateKey" :ref="(el) => setChipRef(el, day.dateKey)"
          :to="`/day/${day.dateKey}`" :prefetch="false" class="day-header__dial-item" :class="{
            'day-header__dial-item--active': day.dateKey === activeDateKey,
          }" :tabindex="day.dateKey === activeDateKey ? 0 : -1"
          :aria-current="day.dateKey === activeDateKey ? 'date' : undefined">
          <span>{{ day.weekday }}</span>
          <strong>{{ day.day }}</strong>
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { useHaptics } from "~/composables/pwa/useHaptics";
import DailyDatePicker from "./DailyDatePicker.vue";

const props = defineProps<{
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

const haptics = useHaptics();
let lastHapticKey: string | null = null;

const pickerOpen = ref(false);
const weekContainerRef = ref<HTMLElement | null>(null);
const chipRefs = ref<Record<string, HTMLElement | null>>({});

let isProgrammaticScroll = false;
let scrollAnimationId: number | null = null;
let isPointerDown = false;
let scrolledSincePointerDown = false;
let commitDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function setChipRef(el: unknown, dateKey: string) {
  if (!el) {
    // Vue calls the ref callback with null on unmount. The day window now
    // recenters on navigation (see weekDays in pages/day/[date].vue), so
    // chips actually unmount as they scroll out of range — without this,
    // stale entries would keep pointing at detached (0,0) nodes and could
    // skew the "closest chip to center" search in commitClosestDay.
    delete chipRefs.value[dateKey];
    return;
  }
  const node = (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement);
  chipRefs.value[dateKey] = node;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// We drive the recenter animation ourselves instead of container.scrollTo({behavior:'smooth'}):
// passing behavior:'auto' still defers to the CSS scroll-behavior of the element (so an
// "instant" reposition wasn't actually instant), and retargeting a native smooth scrollTo
// mid-flight snaps to the new target instead of blending, which is visible when the user
// taps prev/next repeatedly. Owning it lets us guarantee instant-when-asked and a clean
// redirect from wherever the strip currently sits.
function animateScrollLeft(container: HTMLElement, target: number, duration: number) {
  if (scrollAnimationId !== null) {
    cancelAnimationFrame(scrollAnimationId);
    scrollAnimationId = null;
  }

  const start = container.scrollLeft;
  const distance = target - start;
  if (duration <= 0 || Math.abs(distance) < 1) {
    container.scrollLeft = target;
    return Promise.resolve();
  }

  const startTime = performance.now();
  return new Promise<void>((resolve) => {
    function step(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      container.scrollLeft = start + distance * easeOutCubic(t);
      if (t < 1) {
        scrollAnimationId = requestAnimationFrame(step);
      } else {
        scrollAnimationId = null;
        resolve();
      }
    }
    scrollAnimationId = requestAnimationFrame(step);
  });
}

function cancelProgrammaticScroll() {
  if (scrollAnimationId !== null) {
    cancelAnimationFrame(scrollAnimationId);
    scrollAnimationId = null;
  }
  isProgrammaticScroll = false;
}

async function scrollToActiveDay(smooth = true) {
  isProgrammaticScroll = true;

  await nextTick();
  const activeEl = chipRefs.value[props.activeDateKey];
  const container = weekContainerRef.value;
  if (!activeEl || !container) {
    isProgrammaticScroll = false;
    return;
  }

  const activeElCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
  const targetLeft = Math.max(0, activeElCenter - container.clientWidth / 2);

  if (!smooth || prefersReducedMotion()) {
    await animateScrollLeft(container, targetLeft, 0);
  } else {
    // Clamp duration so a 1-day nudge feels snappy and a 40-day date-picker
    // jump doesn't glide for multiple seconds.
    const distance = Math.abs(targetLeft - container.scrollLeft);
    const duration = Math.min(420, Math.max(220, distance * 0.85));
    await animateScrollLeft(container, targetLeft, duration);
  }

  isProgrammaticScroll = false;
}

function commitClosestDay() {
  const container = weekContainerRef.value;
  if (!container) return;

  const cCenter = container.scrollLeft + container.clientWidth / 2;
  let closestKey = props.activeDateKey;
  let minDistance = Infinity;

  for (const dateKey in chipRefs.value) {
    const el = chipRefs.value[dateKey];
    if (el) {
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(itemCenter - cCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = dateKey;
      }
    }
  }

  if (closestKey && closestKey !== props.activeDateKey) {
    onSelectDate(closestKey);
  }
}

function checkHapticTick() {
  const container = weekContainerRef.value;
  if (!container) return;

  const cCenter = container.scrollLeft + container.clientWidth / 2;
  let closestKey: string | null = null;
  let minDistance = Infinity;

  for (const dateKey in chipRefs.value) {
    const el = chipRefs.value[dateKey];
    if (el) {
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(itemCenter - cCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestKey = dateKey;
      }
    }
  }

  if (closestKey && closestKey !== lastHapticKey) {
    if (lastHapticKey !== null) {
      haptics.selection();
    }
    lastHapticKey = closestKey;
  }
}

let wheelAccumulator = 0;
let wheelResetTimer: ReturnType<typeof setTimeout> | null = null;
let pointerStartX = 0;

function navigateByOffset(offset: number) {
  const currentIndex = props.days.findIndex(
    (day) => day.dateKey === props.activeDateKey
  );
  if (currentIndex === -1) return;

  const targetIndex = Math.max(
    0,
    Math.min(props.days.length - 1, currentIndex + offset)
  );
  const targetDay = props.days[targetIndex];
  if (targetDay && targetDay.dateKey !== props.activeDateKey) {
    onSelectDate(targetDay.dateKey);
  }
}

// A single flick can hop across several snap points in one continuous motion —
// committing on every intermediate settle would navigate through each day in
// between, not just the one the user meant to land on. So instead of trusting
// any single scroll/scrollend pulse, we debounce: only commit once movement
// has been quiet for a bit AND the pointer isn't still down (a brief pause
// mid-drag with the finger still on the screen isn't "done" yet).
function scheduleCommitCheck() {
  if (commitDebounceTimer !== null) clearTimeout(commitDebounceTimer);
  commitDebounceTimer = setTimeout(() => {
    commitDebounceTimer = null;
    if (isProgrammaticScroll || isPointerDown) return;
    commitClosestDay();
  }, 150);
}

function onScroll() {
  if (isProgrammaticScroll) return;
  scrolledSincePointerDown = true;
  checkHapticTick();
  scheduleCommitCheck();
}

function onScrollEnd() {
  if (isProgrammaticScroll || isPointerDown) return;
  if (commitDebounceTimer !== null) {
    clearTimeout(commitDebounceTimer);
    commitDebounceTimer = null;
  }
  commitClosestDay();
}

function onPointerDown(event: PointerEvent) {
  isPointerDown = true;
  pointerStartX = event.clientX;
  scrolledSincePointerDown = false;
  cancelProgrammaticScroll();
}

function onPointerUp(event: PointerEvent) {
  if (!isPointerDown) return;
  isPointerDown = false;

  const dragDeltaX = pointerStartX - event.clientX;
  const absDrag = Math.abs(dragDeltaX);

  if (absDrag >= 12) {
    const chipWidth = 64;
    const direction = Math.sign(dragDeltaX);
    let steps = Math.max(1, Math.round(absDrag / chipWidth));
    steps = Math.min(5, steps); // Hard-cap at 5 days max per drag gesture

    navigateByOffset(direction * steps);
  } else if (scrolledSincePointerDown && commitDebounceTimer === null && !isProgrammaticScroll) {
    commitClosestDay();
  }
}

function handleWheelScroll(event: WheelEvent) {
  const container = weekContainerRef.value;
  if (!container) return;
  event.preventDefault();

  const rawDelta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (Math.abs(rawDelta) < 1) return;

  wheelAccumulator += rawDelta;

  if (wheelResetTimer !== null) {
    clearTimeout(wheelResetTimer);
  }

  // Reset accumulator if user pauses scroll gesture for 120ms
  wheelResetTimer = setTimeout(() => {
    wheelAccumulator = 0;
    wheelResetTimer = null;
  }, 120);

  const threshold = 40; // 40px delta threshold per 1-day step
  if (Math.abs(wheelAccumulator) >= threshold) {
    const direction = Math.sign(wheelAccumulator);
    const absAcc = Math.abs(wheelAccumulator);

    // Calculate step count and hard-cap at 5 days per gesture pulse
    let steps = Math.floor(absAcc / threshold);
    steps = Math.min(5, Math.max(1, steps));

    const offset = direction * steps;
    wheelAccumulator -= direction * steps * threshold;

    navigateByOffset(offset);
  }
}

function onDialKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const currentIndex = props.days.findIndex(
    (day) => day.dateKey === props.activeDateKey
  );
  const nextDay = props.days[currentIndex + (event.key === "ArrowLeft" ? -1 : 1)];
  if (!nextDay) return;
  onSelectDate(nextDay.dateKey);
  chipRefs.value[nextDay.dateKey]?.focus();
}

function onSelectDate(dateKey: string) {
  pickerOpen.value = false;
  emit("selectDate", dateKey);
  void navigateTo(`/day/${dateKey}`);
}

watch(
  () => props.activeDateKey,
  (newKey) => {
    lastHapticKey = newKey;
    const container = weekContainerRef.value;
    const activeEl = chipRefs.value[props.activeDateKey];
    if (container && activeEl) {
      const activeElCenter = activeEl.offsetLeft + activeEl.offsetWidth / 2;
      const currentCenter = container.scrollLeft + container.clientWidth / 2;
      if (Math.abs(activeElCenter - currentCenter) < 3) {
        return;
      }
    }
    void scrollToActiveDay(true);
  },
  { immediate: true }
);

onMounted(() => {
  void scrollToActiveDay(false);
});

onBeforeUnmount(() => {
  cancelProgrammaticScroll();
  if (commitDebounceTimer !== null) clearTimeout(commitDebounceTimer);
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

/* 3D Cylindrical Dial Wrapper */
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

/* Fixed Center Selector Frame: Positioned ABOVE dates (z-index: 5) */
.day-header__fixed-selector {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3.5rem;
  height: 2.5rem;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 2;
}

/* Native Scrollable Dial Strip (z-index: 2) */
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
  /* proximity (not mandatory): mandatory fights momentum on tightly-packed
     snap points and can cap a flick to moving one item at a time. Our own
     JS still re-centers precisely on settle, so proximity only loosens the
     drag feel, not the final selected position. */
  scroll-snap-type: none;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 calc(50% - 1.75rem);
}

.day-header__dial-strip::-webkit-scrollbar {
  display: none;
}

/* Date Chip Items */
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
    transform var(--duration-fast) var(--ease-standard),
    opacity var(--duration-fast) var(--ease-standard);
  opacity: 0.55;
  transform: scale(0.85);
}

.day-header__dial-item:hover {
  opacity: 0.85;
}

.day-header__dial-item--active {
  color: var(--color-on-primary);
  opacity: 1;
  transform: scale(1.05);
}

.day-header__dial-item strong {
  font-size: var(--text-base);
  font-weight: 700;
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
