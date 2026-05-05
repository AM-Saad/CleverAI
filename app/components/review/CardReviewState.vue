<template>
  <FeatureCardReviewState v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureCardReviewState from "~/features/review/components/CardReviewState.vue";

const FeatureCardReviewState = RawFeatureCardReviewState as Component;
</script>
