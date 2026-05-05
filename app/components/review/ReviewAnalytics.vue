<template>
  <FeatureReviewAnalytics v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewAnalytics from "~/features/review/components/ReviewAnalytics.vue";

const FeatureReviewAnalytics = RawFeatureReviewAnalytics as Component;
</script>
