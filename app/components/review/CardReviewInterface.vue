<template>
  <FeatureCardReviewInterface v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureCardReviewInterface from "~/features/review/components/CardReviewInterface.vue";

const FeatureCardReviewInterface = RawFeatureCardReviewInterface as Component;
</script>
