<template>
  <div class="account-frame">
    <AppPageHeader
      :title="title"
      :subtitle="subtitle"
      :back-to="effectiveBackTo"
      :back-label="effectiveBackLabel"
    >
      <template v-if="$slots.action" #actions><slot name="action" /></template>
    </AppPageHeader>
    <main class="account-frame__content"><slot /></main>
  </div>
</template>

<script setup lang="ts">
import AppPageHeader from "~/components/patterns/AppPageHeader.vue";
import { useAccountContext } from "~/composables/account/useAccountContext";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    backTo?: string | Record<string, unknown>;
    backLabel?: string;
  }>(),
  { subtitle: "", backTo: undefined, backLabel: undefined },
);
const accountContext = useAccountContext();
const effectiveBackTo = computed(
  () => props.backTo ?? accountContext.accountHome.value,
);
const effectiveBackLabel = computed(() => props.backLabel ?? "Back to account");
</script>

<style scoped>
.account-frame {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-4) var(--space-8);
}
.account-frame__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
