<template>
  <div class="auth-step-field-stack">
    <div
      class="auth-step-field-stack__fields"
      :class="{
        'auth-step-field-stack__fields--complete': firstComplete,
        'auth-step-field-stack__fields--revealed': reveal,
      }"
    >
      <div class="auth-step-field-stack__field">
        <slot name="first" />
      </div>

      <Transition name="auth-step-field" appear>
        <div
          v-if="reveal"
          class="auth-step-field-stack__field auth-step-field-stack__field--second"
        >
          <slot name="second" />
        </div>
      </Transition>

      <UiButton
        class="auth-step-field-stack__submit"
        :class="{ 'auth-step-field-stack__submit--loading': loading }"
        type="submit"
        :disabled="submitDisabled || loading"
        :title="submitLabel"
        :aria-label="submitLabel"
        :aria-busy="loading ? 'true' : undefined"
      >
        <Icon
          :name="loading ? 'uil:redo' : submitIcon"
          class="auth-step-field-stack__submit-icon"
          aria-hidden="true"
        />
      </UiButton>
    </div>

    <div
      v-if="(statusVisible && $slots.status) || progressVisible"
      class="auth-step-field-stack__status"
    >
      <div
        v-if="statusVisible && $slots.status"
        class="auth-step-field-stack__status-copy"
      >
        <slot name="status" />
      </div>

      <div
        v-if="progressVisible"
        class="auth-step-field-stack__progress"
        :style="progressVars"
      >
        <span class="auth-step-field-stack__progress-ring" aria-hidden="true">
          <span />
        </span>
        <span
          class="auth-step-field-stack__progress-track"
          role="progressbar"
          :aria-label="progressLabel"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="clampedProgress"
        >
          <span class="auth-step-field-stack__progress-fill" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  reveal = false,
  firstComplete = false,
  loading = false,
  submitDisabled = false,
  submitLabel = "Continue",
  submitIcon = "i-lucide-arrow-right",
  progress = 0,
  progressVisible = false,
  progressLabel = "Progress",
  statusVisible = true,
} = defineProps<{
  reveal?: boolean;
  firstComplete?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  submitIcon?: string;
  progress?: number | null;
  progressVisible?: boolean;
  progressLabel?: string;
  statusVisible?: boolean;
}>();

const clampedProgress = computed(() => {
  const value = Number(progress ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
});

const progressVars = computed(() => ({
  "--auth-step-progress": `${clampedProgress.value}%`,
}));
</script>

<style scoped>
.auth-step-field-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.auth-step-field-stack__fields {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  transition:
    box-shadow var(--duration-normal) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.auth-step-field-stack__fields--complete {
  box-shadow:
    var(--shadow-card),
    inset 3px 0 0 color-mix(in srgb, var(--color-primary) 74%, transparent);
}

.auth-step-field-stack__fields--revealed {
  box-shadow: var(--shadow-card-hover);
}

.auth-step-field-stack__field {
  position: relative;
  z-index: 1;
}

.auth-step-field-stack__field--second {
  margin-top: -1px;
}

.auth-step-field-stack__submit {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 2;
  display: grid;
  width: var(--target-compact);
  height: var(--target-compact);
  cursor: pointer;
  place-items: center;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-white);
  text-align: center;
  transition:
    opacity var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.auth-step-field-stack__submit:hover {
  opacity: 0.9;
  box-shadow: var(--shadow-card-hover);
}

.auth-step-field-stack__submit:active {
  transform: scale(0.98);
}

.auth-step-field-stack__submit:focus-visible {
  outline: 2px solid var(--ds-focus-outline-color);
  outline-offset: 2px;
}

.auth-step-field-stack__submit:disabled {
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.6;
}

.auth-step-field-stack__submit-icon {
  width: 1rem;
  height: 1rem;
}

.auth-step-field-stack__submit--loading .auth-step-field-stack__submit-icon {
  animation: auth-step-spin 900ms linear infinite;
}

.auth-step-field-stack__status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  min-height: var(--target-min);
  color: var(--color-content-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--leading-snug);
}

.auth-step-field-stack__status-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  min-width: 0;
}

.auth-step-field-stack__progress {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 6rem;
}

.auth-step-field-stack__progress-ring {
  position: relative;
  display: inline-grid;
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-full);
  background: conic-gradient(
    var(--color-primary) var(--auth-step-progress),
    var(--color-secondary) 0
  );
}

.auth-step-field-stack__progress-ring span {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: var(--radius-full);
  background: var(--color-background);
}

.auth-step-field-stack__progress-track {
  display: block;
  overflow: hidden;
  width: 4rem;
  height: 0.25rem;
  border-radius: var(--radius-full);
  background: var(--color-secondary);
}

.auth-step-field-stack__progress-fill {
  display: block;
  width: var(--auth-step-progress);
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width var(--duration-normal) var(--ease-standard);
}

.auth-step-field-enter-active,
.auth-step-field-leave-active {
  overflow: hidden;
  transform-origin: top;
  transition:
    opacity var(--duration-slow) var(--ease-standard),
    transform var(--duration-slow) var(--ease-emphasized),
    clip-path var(--duration-slow) var(--ease-standard);
}

.auth-step-field-enter-from,
.auth-step-field-leave-to {
  clip-path: inset(0 0 100% 0);
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.98);
}

.auth-step-field-enter-to,
.auth-step-field-leave-from {
  clip-path: inset(0);
  opacity: 1;
  transform: translateY(0) scale(1);
}

@keyframes auth-step-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-step-field-stack__fields,
  .auth-step-field-stack__progress-fill,
  .auth-step-field-enter-active,
  .auth-step-field-leave-active {
    transition-duration: 0.01ms;
  }

  .auth-step-field-stack__submit--loading .auth-step-field-stack__submit-icon {
    animation-duration: 1.6s;
  }
}
</style>
