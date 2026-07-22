<template>
  <div class="day-redirect">Opening today…</div>
</template>

<script setup lang="ts">
import { dateKeyInTimeZone } from "@shared/utils/daily-recurrence";

definePageMeta({ middleware: "auth" });
const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";
await navigateTo(`/day/${dateKeyInTimeZone(new Date(), timeZone)}`, {
  replace: true,
});
</script>

<style scoped>
.day-redirect {
  display: grid;
  min-height: 60dvh;
  place-items: center;
  color: var(--color-content-secondary);
}
</style>
