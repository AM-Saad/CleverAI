<template>
  <SessionSummary
    v-if="finished"
    :xp="xp"
    :cards="reviewedCount"
    :minutes="minutes"
    :streak="streak"
    :accuracy="accuracy"
    :achievement="achievement"
    @done="emit('done')"
  />

  <div v-else class="rev">
    <header class="rev__bar">
      <UiIconButton
        class="rev__close"
        icon="i-lucide-x"
        label="Close review"
        @click="emit('close')"
      />
      <div
        class="rev__progress"
        role="progressbar"
        :aria-valuenow="reviewedCount"
        :aria-valuemax="total"
      >
        <span
          class="rev__progress-fill"
          :style="{ width: progressPct + '%' }"
        />
      </div>
      <UiLabel size="sm" weight="bold" color="content-secondary" class="tabular-nums">{{ currentCountLabel }}</UiLabel>
    </header>

    <div v-if="loading" class="rev__center">
      <UiSkeleton
        class="h-[340px] w-full rounded-[var(--component-card-radius)]"
      />
    </div>

    <div v-else-if="error" class="rev__center rev__msg">
      <UiIcon name="i-lucide-triangle-alert" class="h-8 w-8 text-error-text" />
      <p>{{ error }}</p>
      <UiButton @click="emit('retry')">Try again</UiButton>
    </div>

    <div v-else-if="!hasCard" class="rev__center rev__msg">
      <UiIcon name="i-lucide-party-popper" class="h-9 w-9 text-success-text" />
      <UiTitle tag="div" size="xl" weight="extrabold" tight color="content-on-surface-strong">{{ emptyTitle }}</UiTitle>
      <UiParagraph size="sm" color="content-secondary">{{ emptySubtitle }}</UiParagraph>
      <UiButton tone="primary" @click="emit('close')">
        {{ emptyActionLabel }}
      </UiButton>
    </div>

    <template v-else>
      <div class="rev__body">
        <slot />
      </div>

      <footer class="rev__footer">
        <slot name="footer">
          <UiParagraph size="sm" color="disabled" center>Tap the card to reveal · swipe to grade</UiParagraph>
        </slot>
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import SessionSummary from "~/features/review/components/SessionSummary.vue";

const props = withDefaults(
  defineProps<{
    finished: boolean;
    xp: number;
    reviewedCount: number;
    total: number;
    minutes: number;
    streak: number;
    accuracy: number;
    achievement?: string | null;
    progressPct: number;
    loading?: boolean;
    error?: string | null;
    hasCard: boolean;
    emptyTitle?: string;
    emptySubtitle?: string;
    emptyActionLabel?: string;
  }>(),
  {
    achievement: null,
    loading: false,
    error: null,
    emptyTitle: "All caught up",
    emptySubtitle: "No cards are due right now. Come back later.",
    emptyActionLabel: "Back to home",
  },
);

const emit = defineEmits<{
  close: [];
  done: [];
  retry: [];
}>();

const currentCountLabel = computed(() => {
  if (props.total <= 0) return "0 / 0";
  return `${Math.min(props.reviewedCount + 1, props.total)} / ${props.total}`;
});
</script>

<style scoped>
.rev {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: var(--space-2) 0 calc(var(--space-6) + env(safe-area-inset-bottom));
  gap: var(--space-3);
}
.rev__bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
}
.rev__close {
  margin-left: calc(-1 * var(--space-2));
}
.rev__progress {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
  overflow: hidden;
}
.rev__progress-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  transition: width var(--duration-normal) var(--ease-standard);
}
.rev__body {
  flex: 1;
  display: flex;
  align-items: center;
}
.rev__center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}
.rev__msg {
  text-align: center;
  color: var(--color-content-secondary);
}
.rev__footer {
  min-height: 72px;
}
</style>
