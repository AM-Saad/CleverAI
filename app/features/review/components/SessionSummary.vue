<template>
  <div class="summary">
    <div class="summary__top">
      <span class="summary__eyebrow">SESSION COMPLETE</span>
      <div class="summary__xp">+{{ xp }}</div>
      <p class="summary__sub">XP earned · {{ cards }} cards · {{ minutes }} min</p>
    </div>

    <div class="summary__ribbon">
      <div class="summary__stat">
        <span class="summary__stat-label">STREAK</span>
        <span class="summary__stat-value">{{ streak }} <small>days</small></span>
      </div>
      <div class="summary__stat">
        <span class="summary__stat-label">ACCURACY</span>
        <span class="summary__stat-value">{{ accuracy }}<small>%</small></span>
      </div>
    </div>

    <!-- Achievements: one of the four sanctioned brand-gradient surfaces -->
    <RewardGradient v-if="achievement" class="summary__ach">
      <div class="summary__ach-inner">
        <span class="summary__medal"><UiIcon name="i-lucide-medal" class="h-6 w-6" /></span>
        <div>
          <span class="summary__ach-label">ACHIEVEMENT UNLOCKED</span>
          <p class="summary__ach-title">{{ achievement }}</p>
        </div>
      </div>
    </RewardGradient>

    <UiButton pill block size="lg" tone="neutral" class="summary__done" @click="emit('done')">
      Done
    </UiButton>
  </div>
</template>

<script setup lang="ts">
/**
 * SessionSummary — the single full-brand celebration screen. Background is the
 * primary summary gradient; the brand (reward) gradient appears only on the
 * achievement ribbon. "Let it breathe."
 */
import RewardGradient from "~/components/ui/RewardGradient.vue";

withDefaults(
  defineProps<{
    xp: number;
    cards: number;
    minutes: number;
    streak: number;
    accuracy: number;
    achievement?: string | null;
  }>(),
  { achievement: null },
);

const emit = defineEmits<{ (e: "done"): void }>();
</script>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-height: 100dvh;
  padding: var(--space-12) var(--space-6) calc(var(--space-8) + env(safe-area-inset-bottom));
  background: var(--ds-gradient-summary);
  color: var(--color-white);
}
.summary__top {
  margin-top: var(--space-8);
}
.summary__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 3px;
  opacity: 0.7;
}
.summary__xp {
  font-size: 64px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -2px;
  margin-top: var(--space-2);
}
.summary__sub {
  margin-top: var(--space-2);
  font-size: 14px;
  opacity: 0.8;
}
.summary__ribbon {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.summary__stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--color-white) 12%, transparent);
  backdrop-filter: blur(8px);
}
.summary__stat-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  opacity: 0.7;
}
.summary__stat-value {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
}
.summary__stat-value small {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.8;
}
.summary__ach {
  border-radius: var(--radius-2xl);
  padding: 2px;
}
.summary__ach-inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: calc(var(--radius-2xl) - 2px);
  background: color-mix(in srgb, var(--color-white) 88%, transparent);
}
.summary__medal {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xl);
  background: var(--ds-gradient-fab);
  color: var(--color-white);
  flex-shrink: 0;
}
.summary__ach-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--color-content-secondary);
}
.summary__ach-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.summary__done {
  margin-top: auto;
}
</style>
