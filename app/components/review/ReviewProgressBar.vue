<template>
  <FeatureReviewProgressBar v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewProgressBar from "~/features/review/components/ReviewProgressBar.vue";

const FeatureReviewProgressBar = RawFeatureReviewProgressBar as Component;
</script>
