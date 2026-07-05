<template>
  <div class="streak" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="streak__svg">
      <defs>
        <linearGradient :id="gradId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--color-warning)" />
          <stop offset="100%" stop-color="var(--color-accent-orange)" />
        </linearGradient>
      </defs>
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke="var(--color-surface-strong)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="`url(#${gradId})`"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        class="streak__progress"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <span class="streak__num" :class="{ 'streak__num--pulse': milestone }">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * StreakRing (module 09) — the SVG ring fills on mount (stroke-dashoffset
 * animation toward the current streak / next milestone); the center number
 * pulses when the streak hits a milestone. Orange gradient (not the reward
 * brand gradient). Respects prefers-reduced-motion.
 */
import { ref, computed, onMounted } from "vue";

const props = withDefaults(
  defineProps<{ value: number; size?: number; goal?: number }>(),
  { size: 56, goal: 0 },
);

const gradId = `streak-${Math.random().toString(36).slice(2, 8)}`;
const stroke = computed(() => Math.round(props.size * 0.1));
const r = computed(() => props.size / 2 - stroke.value);
const circumference = computed(() => 2 * Math.PI * r.value);

// Next milestone (7-day rings) unless an explicit goal is provided.
const target = computed(() => props.goal || Math.max(7, Math.ceil((props.value || 1) / 7) * 7));
const progress = computed(() => Math.min(1, (props.value || 0) / target.value));
const milestone = computed(() => props.value > 0 && props.value % 7 === 0);

// Animate from empty (full offset) to the target on mount.
const filled = ref(false);
const dashOffset = computed(() =>
  filled.value ? circumference.value * (1 - progress.value) : circumference.value,
);

onMounted(() => requestAnimationFrame(() => (filled.value = true)));
</script>

<style scoped>
.streak {
  position: relative;
  display: grid;
  place-items: center;
}
.streak__svg {
  position: absolute;
  inset: 0;
}
.streak__progress {
  transition: stroke-dashoffset var(--duration-slow) var(--ease-emphasized);
}
.streak__num {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--color-warning-text);
}
.streak__num--pulse {
  animation: streak-pulse 1.4s var(--ease-standard) infinite;
}
@keyframes streak-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.14); }
}
@media (prefers-reduced-motion: reduce) {
  .streak__progress { transition: none; }
  .streak__num--pulse { animation: none; }
}
</style>
