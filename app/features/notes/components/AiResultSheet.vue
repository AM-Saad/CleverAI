<template>
  <UiSheet :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div class="ai-res__head">
        <RewardGradient class="ai-res__tile">
          <UiIcon name="i-lucide-sparkles" class="h-4 w-4 text-white" />
        </RewardGradient>
        <div>
          <ui-title tag="h2" class="ai-res__title">AI · Generated cards</ui-title>
          <p class="ai-res__sub">{{ subtitle }}</p>
        </div>
      </div>
    </template>

    <!-- streaming -->
    <div v-if="loading" class="ai-res__loading">
      <AiShimmer />
      <AiShimmer />
    </div>

    <div v-else-if="error" class="ai-res__error">
      <UiIcon name="i-lucide-triangle-alert" class="h-6 w-6 text-error-text" />
      <p>{{ error }}</p>
      <UiButton size="sm" @click="emit('retry')">Try again</UiButton>
    </div>

    <ul v-else class="ai-res__list">
      <li v-for="(c, i) in cards" :key="i" class="ai-res__card">
        <span class="ai-res__q-label">Q</span>
        <p class="ai-res__q">{{ c.front }}</p>
        <div class="ai-res__div" />
        <p class="ai-res__a">{{ c.back }}</p>
      </li>
    </ul>

    <template #footer>
      <div class="ai-res__footer">
        <UiButton variant="ghost" tone="neutral" :disabled="loading" @click="emit('edit')">Edit</UiButton>
        <UiButton tone="primary" block :loading="committing" :disabled="loading || !cards.length" @click="emit('commit')">
          Add {{ cards.length }} to review
        </UiButton>
      </div>
    </template>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * AiResultSheet — the human-review gate. AI output is shown here (with the
 * streaming shimmer) and only enters the SM-2 queue when the user taps
 * "Add N to review". Never auto-adds.
 */
import { computed } from "vue";
import RewardGradient from "~/components/ui/RewardGradient.vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  committing?: boolean;
  error?: string | null;
  cards: { front: string; back: string }[];
  sourceLabel?: string;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "edit"): void;
  (e: "commit"): void;
  (e: "retry"): void;
}>();

const subtitle = computed(() => {
  if (props.loading) return "Generating from your selection…";
  const n = props.cards.length;
  return `${props.sourceLabel ?? "From your selected passage"} · ${n} card${n === 1 ? "" : "s"}`;
});
</script>

<style scoped>
.ai-res__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.ai-res__tile {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-xl);
  flex-shrink: 0;
}
.ai-res__title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.ai-res__sub {
  font-size: 12px;
  color: var(--color-content-secondary);
}
.ai-res__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}
.ai-res__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) 0;
  text-align: center;
  color: var(--color-content-secondary);
}
.ai-res__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}
.ai-res__card {
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-secondary);
}
.ai-res__q-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--color-content-secondary);
}
.ai-res__q {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.ai-res__div {
  height: 1px;
  background: var(--color-secondary);
  margin: var(--space-3) 0;
}
.ai-res__a {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-content-on-surface);
}
.ai-res__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
