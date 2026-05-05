<template>
  <FeatureBoardListView v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardListView from "~/features/board/components/BoardListView.vue";

const FeatureBoardListView = RawFeatureBoardListView as Component;
</script>
