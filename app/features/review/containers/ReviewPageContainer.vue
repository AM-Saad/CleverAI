<template>
  <ReviewSessionView :workspace-id="workspaceId" close-to="/workspaces" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import ReviewSessionView from "~/features/review/components/ReviewSessionView.vue";

const route = useRoute();

const workspaceId = computed(() => {
  const id = route.query.workspaceId;
  return typeof id === "string" ? id : undefined;
});
</script>
