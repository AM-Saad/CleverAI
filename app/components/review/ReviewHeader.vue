<template>
  <FeatureReviewHeader v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureReviewHeader from "~/features/review/components/ReviewHeader.vue";

const FeatureReviewHeader = RawFeatureReviewHeader as Component;
</script>
