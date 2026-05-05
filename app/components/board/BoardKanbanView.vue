<template>
  <FeatureBoardKanbanView v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardKanbanView from "~/features/board/components/BoardKanbanView.vue";

const FeatureBoardKanbanView = RawFeatureBoardKanbanView as Component;
</script>
