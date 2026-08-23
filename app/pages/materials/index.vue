<template>
  <WorkspaceMaterials :show-header="true" />
</template>

<script setup lang="ts">
import WorkspaceMaterials from "~/components/workspace/WorkspaceMaterials.vue";

definePageMeta({ middleware: "auth" });
</script>
