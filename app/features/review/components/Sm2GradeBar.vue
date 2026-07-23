<template>
  <div class="gradebar">
    <button
      v-for="g in grades"
      :key="g.key"
      type="button"
      class="gradebar__btn"
      :style="{ '--g': g.color, '--gt': g.text }"
      :disabled="disabled"
      :aria-label="`${g.label}, next review ${g.interval}, shortcut ${g.shortcut}`"
      @click="handleGrade(g.key)"
    >
      <!-- design-allow: per-tone tinted native grade controls -->
      <span class="gradebar__label">{{ g.label }}</span>
      <span class="gradebar__interval">{{ g.interval }}</span>
      <kbd class="gradebar__key">{{ g.shortcut }}</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Sm2GradeBar — the four SM-2 grades. Each shows the *real* projected next
 * interval for the current card (legible algorithm), and commits via the
 * idempotent grade endpoint upstream.
 */
import { computed } from "vue";
import {
  projectInterval,
  formatInterval,
  type GradeKey,
  type Sm2State,
} from "~/composables/review/useSm2Preview";
import { useHaptics } from "~/composables/pwa/useHaptics";

const props = defineProps<{
  state: Sm2State;
  disabled?: boolean;
}>();

const emit = defineEmits<{ (e: "grade", key: GradeKey): void }>();
const haptics = useHaptics();

const handleGrade = (key: GradeKey) => {
  haptics.rating(key);
  emit("grade", key);
};

const grades = computed(() =>
  (
    [
      {
        key: "again",
        label: "Again",
        shortcut: "1",
        color: "var(--color-error)",
        text: "var(--color-error-text)",
      },
      {
        key: "hard",
        label: "Hard",
        shortcut: "2",
        color: "var(--color-warning)",
        text: "var(--color-warning-text)",
      },
      {
        key: "good",
        label: "Good",
        shortcut: "3",
        color: "var(--color-success)",
        text: "var(--color-success-text)",
      },
      {
        key: "easy",
        label: "Easy",
        shortcut: "4",
        color: "var(--color-primary)",
        text: "var(--color-primary)",
      },
    ] as {
      key: GradeKey;
      label: string;
      shortcut: string;
      color: string;
      text: string;
    }[]
  ).map((g) => ({
    ...g,
    interval: formatInterval(projectInterval(props.state, g.key)),
  })),
);
</script>

<style scoped>
.gradebar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}
.gradebar__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: var(--target-touch);
  padding: 11px 6px;
  border-radius: var(--component-card-radius);
  background: color-mix(in srgb, var(--g) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--g) 28%, transparent);
  transition:
    transform var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}
.gradebar__btn:active {
  transform: scale(0.97);
  background: color-mix(in srgb, var(--g) 20%, transparent);
}
.gradebar__btn:disabled {
  opacity: 0.6;
  pointer-events: none;
}
.gradebar__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--gt);
}
.gradebar__interval {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-content-secondary);
}
.gradebar__key {
  display: none;
  min-width: 18px;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-content-secondary);
  font-size: 9px;
  line-height: 16px;
}
@media (hover: hover) and (pointer: fine) {
  .gradebar__key {
    display: inline-block;
  }
}
</style>
