<template>
  <div class="day-redirect">Opening today…</div>
</template>

<script setup lang="ts">
import { dateKeyInTimeZone } from "@shared/utils/daily-recurrence";

definePageMeta({ middleware: "auth" });
const route = useRoute();
const timeZone = import.meta.client
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";
const addTask = route.query.addTask;
await navigateTo(
  {
    path: `/day/${dateKeyInTimeZone(new Date(), timeZone)}`,
    query: addTask ? { addTask } : undefined,
  },
  { replace: true },
);
</script>

<style scoped>
.day-redirect {
  display: grid;
  min-height: 60dvh;
  place-items: center;
  color: var(--color-content-secondary);
}
</style>
