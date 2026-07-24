<template>
  <div class="summary">
    <div class="summary__top">
      <UiLabel size="sm" weight="bold" color="content-secondary" uppercase>Session complete</UiLabel>
      <UiTitle tag="div" size="4xl" weight="extrabold" tight color="content-on-background" class="summary__xp">+{{ xp }} XP</UiTitle>
      <UiParagraph size="sm" color="content-secondary" class="summary__sub">{{ cards }} cards · {{ minutes }} min</UiParagraph>
    </div>

    <div class="summary__stats">
      <UiPanel variant="subtle" size="md">
        <div class="summary__stat">
          <UiLabel size="sm" color="content-secondary">Streak</UiLabel>
          <strong>{{ streak }} <small>days</small></strong>
        </div>
      </UiPanel>
      <UiPanel variant="subtle" size="md">
        <div class="summary__stat">
          <UiLabel size="sm" color="content-secondary">Accuracy</UiLabel>
          <strong>{{ accuracy }}<small>%</small></strong>
        </div>
      </UiPanel>
    </div>

    <UiPanel v-if="achievement" variant="subtle" size="md">
      <div class="summary__achievement">
        <span class="summary__medal"
          ><UiIcon name="i-lucide-medal" class="h-5 w-5"
        /></span>
        <div>
          <UiLabel size="sm" color="content-secondary">Achievement unlocked</UiLabel>
          <strong>{{ achievement }}</strong>
        </div>
      </div>
    </UiPanel>

    <UiButton block size="lg" class="summary__done" @click="emit('done')"
      >Done</UiButton
    >
  </div>
</template>

<script setup lang="ts">
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
const emit = defineEmits<{ done: [] }>();
</script>

<style scoped>
.summary {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-12) var(--space-6)
    calc(var(--space-8) + env(safe-area-inset-bottom));
  background: var(--color-background);
  color: var(--color-content-on-background);
}
.summary__top {
  margin-top: var(--space-8);
}
.summary__xp {
  margin-top: var(--space-2);
}
.summary__sub {
  margin-top: var(--space-2);
}
.summary__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.summary__stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.summary__stat strong {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-2xl);
}
.summary__stat small {
  font-size: var(--text-sm);
  font-weight: 600;
}
.summary__achievement {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.summary__achievement strong {
  display: block;
  color: var(--color-content-on-surface-strong);
}
.summary__medal {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.summary__done {
  margin-top: auto;
}
</style>
