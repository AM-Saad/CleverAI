<template>
  <FeatureNavigationControls v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureNavigationControls from "~/features/review/components/NavigationControls.vue";

const FeatureNavigationControls = RawFeatureNavigationControls as Component;
</script>
