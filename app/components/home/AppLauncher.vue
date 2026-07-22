<template>
  <div class="launcher">
    <header class="launcher__header">
      <div>
        <p class="launcher__eyebrow">Your apps</p>
        <ui-title tag="h1">Where do you want to focus?</ui-title>
      </div>
      <NuxtLink
        to="/account"
        class="launcher__account"
        aria-label="Account settings"
      >
        <UiIcon name="i-lucide-user-round" class="h-5 w-5" />
      </NuxtLink>
    </header>

    <div class="launcher__apps">
      <NuxtLink :to="todayLink" class="launcher-card launcher-card--daily">
        <span class="launcher-card__icon">
          <UiIcon name="i-lucide-calendar-check-2" class="h-7 w-7" />
        </span>
        <span class="launcher-card__main">
          <span class="launcher-card__eyebrow">Today · {{ todayLabel }}</span>
          <strong>Daily</strong>
          <span>Action items and one continuous daily note.</span>
          <span
            v-if="serviceStatus && !serviceStatus.daily"
            class="launcher-card__status"
          >
            <UiIcon name="i-lucide-cloud-off" class="h-3.5 w-3.5" />
            Process offline · cached days remain available
          </span>
        </span>
        <UiIcon name="i-lucide-arrow-right" class="launcher-card__arrow" />
      </NuxtLink>

      <NuxtLink to="/learn" class="launcher-card launcher-card--learning">
        <span class="launcher-card__icon">
          <UiIcon name="i-lucide-graduation-cap" class="h-7 w-7" />
        </span>
        <span class="launcher-card__main">
          <span class="launcher-card__eyebrow">Workspaces · Review</span>
          <strong>Learning</strong>
          <span>Languages, materials, flashcards, and spaced repetition.</span>
          <span
            v-if="serviceStatus && !serviceStatus.learning"
            class="launcher-card__status"
          >
            <UiIcon name="i-lucide-cloud-off" class="h-3.5 w-3.5" />
            Process offline · downloaded learning stays available
          </span>
        </span>
        <UiIcon name="i-lucide-arrow-right" class="launcher-card__arrow" />
      </NuxtLink>
    </div>

    <p class="launcher__shared">
      <UiIcon name="i-lucide-shield-check" class="h-4 w-4" />
      One account, shared plan, and offline access across both apps.
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  dateKeyInTimeZone,
  formatDateKey,
} from "@shared/utils/daily-recurrence";

const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";
const today = dateKeyInTimeZone(new Date(), timeZone);
const todayLink = `/day/${today}`;
const todayLabel = formatDateKey(today, undefined, {
  month: "short",
  day: "numeric",
});
const serviceStatus = ref<{ daily: boolean; learning: boolean } | null>(null);

onMounted(async () => {
  try {
    const response = await $fetch<{
      success: true;
      data: { daily: boolean; learning: boolean };
    }>("/api/apps/status");
    serviceStatus.value = response.data;
  } catch {
    serviceStatus.value = null;
  }
});
</script>

<style scoped>
.launcher {
  display: flex;
  min-height: calc(100dvh - 74px);
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4);
}

.launcher__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.launcher__eyebrow {
  margin-bottom: var(--space-1);
  color: var(--color-primary);
  font-size: var(--text-xs);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.launcher__header h1 {
  max-width: 360px;
  font-size: var(--text-2xl);
}

.launcher__account {
  display: grid;
  width: var(--target-touch);
  height: var(--target-touch);
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-content-secondary);
}

.launcher__apps {
  display: grid;
  gap: var(--space-4);
}

.launcher-card {
  position: relative;
  display: grid;
  /* min-height: 190px; */
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: var(--space-4);
  overflow: hidden;
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-content-on-surface);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.launcher-card:hover {
  border-color: var(--color-primary);
}

.launcher-card__icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: var(--radius-lg);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.launcher-card--learning .launcher-card__icon {
  background: var(--color-surface-strong);
  color: var(--color-accent-indigo);
}

.launcher-card__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.launcher-card__main strong {
  font-size: var(--text-2xl);
}

.launcher-card__main > span:last-child,
.launcher__shared {
  color: var(--color-content-secondary);
  line-height: 1.5;
}

.launcher-card__eyebrow {
  color: var(--color-content-disabled);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.launcher-card__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-warning);
  font-size: var(--text-xs);
  font-weight: 650;
}

.launcher-card__arrow {
  width: 20px;
  height: 20px;
  margin-top: var(--space-4);
  color: var(--color-content-disabled);
}

.launcher__shared {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: auto;
  text-align: center;
  font-size: var(--text-xs);
}
</style>
