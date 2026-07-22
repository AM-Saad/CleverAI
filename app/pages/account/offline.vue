<template>
  <AccountPageFrame
    title="Offline sync"
    subtitle="Downloads, pending changes, and conflict resolution."
  >
    <OfflineSyncCenter />
  </AccountPageFrame>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });
</script>
