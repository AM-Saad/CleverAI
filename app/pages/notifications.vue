<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
await navigateTo({ path: "/account/notifications" }, { replace: true });
</script>
