<template>
  <FeatureBoardTagFilter v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardTagFilter from "~/features/board/components/BoardTagFilter.vue";

const FeatureBoardTagFilter = RawFeatureBoardTagFilter as Component;
</script>
