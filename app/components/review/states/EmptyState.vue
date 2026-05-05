<template>
  <FeatureEmptyState v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureEmptyState from "~/features/review/components/states/EmptyState.vue";

const FeatureEmptyState = RawFeatureEmptyState as Component;
</script>
