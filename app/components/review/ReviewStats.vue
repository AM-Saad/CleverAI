<template>
  <FeatureReviewStats v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewStats from "~/features/review/components/ReviewStats.vue";

const FeatureReviewStats = RawFeatureReviewStats as Component;
</script>
