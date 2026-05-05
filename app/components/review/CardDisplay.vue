<template>
  <FeatureCardDisplay v-bind="$attrs" />
</template>

<script setup lang="ts">
import type { Component } from "vue";
import RawFeatureCardDisplay from "~/features/review/components/CardDisplay.vue";

const FeatureCardDisplay = RawFeatureCardDisplay as Component;
</script>
