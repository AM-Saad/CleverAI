<template>
  <FeatureReviewAnalyticsSummary v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewAnalyticsSummary from "~/features/review/components/ReviewAnalyticsSummary.vue";

const FeatureReviewAnalyticsSummary = RawFeatureReviewAnalyticsSummary as Component;
</script>
