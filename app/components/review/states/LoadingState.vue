<template>
  <FeatureLoadingState v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureLoadingState from "~/features/review/components/states/LoadingState.vue";

const FeatureLoadingState = RawFeatureLoadingState as Component;
</script>
