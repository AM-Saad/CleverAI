<template>
  <svg
    viewBox="0 0 24 24"
    role="img"
    aria-label="Apps"
    fill="none"
    v-bind="$attrs"
  >
    <path
      d="M7.5 5.5h3.25c1.1 0 2 .9 2 2v3.25"
      stroke="var(--color-primary)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M16.5 18.5h-3.25c-1.1 0-2-.9-2-2v-3.25"
      stroke="var(--color-success)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M7.5 18.5h-1a2 2 0 0 1-2-2v-1"
      stroke="var(--color-warning)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M16.5 5.5h1a2 2 0 0 1 2 2v1"
      stroke="var(--color-accent-pink)"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <rect x="4.5" y="4.5" width="5" height="5" rx="1.4" stroke="var(--color-primary)" stroke-width="1.8" />
    <rect x="14.5" y="4.5" width="5" height="5" rx="1.4" stroke="var(--color-accent-pink)" stroke-width="1.8" />
    <rect x="4.5" y="14.5" width="5" height="5" rx="1.4" stroke="var(--color-warning)" stroke-width="1.8" />
    <rect x="14.5" y="14.5" width="5" height="5" rx="1.4" stroke="var(--color-success)" stroke-width="1.8" />
  </svg>
</template>
