<template>
  <div class="time-missions">
    <div class="time-missions__header">
      <UiTitle tag="h3" size="base" weight="bold">
        Time-Boxed Micro-Missions
      </UiTitle>
      <UiParagraph size="xs" color="content-secondary">
        Choose a session matching your available time right now
      </UiParagraph>
    </div>

    <div class="time-missions__grid">
      <!-- 3 Min Mission -->
      <NuxtLink to="/review" class="mission-card mission-card--burst">
        <div class="mission-card__badge">⚡ 3 Mins</div>
        <div class="mission-card__content">
          <strong class="mission-card__title">Micro-Burst Review</strong>
          <p class="mission-card__desc">
            Salvage 5 urgent due cards to keep your daily streak alive.
          </p>
        </div>
        <div class="mission-card__footer">
          <span>Start Burst</span>
          <UiIcon name="arrow-right" class="h-4 w-4" />
        </div>
      </NuxtLink>

      <!-- 10 Min Mission -->
      <NuxtLink
        to="/review?mode=weakness"
        class="mission-card mission-card--drill"
      >
        <div class="mission-card__badge">🎯 10 Mins</div>
        <div class="mission-card__content">
          <strong class="mission-card__title">Weakness Targeted Drill</strong>
          <p class="mission-card__desc">
            Focus specifically on cards with SM-2 Ease Factor &lt; 2.0.
          </p>
        </div>
        <div class="mission-card__footer">
          <span>Start Drill</span>
          <UiIcon name="arrow-right" class="h-4 w-4" />
        </div>
      </NuxtLink>

      <!-- 15 Min Mission -->
      <NuxtLink to="/materials" class="mission-card mission-card--synthesis">
        <div class="mission-card__badge">🚀 15 Mins</div>
        <div class="mission-card__content">
          <strong class="mission-card__title">AI Document Synthesis</strong>
          <p class="mission-card__desc">
            Convert raw notes or uploaded PDFs into new AI flashcards.
          </p>
        </div>
        <div class="mission-card__footer">
          <span>Open Materials</span>
          <UiIcon name="arrow-right" class="h-4 w-4" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
// Component logic
</script>

<style scoped>
.time-missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.time-missions__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .time-missions__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.mission-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-secondary);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mission-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--color-accent-indigo) 40%, transparent);
  box-shadow: var(--shadow-card-hover);
}

.mission-card__badge {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  width: fit-content;
  background: var(--color-surface-subtle);
  color: var(--color-content-on-surface-strong);
}

.mission-card--burst .mission-card__badge {
  background: color-mix(in srgb, var(--color-error) 15%, transparent);
  color: var(--color-error-text);
}
.mission-card--drill .mission-card__badge {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning-text);
}
.mission-card--synthesis .mission-card__badge {
  background: color-mix(in srgb, var(--color-accent-indigo) 15%, transparent);
  color: var(--color-accent-indigo);
}

.mission-card__title {
  display: block;
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-sm);
  font-weight: 700;
  margin-bottom: 2px;
}

.mission-card__desc {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
}

.mission-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-accent-indigo);
  font-size: var(--text-xs);
  font-weight: 600;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-secondary);
}
</style>
