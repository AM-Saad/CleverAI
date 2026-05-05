<template>
  <FeatureEnrollButton v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureEnrollButton from "~/features/review/components/EnrollButton.vue";

const FeatureEnrollButton = RawFeatureEnrollButton as Component;
</script>
