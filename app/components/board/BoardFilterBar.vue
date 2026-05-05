<template>
  <FeatureBoardFilterBar v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureBoardFilterBar from "~/features/board/components/BoardFilterBar.vue";

const FeatureBoardFilterBar = RawFeatureBoardFilterBar as Component;
</script>
