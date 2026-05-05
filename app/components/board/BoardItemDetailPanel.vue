<template>
  <FeatureBoardItemDetailPanel v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardItemDetailPanel from "~/features/board/components/BoardItemDetailPanel.vue";

const FeatureBoardItemDetailPanel = RawFeatureBoardItemDetailPanel as Component;
</script>
