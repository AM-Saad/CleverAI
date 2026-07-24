<template>
  <header class="app-page-header">
    <div class="app-page-header__leading">
      <UiIconButton
        v-if="backTo"
        icon="i-lucide-chevron-left"
        :label="backLabel ?? 'Back'"
        size="sm"
        @click="navigateTo(backTo)"
      />
      <NuxtLink v-else to="/" class="app-page-header__apps">
        <UiIcon name="i-lucide-layout-grid" class="h-4 w-4" />
        Apps
      </NuxtLink>
      <div class="min-w-0">
        <UiLabel v-if="eyebrow" tag="p" size="sm" weight="bold" color="primary" uppercase>{{ eyebrow }}</UiLabel>
        <UiTitle tag="h1" size="xl" weight="bold" color="content-on-background">
          {{ title }}
        </UiTitle>
        <UiParagraph v-if="subtitle" size="xs" color="content-secondary">
          {{ subtitle }}
        </UiParagraph>
      </div>
    </div>
    <div class="app-page-header__actions">
      <slot name="actions" />
      <NuxtLink
        v-if="accountTo"
        :to="accountTo"
        class="app-page-header__account"
        :aria-label="accountLabel ?? 'Account settings'"
      >
        <UiIcon name="i-lucide-user-round" class="h-5 w-5" />
      </NuxtLink>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backTo?: string | Record<string, unknown>;
  backLabel?: string;
  accountTo?: string | Record<string, unknown>;
  accountLabel?: string;
}>();
</script>

<style scoped>
.app-page-header {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.app-page-header__leading,
.app-page-header__actions,
.app-page-header__apps,
.app-page-header__account {
  display: flex;
  align-items: center;
}

.app-page-header__leading {
  min-width: 0;
  gap: var(--space-2);
}
.app-page-header__actions {
  flex-shrink: 0;
  gap: var(--space-2);
}
.app-page-header__apps {
  gap: var(--space-2);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
  font-weight: 700;
}
.app-page-header__account {
  width: var(--target-touch);
  height: var(--target-touch);
  justify-content: center;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
  color: var(--color-content-secondary);
}
</style>
