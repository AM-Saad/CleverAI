<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
await navigateTo("/language/settings", { replace: true });
</script>
