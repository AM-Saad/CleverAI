<template>
  <FeatureErrorState v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureErrorState from "~/features/review/components/states/ErrorState.vue";

const FeatureErrorState = RawFeatureErrorState as Component;
</script>
