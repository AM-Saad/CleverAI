<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
await navigateTo({ path: "/account/profile" }, { replace: true });
</script>
