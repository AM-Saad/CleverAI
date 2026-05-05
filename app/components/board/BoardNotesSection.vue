<template>
  <FeatureBoardNotesSection v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardNotesSection from "~/features/board/containers/BoardNotesSection.vue";

const FeatureBoardNotesSection = RawFeatureBoardNotesSection as Component;
</script>
