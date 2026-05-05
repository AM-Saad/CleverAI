<template>
  <FeatureReviewStatusCard v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewStatusCard from "~/features/review/components/ReviewStatusCard.vue";

const FeatureReviewStatusCard = RawFeatureReviewStatusCard as Component;
</script>
