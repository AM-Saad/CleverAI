<template>
  <div class="account-frame">
    <header class="account-frame__header">
      <UiIconButton
        class="account-frame__back"
        icon="i-lucide-chevron-left"
        :label="backLabel"
        @click="goBack"
      />

      <div class="account-frame__heading">
        <ui-title tag="h1" size="2xl" weight="extrabold" color="content-on-surface-strong" class="account-frame__title">{{ title }}</ui-title>
        <p v-if="subtitle" class="account-frame__subtitle">
          {{ subtitle }}
        </p>
      </div>

      <div v-if="$slots.action" class="account-frame__action">
        <slot name="action" />
      </div>
    </header>

    <main class="account-frame__content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    backTo?: string;
    backLabel?: string;
  }>(),
  {
    subtitle: "",
    backTo: "/account",
    backLabel: "Back to account",
  },
);

function goBack() {
  navigateTo(props.backTo);
}
</script>

<style scoped>
.account-frame {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.account-frame__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.account-frame__back {
  margin-left: calc(-1 * var(--space-2));
}

.account-frame__heading {
  min-width: 0;
  flex: 1;
}

.account-frame__subtitle {
  font-size: 13px;
  color: var(--color-content-secondary);
}

.account-frame__action {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.account-frame__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
