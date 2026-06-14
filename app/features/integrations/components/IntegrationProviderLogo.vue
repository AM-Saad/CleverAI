<script setup lang="ts">
import type { IntegrationProvider } from "@@/shared/utils/workspaceIntegration.contract";

defineProps<{
  provider: IntegrationProvider;
}>();
</script>

<template>
  <svg
    v-if="provider === 'jira'"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Jira"
    fill="none"
    v-bind="$attrs"
  >
    <path
      d="M29.21 14.64 17.36 2.79a1.86 1.86 0 0 0-2.64 0L2.79 14.72a1.86 1.86 0 0 0 0 2.64l11.85 11.85a1.86 1.86 0 0 0 2.64 0l11.93-11.93a1.86 1.86 0 0 0 0-2.64Z"
      fill="var(--color-primary)"
    />
    <path
      d="M16.01 8.3 8.3 16.01l7.7 7.7 1.7-1.7-4.8-4.8h10.8v-2.4H12.9l4.8-4.8-1.69-1.71Z"
      fill="var(--color-white)"
      opacity=".95"
    />
    <path
      d="M18.1 8.3 16.4 10l4.81 4.81H10.42v2.4h10.79l-4.81 4.8 1.7 1.7 7.7-7.7-7.7-7.71Z"
      fill="var(--color-accent-blue)"
      opacity=".82"
    />
  </svg>

  <svg
    v-else
    viewBox="0 0 32 32"
    role="img"
    aria-label="Notion"
    fill="none"
    v-bind="$attrs"
  >
    <rect x="3.5" y="3.5" width="25" height="25" rx="4" fill="var(--color-white)" />
    <rect x="3.5" y="3.5" width="25" height="25" rx="4" stroke="var(--color-content-on-surface)" stroke-width="2" />
    <path
      d="M10 10.4 12.25 10l9.25.55 1.5 1.15v10.1l-1.4.8-2.05.18-7.95-.5L10 21.05V10.4Z"
      fill="var(--color-content-on-surface)"
    />
    <path
      d="M13.05 13.05v6.82l1.45.12v-4.75l3.7 5.05 1.55.1v-7.2l-1.4-.08v4.62l-3.58-4.8-1.72.12Z"
      fill="var(--color-white)"
    />
  </svg>
</template>
