<template>
  <FeatureBoardColumn v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardColumn from "~/features/board/components/BoardColumn.vue";

const FeatureBoardColumn = RawFeatureBoardColumn as Component;
</script>
