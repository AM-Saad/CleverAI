<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const props = defineProps<{
  error?: Error | { message?: string; statusMessage?: string };
}>();

console.log("Error page loaded with error:", props.error);

const route = useRoute();
const message = computed(() =>
  props.error?.message ||
  (props.error && "statusMessage" in props.error ? props.error.statusMessage : "") ||
  (typeof route.query.error === "string" ? route.query.error : "") ||
  "An unexpected error occurred."
);
</script>

<template>
  <main class="min-h-screen bg-white text-content-on-surface flex items-center justify-center px-6">
    <section class="w-full rounded-[var(--radius-xl)] border border-secondary p-6 shadow-[var(--shadow-dropdown)]">
      <p class="text-xs font-bold uppercase tracking-widest text-content-secondary">Error</p>
      <h1 class="mt-2 text-2xl font-semibold">Something went wrong</h1>
      <p class="mt-3 text-sm text-content-secondary break-words">{{ message }}</p>

      <NuxtLink class="mt-5 inline-flex rounded-[var(--radius-md)] bg-primary px-3 py-2 text-sm font-medium text-white"
        to="/">
        Home
      </NuxtLink>
    </section>
  </main>
</template>
