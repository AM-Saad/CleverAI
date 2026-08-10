<template>
  <div class="cognitive-banner" :class="`cognitive-banner--${stateMeta.type}`">
    <div class="cognitive-banner__glow" aria-hidden="true" />

    <div class="cognitive-banner__content">
      <div class="cognitive-banner__badge">
        <span class="cognitive-banner__pulse" />
        <UiIcon :name="stateMeta.icon" class="h-4 w-4" />
        <span class="cognitive-banner__status-text">{{ stateMeta.badge }}</span>
      </div>

      <div class="cognitive-banner__text">
        <UiTitle tag="h2" size="lg" weight="bold">
          {{ stateMeta.title }}
        </UiTitle>
        <UiParagraph size="sm" color="content-secondary">
          {{ stateMeta.description }}
        </UiParagraph>
      </div>

      <div class="cognitive-banner__action">
        <UiButton
          :to="stateMeta.actionLink"
          size="md"
          :variant="stateMeta.actionVariant"
          class="cognitive-banner__btn"
        >
          <template #leading>
            <UiIcon :name="stateMeta.actionIcon" class="h-4 w-4" />
          </template>
          {{ stateMeta.actionText }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type StateType = "flow" | "decay" | "seeding" | "fortress";

const props = defineProps<{
  dueCount: number;
  totalCards: number;
  materialsCount: number;
  streak: number;
}>();

const stateType = computed<StateType>(() => {
  if (props.dueCount > 0) return "decay";
  if (props.streak >= 3 && props.dueCount === 0) return "flow";
  if (props.totalCards < 5 && props.materialsCount > 0) return "seeding";
  return "fortress";
});

const stateMeta = computed(() => {
  switch (stateType.value) {
    case "decay":
      return {
        type: "decay",
        icon: "circle-alert",
        badge: "Decay Danger Zone",
        title: `${props.dueCount} concept${props.dueCount === 1 ? "" : "s"} slipping into memory fog`,
        description:
          "Review now to prevent Ebbinghaus memory decay before retention drops below optimal threshold.",
        actionText: "Start 4-Min Salvage",
        actionLink: "/review",
        actionIcon: "zap",
        actionVariant: "solid" as const,
      };
    case "flow":
      return {
        type: "flow",
        icon: "flame",
        badge: `High Velocity • ${props.streak} Day Streak`,
        title: "Mind in Overdrive — Peak Retention Achieved",
        description:
          "Your neural connections are strong. Take on an AI challenger quiz or absorb a new document.",
        actionText: "Take AI Quiz",
        actionLink: "/review?mode=quiz",
        actionIcon: "brain",
        actionVariant: "solid" as const,
      };
    case "seeding":
      return {
        type: "seeding",
        icon: "sparkles",
        badge: "Knowledge Seeding Phase",
        title: "Unprocessed Wisdom Waiting",
        description:
          "You have source materials uploaded. Generate AI flashcards & quizzes to build your memory network.",
        actionText: "Synthesize Cards",
        actionLink: "/materials",
        actionIcon: "sparkles",
        actionVariant: "solid" as const,
      };
    case "fortress":
    default:
      return {
        type: "fortress",
        icon: "shield-check",
        badge: "Memory Fortress Secure",
        title: "All Memory Nodes Fortified Today",
        description:
          "Zero cards due. Your long-term memory stability is projected at 94%+ across all active topics.",
        actionText: "Explore Word Bank",
        actionLink: "/language",
        actionIcon: "compass",
        actionVariant: "soft" as const,
      };
  }
});
</script>

<style scoped>
.cognitive-banner {
  position: relative;
  overflow: hidden;
  padding: var(--component-card-padding-xl);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--banner-border);
  background: var(--banner-bg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.cognitive-banner--decay {
  --banner-bg: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-error) 8%, transparent) 0%,
    color-mix(in srgb, var(--color-warning) 5%, transparent) 100%
  );
  --banner-border: color-mix(in srgb, var(--color-warning) 30%, transparent);
  --badge-bg: color-mix(in srgb, var(--color-warning) 15%, transparent);
  --badge-text: var(--color-warning-text);
}

.cognitive-banner--flow {
  --banner-bg: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-success) 8%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-teal) 6%, transparent) 100%
  );
  --banner-border: color-mix(in srgb, var(--color-success) 30%, transparent);
  --badge-bg: color-mix(in srgb, var(--color-success) 15%, transparent);
  --badge-text: var(--color-success-text);
}

.cognitive-banner--seeding {
  --banner-bg: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-indigo) 8%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-purple) 6%, transparent) 100%
  );
  --banner-border: color-mix(
    in srgb,
    var(--color-accent-indigo) 30%,
    transparent
  );
  --badge-bg: color-mix(in srgb, var(--color-accent-indigo) 15%, transparent);
  --badge-text: var(--color-accent-indigo);
}

.cognitive-banner--fortress {
  --banner-bg: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-warning) 8%, transparent) 0%,
    color-mix(in srgb, var(--color-accent-orange) 5%, transparent) 100%
  );
  --banner-border: color-mix(in srgb, var(--color-warning) 30%, transparent);
  --badge-bg: color-mix(in srgb, var(--color-warning) 15%, transparent);
  --badge-text: var(--color-warning-text);
}

.cognitive-banner__glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--badge-bg) 0%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
  opacity: 0.6;
}

.cognitive-banner__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .cognitive-banner__content {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--space-4);
  }
}

.cognitive-banner__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--badge-bg);
  color: var(--badge-text);
  font-size: var(--text-xs);
  font-weight: 600;
  width: fit-content;
}

.cognitive-banner__pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}

.cognitive-banner__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cognitive-banner__action {
  margin-top: var(--space-2);
}

@media (min-width: 640px) {
  .cognitive-banner__action {
    margin-top: 0;
    grid-column: 2;
    grid-row: 1 / span 2;
  }
}
</style>
