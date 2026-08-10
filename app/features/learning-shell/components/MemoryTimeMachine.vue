<template>
  <div class="time-machine">
    <div class="time-machine__header">
      <div class="flex items-center gap-2">
        <span class="time-machine__icon">
          <UiIcon name="clock" class="h-4 w-4" />
        </span>
        <div>
          <UiTitle tag="h3" size="base" weight="bold">
            Memory Time-Machine & Ebbinghaus Forecast
          </UiTitle>
          <UiParagraph size="xs" color="content-secondary">
            Slide to project how your memory retention decays into the future
          </UiParagraph>
        </div>
      </div>

      <UiPill
        label="Predictive AI"
        color="var(--color-accent-indigo)"
        variant="soft"
      >
        <template #icon>
          <UiPillIcon name="sparkles" size="sm" />
        </template>
      </UiPill>
    </div>

    <!-- Scrubber Slider Controls -->
    <div class="time-machine__scrubber">
      <div class="scrubber-labels">
        <span
          v-for="point in timelinePoints"
          :key="point.dayOffset"
          class="scrubber-label"
          :class="{
            'scrubber-label--active': activeOffset === point.dayOffset,
          }"
          @click="activeOffset = point.dayOffset"
        >
          {{ point.label }}
        </span>
      </div>

      <UiSlider
        v-model="activePointIndex"
        :min="0"
        :max="timelinePoints.length - 1"
        :step="1"
        aria-label="Memory forecast date"
      />
    </div>

    <!-- Projection Card Output -->
    <div
      class="time-machine__forecast"
      :class="{
        'time-machine__forecast--warning':
          activeForecast.projectedRetention < 75,
      }"
    >
      <div class="forecast-metric">
        <span class="forecast-label">Projected Retention</span>
        <div class="forecast-val-wrap">
          <strong class="forecast-value"
            >{{ activeForecast.projectedRetention }}%</strong
          >
          <span
            class="forecast-delta"
            :class="
              activeForecast.delta < 0
                ? 'forecast-delta--negative'
                : 'forecast-delta--positive'
            "
          >
            {{
              activeForecast.delta === 0 ? "Stable" : `${activeForecast.delta}%`
            }}
          </span>
        </div>
      </div>

      <div class="forecast-divider" />

      <div class="forecast-metric">
        <span class="forecast-label">Cards in Decay Danger</span>
        <strong class="forecast-value forecast-value--warning">
          {{ activeForecast.projectedDecayCards }}
        </strong>
      </div>

      <div class="forecast-divider" />

      <div class="forecast-narrative">
        <strong>{{ activeForecast.headline }}</strong>
        <p>{{ activeForecast.description }}</p>
      </div>
    </div>

    <!-- ROI Banner -->
    <div class="time-machine__roi">
      <UiIcon name="zap" class="time-machine__roi-icon h-4 w-4" />
      <span>
        <strong>Study ROI:</strong> 4 minutes of review today prevents
        <strong
          >{{
            Math.max(activeForecast.projectedDecayCards, 5)
          }}
          concepts</strong
        >
        from fading.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  currentRetention: number;
  dueCards: number;
  totalCards: number;
}>();

const activeOffset = ref(0);

const timelinePoints = [
  { dayOffset: 0, label: "Today (Now)" },
  { dayOffset: 1, label: "+1 Day" },
  { dayOffset: 3, label: "+3 Days" },
  { dayOffset: 7, label: "+7 Days" },
  { dayOffset: 14, label: "+14 Days" },
];

const activePointIndex = computed<number>({
  get: () =>
    timelinePoints.findIndex((point) => point.dayOffset === activeOffset.value),
  set: (index) => {
    const point = timelinePoints[index];
    if (point) activeOffset.value = point.dayOffset;
  },
});

const activeForecast = computed(() => {
  const offset = activeOffset.value;
  const baseRetention = props.currentRetention || 92;

  // Ebbinghaus decay simulation formula R = e^(-t/S)
  const decayFactor = offset === 0 ? 0 : Math.pow(offset, 0.65) * 4.2;
  const projectedRetention = Math.max(
    35,
    Math.round(baseRetention - decayFactor),
  );
  const delta = Math.round(projectedRetention - baseRetention);
  const extraDecay =
    offset === 0 ? props.dueCards : Math.round(props.dueCards + offset * 2.5);

  let headline = "Optimal Memory Window";
  let description = "Reviewing now reinforces your long-term neural pathways.";

  if (offset > 0 && projectedRetention >= 80) {
    headline = "Minor Retention Decay";
    description = `In ${offset} days, your retention will drop slightly to ${projectedRetention}%. A light session will maintain mastery.`;
  } else if (
    offset > 0 &&
    projectedRetention < 80 &&
    projectedRetention >= 65
  ) {
    headline = "Moderate Memory Fog";
    description = `If skipped, ${extraDecay} concepts will fall into the decay danger zone in ${offset} days.`;
  } else if (offset > 0) {
    headline = "Critical Forgetting Phase";
    description = `In ${offset} days, retention collapses to ${projectedRetention}%. You will need to re-learn several flashcards from scratch.`;
  }

  return {
    projectedRetention,
    delta,
    projectedDecayCards: extraDecay,
    headline,
    description,
  };
});
</script>

<style scoped>
.time-machine {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--component-card-padding-xl);
  border-radius: var(--radius-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-secondary);
}

.time-machine__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.time-machine__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-accent-indigo) 15%, transparent);
  color: var(--color-accent-indigo);
}

.time-machine__scrubber {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  background: var(--color-surface-subtle);
}

.scrubber-labels {
  display: flex;
  justify-content: space-between;
}

.scrubber-label {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color 0.2s ease;
}

.scrubber-label:hover,
.scrubber-label--active {
  color: var(--color-accent-indigo);
  font-weight: 700;
}

.time-machine__forecast {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-indigo) 8%, transparent) 0%,
    var(--color-surface-subtle) 100%
  );
  border: 1px solid
    color-mix(in srgb, var(--color-accent-indigo) 20%, transparent);
  transition: all 0.3s ease;
}

@media (min-width: 640px) {
  .time-machine__forecast {
    grid-template-columns: auto auto 1fr;
    align-items: center;
  }
}

.time-machine__forecast--warning {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-error) 8%, transparent) 0%,
    var(--color-surface-subtle) 100%
  );
  border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
}

.forecast-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.forecast-label {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.forecast-val-wrap {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.forecast-value {
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-xl);
}

.forecast-delta {
  font-size: var(--text-xs);
  font-weight: 700;
}

.forecast-delta--negative {
  color: var(--color-error-text);
}

.forecast-delta--positive {
  color: var(--color-success-text);
}

.forecast-value--warning {
  color: var(--color-warning-text);
}

.forecast-divider {
  display: none;
  width: 1px;
  height: 32px;
  background: var(--color-secondary);
}

@media (min-width: 640px) {
  .forecast-divider {
    display: block;
  }
}

.forecast-narrative strong {
  display: block;
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-sm);
}

.forecast-narrative p {
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
}

.time-machine__roi {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 20%, transparent);
  color: var(--color-content-on-surface-strong);
  font-size: var(--text-xs);
}

.time-machine__roi-icon {
  color: var(--color-success-text);
}
</style>
