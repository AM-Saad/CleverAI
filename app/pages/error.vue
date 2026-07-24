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
  <main class="min-h-screen bg-background text-content-on-background flex items-center justify-center px-6">
    <UiPanel tag="section" variant="surface" size="lg" shadow="md" class-name="w-full">
      <UiLabel tag="p" size="sm" weight="bold" color="content-secondary" uppercase>Error</UiLabel>
      <UiTitle tag="h1" size="2xl" weight="semibold" class="mt-2">Something went wrong</UiTitle>
      <p class="mt-3 text-sm text-content-secondary break-words">{{ message }}</p>

      <UiButton class="mt-5" tone="primary" to="/">
        Home
      </UiButton>
    </UiPanel>
  </main>
</template>
