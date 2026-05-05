<template>
  <FeatureSessionTimer v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureSessionTimer from "~/features/review/components/SessionTimer.vue";

const FeatureSessionTimer = RawFeatureSessionTimer as Component;
</script>
