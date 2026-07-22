<template>
  <header class="day-header">

    <div class="day-header__date-nav">
      <UiIconButton icon="i-lucide-chevron-left" label="Previous day" @click="$emit('navigate', -1)" />
      <div class="day-header__date-title">
        <p>{{ eyebrow }}</p>
        <UiTitle tag="h1">{{ title }}</UiTitle>
      </div>
      <UiIconButton icon="i-lucide-chevron-right" label="Next day" @click="$emit('navigate', 1)" />
    </div>

    <nav class="day-header__week" aria-label="Nearby days">
      <NuxtLink v-for="day in days" :key="day.dateKey" :to="`/day/${day.dateKey}`" class="day-header__day-chip" :class="{
        'day-header__day-chip--active': day.dateKey === activeDateKey,
      }" :aria-current="day.dateKey === activeDateKey ? 'date' : undefined">
        <span>{{ day.weekday }}</span>
        <strong>{{ day.day }}</strong>
      </NuxtLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  activeDateKey: string;
  eyebrow: string;
  title: string;
  days: readonly { dateKey: string; weekday: string; day: number }[];
  accountLink: string | Record<string, unknown>;
}>();
defineEmits<{ navigate: [amount: number] }>();
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
}

.day-header__topline,
.day-header__date-nav {
  justify-content: space-between;
  gap: var(--space-2)
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

.day-header__date-title {
  text-align: center;
}

.day-header__date-title p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.day-header__date-title :deep(h1) {
  font-size: var(--text-xs);
}

.day-header__week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2);
  align-items: center
}

.day-header__day-chip {
  display: flex;
  /* min-height: 30px; */
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-xl);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  padding: 0 var(--space-1)
}

.day-header__day-chip--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.day-header__day-chip strong {
  font-size: var(--text-base);
}

@media (max-width: 639px) {
  .day-header {
    flex-direction: column;
  }
}
</style>
