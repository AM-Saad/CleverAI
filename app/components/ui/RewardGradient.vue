<template>
  <component
    :is="tag"
    :class="['ds-reward-gradient', text ? 'ds-reward-gradient--text' : '', className]"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
/**
 * RewardGradient — the ONLY sanctioned surface for `--ds-brand-gradient`
 * (cyan→pink→gold). Per the handoff, the brand gradient is a reward signal used
 * in exactly four places: review session summary, the language translation
 * reveal, the AI streaming shimmer, and achievements. Route every brand-gradient
 * need through this component so the four usages stay grep-able and disciplined.
 *
 * - default: gradient fill background.
 * - `text`: clips the gradient to the text (transparent text).
 */
withDefaults(
  defineProps<{
    tag?: string;
    /** Clip the gradient to text instead of filling the background. */
    text?: boolean;
    className?: string;
  }>(),
  { tag: "div", text: false, className: "" },
);
</script>

<style scoped>
.ds-reward-gradient {
  background-image: var(--ds-brand-gradient);
}
.ds-reward-gradient--text {
  background-image: var(--ds-brand-gradient);
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
}
</style>
